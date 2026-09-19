import { NextResponse } from 'next/server';
import { initDatabase, getDashboardSummary } from '@/lib/db';

export async function POST() {
  try {
    await initDatabase();
    return NextResponse.json({ success: true, message: 'Database reset and re-seeded successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const summary = await getDashboardSummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
