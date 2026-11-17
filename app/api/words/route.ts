import { NextResponse } from 'next/server';
import { countWordBank, getWordQuiz, saveWordRecords } from '@/lib/sqlite';
import { normalizeWord, spellingVariant, looksLikeTypo } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/words?level=B1&count=20 —— 单词默写抽题（附服务端批改函数说明见 judgeWord） */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const level = params.get('level') || 'all';
    const count = Math.min(Math.max(Number(params.get('count')) || 20, 5), 50);
    const exam = params.get('exam') || '';
    const idsParam = params.get('ids');
    const ids = idsParam
      ? idsParam
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 50)
      : undefined;

    const rows = getWordQuiz(level, count, exam, ids);
    // 释义只留第一行，题目卡更清爽
    const words = rows.map((r) => ({
      word: r.word,
      level: r.level,
      phonetic: r.phonetic,
      translation: (r.translation || '').split('\n')[0] || '',
    }));

    // total：当前筛选条件下的词库总量，首页徽标用
    return NextResponse.json({
      ok: true,
      words,
      total: ids?.length ? words.length : countWordBank(level, exam),
    });
  } catch (err: any) {
    console.error('words api error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'words failed' }, { status: 500 });
  }
}

/**
 * POST /api/words —— 批量保存单词默写作答记录（复用 practice_records，mode='word'）
 * body: { words: [{ word, typed, correct, typo, timeSpent }] , level }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: Array<{ word?: string; typed?: string; timeSpent?: number }> = body?.words ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'words 不能为空' }, { status: 400 });
    }

    const saved = saveWordRecords(
      items.map((it) => {
        const expected = normalizeWord(it.word ?? '');
        const typed = normalizeWord(it.typed ?? '');
        const exact = !!expected && typed === expected;
        const lenient =
          !exact && (!!expected && (!!spellingVariant(expected, typed) || looksLikeTypo(expected, typed)));
        return {
          word: expected,
          typed,
          correct: exact,
          lenient,
          timeSpent: Math.max(1, Math.round(Number(it.timeSpent) || 1)),
        };
      })
    );

    return NextResponse.json({ ok: true, saved });
  } catch (err: any) {
    console.error('words post error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'save failed' }, { status: 500 });
  }
}
