import { NextResponse } from 'next/server';
import { listSentences } from '@/lib/sqlite';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get('datasetId') || undefined;
    const level = searchParams.get('level') || undefined;
    const category = searchParams.get('category') || undefined;
    const limit = Number(searchParams.get('limit') || '20');
    const excludeMastered = searchParams.get('excludeMastered') === '1';
    // 复习本「重练这一句」：只抽指定句子
    const idsParam = searchParams.get('ids');
    const ids = idsParam
      ? idsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 50)
      : undefined;

    const sentences = listSentences({
      datasetId,
      level,
      category,
      limit,
      excludeMastered,
      ids: ids && ids.length ? ids : undefined,
    });
    return NextResponse.json({ ok: true, sentences });
  } catch (err: any) {
    console.error('sentences api error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
