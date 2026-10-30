import { NextResponse } from 'next/server';
import { judgeAlternative } from '@/lib/semanticJudge';
import { getEquivalence, saveEquivalence } from '@/lib/sqlite';
import type { JudgeItem, JudgeResult } from '@/lib/type';

export const runtime = 'nodejs';

type JudgeBody = {
  sentenceId?: string;
  sentence?: string;
  items?: JudgeItem[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as JudgeBody;
    const sentence = String(body.sentence || '');
    const sentenceId = String(body.sentenceId || '');
    const items = Array.isArray(body.items) ? body.items : [];

    if (!sentence || items.length === 0) {
      return NextResponse.json({ ok: true, results: [] as JudgeResult[] });
    }

    const results: JudgeResult[] = [];

    for (const item of items) {
      const order = Number(item.order) || 0;
      const expected = String(item.expected || '');
      const typed = String(item.typed || '').trim();

      if (!typed) {
        results.push({ order, accept: false, entail: 0, contra: 0 });
        continue;
      }

      // 命中缓存直接返回，避免重复推理
      const cached = sentenceId ? getEquivalence(sentenceId, order, typed) : undefined;
      if (cached) {
        results.push({
          order,
          accept: !!cached.accepted,
          entail: cached.entail ?? 0,
          contra: cached.contra ?? 0,
          cached: true,
        });
        continue;
      }

      const verdict = await judgeAlternative({ sentence, expected, typed });

      if (sentenceId) {
        saveEquivalence({
          sentenceId,
          blankOrder: order,
          typed,
          expected,
          accepted: verdict.accept,
          entail: verdict.entail,
          contra: verdict.contra,
        });
      }

      results.push({
        order,
        accept: verdict.accept,
        entail: verdict.entail,
        contra: verdict.contra,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('judge api error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'judge failed' }, { status: 500 });
  }
}
