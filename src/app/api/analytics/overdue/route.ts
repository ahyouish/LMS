import { NextResponse } from 'next/server';
import { getOverdueLoans } from '@/lib/db';

export async function GET() {
  try {
    const overdue = await getOverdueLoans();
    return NextResponse.json({ success: true, data: overdue });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
