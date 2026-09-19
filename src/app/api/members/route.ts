import { NextResponse } from 'next/server';
import { getMembersWithStats, updateMemberStatus, deleteMember } from '@/lib/db';

export async function GET() {
  try {
    const members = await getMembersWithStats();
    return NextResponse.json({ success: true, data: members });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { memberId, status } = body;

    if (!memberId || !['active', 'blocked'].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Valid memberId and status ('active' or 'blocked') required." },
        { status: 400 }
      );
    }

    const updated = await updateMemberStatus(Number(memberId), status);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'memberId query parameter is required.' },
        { status: 400 }
      );
    }

    const result = await deleteMember(Number(memberId));
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
