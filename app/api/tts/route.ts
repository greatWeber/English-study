import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 微软神经网络语音（自然、有感情）。Aria 是美式女声，清晰度好。 */
const VOICE = 'en-US-AriaNeural';
const MAX_LEN = 300;

const CACHE_DIR = process.env.TTS_CACHE_DIR || path.join(process.cwd(), 'data', 'tts-cache');

type WordMark = { text: string; offsetMs: number; durationMs: number };

function rateToProsody(rate: number): string {
  // 0.7 → '-30%'，1 → '+0%'
  const pct = Math.round((rate - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/** 调 Edge 神经网络语音合成：webm 音频 + 逐词时间戳，一起落盘缓存 */
async function synthesize(text: string, rate: number): Promise<{ audio: Buffer; marks: WordMark[] }> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS, {
      wordBoundaryEnabled: true,
    });

    const { audioStream, metadataStream } = tts.toStream(text, { rate: rateToProsody(rate) });

    const audioChunks: Buffer[] = [];
    const audio = new Promise<Buffer>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => audioChunks.push(chunk));
      audioStream.on('end', () => resolve(Buffer.concat(audioChunks)));
      audioStream.on('error', reject);
    });

    // metadata 流是换行分隔的 WordBoundary JSON（首行为音频类型声明，忽略即可）。
    // 注意：库不会主动关闭 metadata 流（socket 回收时才 destroy），
    // 所以用 data 事件收集、忽略 close 错误，不能 for-await。
    const marks: WordMark[] = [];
    if (metadataStream) {
      let rest = '';
      const extractObjects = (buf: string): { jsons: string[]; rest: string } => {
        // 元数据是多行美化 JSON，用大括号配对切出完整的顶层对象
        const jsons: string[] = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < buf.length; i++) {
          const ch = buf[i];
          if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
          } else if (ch === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
              jsons.push(buf.slice(start, i + 1));
              start = -1;
            }
          }
        }
        return { jsons, rest: start >= 0 ? buf.slice(start) : '' };
      };
      const consume = (raw: string) => {
        const { jsons, rest: leftover } = extractObjects(rest + raw);
        rest = leftover;
        for (const json of jsons) {
          try {
            // Edge 的元数据格式：{"Metadata":[{"Type":"WordBoundary","Data":{"Offset":100ns,"Duration":…,"text":{"Text":"word"}}}]}
            const payload = JSON.parse(json);
            for (const item of payload?.Metadata ?? []) {
              if (item?.Type !== 'WordBoundary') continue;
              const offset = item?.Data?.Offset;
              if (typeof offset !== 'number') continue;
              marks.push({
                text: String(item?.Data?.text?.Text ?? ''),
                offsetMs: offset / 10000, // 100ns 刻度 → ms
                durationMs: (item?.Data?.Duration ?? 0) / 10000,
              });
            }
          } catch {
            /* 非法 JSON 忽略 */
          }
        }
      };
      metadataStream.on('data', (chunk: Buffer) => consume(chunk.toString('utf8')));
      metadataStream.on('error', () => undefined);
    }

    const audioBuf = await audio;
    // 音频结束后给 metadata 一点收尾时间（正常应先到）
    await new Promise((r) => setTimeout(r, marks.length > 0 || !metadataStream ? 0 : 150));
    return { audio: audioBuf, marks };
  } finally {
    tts.close();
  }
}

/**
 * GET /api/tts?text=...&rate=1 —— 句子级神经语音朗读。
 * 返回 audio/webm；同句同速命中磁盘缓存（data/tts-cache/）。
 * 响应头 X-Tts-Marks 带 URL 编码的逐词时间戳 JSON，供前端高亮。
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const text = (params.get('text') || '').trim().replace(/\s+/g, ' ');
    const rate = Math.min(Math.max(parseFloat(params.get('rate') || '1') || 1, 0.5), 1.5);

    if (!text || text.length > MAX_LEN || !/[a-z]/i.test(text)) {
      return NextResponse.json({ ok: false, error: 'invalid text' }, { status: 400 });
    }

    const key = createHash('sha1').update(`${VOICE}|${rate}|${text}`).digest('hex');
    const audioPath = path.join(CACHE_DIR, `${key}.webm`);
    const marksPath = path.join(CACHE_DIR, `${key}.json`);

    let audio: Buffer | null = null;
    let marks: WordMark[] | null = null;
    try {
      audio = await fs.readFile(audioPath);
      try {
        marks = JSON.parse(await fs.readFile(marksPath, 'utf8'));
      } catch {
        marks = [];
      }
    } catch {
      /* 未命中缓存 */
    }

    if (!audio) {
      const result = await synthesize(text, rate);
      audio = result.audio;
      marks = result.marks;
      if (audio.length > 0) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        // 先写临时文件再改名，避免并发请求读到半截文件
        const tmp = `${audioPath}.${process.pid}.tmp`;
        await fs.writeFile(tmp, audio);
        await fs.rename(tmp, audioPath);
        await fs.writeFile(marksPath, JSON.stringify(marks)).catch(() => undefined);
      }
    }

    if (!audio || audio.length === 0) {
      return NextResponse.json({ ok: false, error: 'tts empty' }, { status: 502 });
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/webm',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Tts-Marks': encodeURIComponent(JSON.stringify(marks ?? [])),
      },
    });
  } catch (err: any) {
    console.error('tts api error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'tts failed' }, { status: 500 });
  }
}
