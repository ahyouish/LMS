import { NextResponse } from 'next/server';
import { getActiveLoans } from '@/lib/db';

export async function GET() {
  try {
    const loans = getActiveLoans();
    return NextResponse.json({ success: true, data: loans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
