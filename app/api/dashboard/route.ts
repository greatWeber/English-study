import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/sqlite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/dashboard —— 首页今日学习面板 */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...getDashboardStats() });
  } catch (err: any) {
    console.error('dashboard api error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'dashboard failed' }, { status: 500 });
  }
}
