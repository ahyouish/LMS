import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('lms_session');

  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json({ success: true, user: null });
  }

  try {
    const user = JSON.parse(sessionCookie.value);
    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ success: true, user: null });
  }
}
