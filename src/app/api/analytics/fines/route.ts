import { NextResponse } from 'next/server';
import { getUnpaidFinesByStudent } from '@/lib/db';

export async function GET() {
  try {
    const fines = getUnpaidFinesByStudent();
    return NextResponse.json({ success: true, data: fines });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
