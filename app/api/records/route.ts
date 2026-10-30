import { NextResponse } from 'next/server';
import { saveRecord, clearAllRecords } from '@/lib/sqlite';

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

/** 清空错题本（复习记录 + 统计）。旧版只清了前端 state，刷新就回来，这里真正落库。 */
export async function DELETE() {
  try {
    const { deleted } = clearAllRecords();
    return NextResponse.json({ ok: true, deleted });
  } catch (err: any) {
    console.error('records delete error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
