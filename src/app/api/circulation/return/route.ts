import { NextResponse } from 'next/server';
import { returnBookTransaction } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accessionNo, finePerDay } = body;

    if (!accessionNo) {
      return NextResponse.json(
        { success: false, error: 'Book Accession Number is required.' },
        { status: 400 }
      );
    }

    const result = returnBookTransaction(
      String(accessionNo).trim(),
      finePerDay !== undefined ? Number(finePerDay) : 2.00
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
