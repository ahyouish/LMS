import { NextResponse } from 'next/server';
import { getDb, initDatabase, getDashboardSummary } from '@/lib/db';

export async function POST() {
  try {
    const db = getDb();
    initDatabase(db);
    return NextResponse.json({ success: true, message: 'Database reset and re-seeded successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const summary = getDashboardSummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
