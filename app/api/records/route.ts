import { NextResponse } from 'next/server';
import { saveRecord } from '@/lib/sqlite';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    saveRecord(body);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('records api error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
