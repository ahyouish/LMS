import { NextResponse } from 'next/server';
import { registerStudent } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, collegeId, email, department, password, maxBooks } = body;

    if (!name || !collegeId || !email) {
      return NextResponse.json(
        { success: false, error: 'Student Name, College ID, and Email are required.' },
        { status: 400 }
      );
    }

    const result = await registerStudent({
      name,
      collegeId,
      email,
      department: department || 'General',
      password: password || 'student123',
      maxBooks: maxBooks ? Number(maxBooks) : 3
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Student account created successfully for ${result.member?.name}. They can now log in using ${result.member?.email}.`,
      member: result.member
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
