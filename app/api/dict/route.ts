import { NextResponse } from 'next/server';
import { examTags, lookupWord } from '@/lib/dictionary';

export const runtime = 'nodejs';

/** GET /api/dict?word=walked —— 离线词典查询，未命中返回 found:false */
export async function GET(req: Request) {
  try {
    const word = new URL(req.url).searchParams.get('word') || '';
    const entry = lookupWord(word);

    if (!entry) {
      return NextResponse.json({ ok: true, found: false });
    }

    return NextResponse.json({ ok: true, found: true, entry, tags: examTags(entry.tag) });
  } catch (err: any) {
    console.error('dict api error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'dict failed' }, { status: 500 });
  }
}
