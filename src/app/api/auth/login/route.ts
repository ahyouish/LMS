import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = (body.identifier || body.email || '').trim();
    const password = (body.password || '').trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Email / College ID and password are required.' },
        { status: 400 }
      );
    }

    const authResult = authenticateUser(identifier, password);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: authResult.user
    });

    // Set simple session cookie
    response.cookies.set({
      name: 'lms_session',
      value: JSON.stringify(authResult.user),
      httpOnly: false, // accessible to client for smooth state hydration
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
