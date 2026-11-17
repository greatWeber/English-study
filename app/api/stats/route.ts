import { NextResponse } from 'next/server';
import { getOverviewStats, getReviewSentences, getWordReview } from '@/lib/sqlite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'overview';

    if (type === 'overview') {
      return NextResponse.json({ ok: true, ...getOverviewStats() });
    }

    if (type === 'review') {
      const limit = Number(searchParams.get('limit') || '20');
      const sentences = getReviewSentences(limit);
      return NextResponse.json({ ok: true, sentences });
    }

    if (type === 'review-words') {
      const limit = Number(searchParams.get('limit') || '50');
      const words = getWordReview(limit).map((word) => ({
        ...word,
        translation: (word.translation || '').split('\n')[0] || '',
        level: word.level || '—',
      }));
      return NextResponse.json({ ok: true, words });
    }

    return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 });
  } catch (err: any) {
    console.error('stats api error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
