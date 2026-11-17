import { NextResponse } from 'next/server';
import {
  saveRecord,
  clearAllRecords,
  clearSentenceRecords,
  clearWordRecords,
} from '@/lib/sqlite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

/** 按范围清空记录：sentences / words / all，默认兼容旧的 all。 */
export async function DELETE(req: Request) {
  try {
    const scope = new URL(req.url).searchParams.get('scope') || 'all';
    const result =
      scope === 'sentences'
        ? clearSentenceRecords()
        : scope === 'words'
          ? clearWordRecords()
          : clearAllRecords();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('records delete error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
