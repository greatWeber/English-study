import { NextResponse } from 'next/server';
import { listDatasets } from '@/lib/sqlite';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const datasets = listDatasets();
    return NextResponse.json({ ok: true, datasets });
  } catch (err: any) {
    console.error('datasets api error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
