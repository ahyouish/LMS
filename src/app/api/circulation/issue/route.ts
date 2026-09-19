import { NextResponse } from 'next/server';
import { issueBookTransaction } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accessionNo, memberId, loanDays } = body;

    if (!accessionNo || !memberId) {
      return NextResponse.json(
        { success: false, error: 'Both Book Accession Number and Member ID are required.' },
        { status: 400 }
      );
    }

    const result = issueBookTransaction(
      String(accessionNo).trim(),
      Number(memberId),
      loanDays ? Number(loanDays) : 14
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
