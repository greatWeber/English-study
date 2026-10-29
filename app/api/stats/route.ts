import { NextResponse } from 'next/server';
import { getOverviewStats, getReviewSentences } from '@/lib/sqlite';

export const runtime = 'nodejs';

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

    return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 });
  } catch (err: any) {
    console.error('stats api error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
