import { NextResponse } from 'next/server';
import { getStudentDashboard } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'memberId query parameter is required.' },
        { status: 400 }
      );
    }

    const dashboard = await getStudentDashboard(Number(memberId));
    if (!dashboard) {
      return NextResponse.json(
        { success: false, error: 'Student member not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: dashboard });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
