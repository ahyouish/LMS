import { NextResponse } from 'next/server';
import { getCatalogWithCopies, addBookWithCopies, deleteBook } from '@/lib/db';

export async function GET() {
  try {
    const catalog = getCatalogWithCopies();
    return NextResponse.json({ success: true, data: catalog });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, author, isbn, department, numCopies, accessionPrefix } = body;

    if (!title || !author || !isbn || !department) {
      return NextResponse.json(
        { success: false, error: 'Title, Author, ISBN, and Department are required.' },
        { status: 400 }
      );
    }

    const result = addBookWithCopies({
      title,
      author,
      isbn,
      department,
      numCopies: numCopies ? Number(numCopies) : 1,
      accessionPrefix
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message, bookId: result.bookId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');

    if (!bookId) {
      return NextResponse.json({ success: false, error: 'bookId parameter is required.' }, { status: 400 });
    }

    const result = deleteBook(Number(bookId));
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
