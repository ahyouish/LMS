import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    let connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres.ojngimczdromplirofdq:We746%25%26%2Bn3tpqiP@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

    // Vercel / AWS Lambda functions are IPv4-only.
    // Direct domain db.ojngimczdromplirofdq.supabase.co is IPv6-only and causes getaddrinfo ENOTFOUND.
    // Automatically route through the IPv4 Supabase Connection Pooler:
    if (connectionString.includes('db.ojngimczdromplirofdq.supabase.co')) {
      connectionString = connectionString
        .replace('db.ojngimczdromplirofdq.supabase.co:5432', 'aws-0-ap-southeast-1.pooler.supabase.com:6543')
        .replace('db.ojngimczdromplirofdq.supabase.co', 'aws-0-ap-southeast-1.pooler.supabase.com:6543')
        .replace('postgres:', 'postgres.ojngimczdromplirofdq:');
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function initDatabase() {
  const p = getPgPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS Books (
      book_id     SERIAL PRIMARY KEY,
      isbn        VARCHAR(50) NOT NULL UNIQUE,
      title       VARCHAR(255) NOT NULL,
      author      VARCHAR(255) NOT NULL,
      department  VARCHAR(100) NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS Book_Copies (
      accession_no   VARCHAR(50) PRIMARY KEY,
      book_id        INTEGER NOT NULL REFERENCES Books(book_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      status         VARCHAR(20) NOT NULL CHECK(status IN ('available', 'issued', 'lost')) DEFAULT 'available',
      acquired_date  DATE NOT NULL DEFAULT CURRENT_DATE
    );

    CREATE TABLE IF NOT EXISTS Members (
      member_id    SERIAL PRIMARY KEY,
      college_id   VARCHAR(50) NOT NULL UNIQUE,
      name         VARCHAR(100) NOT NULL,
      email        VARCHAR(150) NOT NULL UNIQUE,
      password     VARCHAR(100) NOT NULL DEFAULT 'student123',
      department   VARCHAR(100) NOT NULL DEFAULT 'General',
      member_type  VARCHAR(20) NOT NULL CHECK(member_type IN ('student', 'faculty')) DEFAULT 'student',
      max_books    INTEGER NOT NULL DEFAULT 3 CHECK(max_books > 0),
      status       VARCHAR(20) NOT NULL CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS Book_Issues (
      issue_id      SERIAL PRIMARY KEY,
      accession_no  VARCHAR(50) NOT NULL REFERENCES Book_Copies(accession_no) ON UPDATE CASCADE ON DELETE RESTRICT,
      member_id     INTEGER NOT NULL REFERENCES Members(member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date      DATE NOT NULL,
      return_date   DATE NULL DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS Fines (
      fine_id       SERIAL PRIMARY KEY,
      issue_id      INTEGER NOT NULL UNIQUE REFERENCES Book_Issues(issue_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      days_overdue  INTEGER NOT NULL CHECK(days_overdue > 0),
      amount        NUMERIC(10, 2) NOT NULL CHECK(amount >= 0.00),
      status        VARCHAR(20) NOT NULL CHECK(status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
      assessed_date TIMESTAMP NOT NULL DEFAULT NOW(),
      paid_date     TIMESTAMP NULL DEFAULT NULL
    );
  `);
}

// ----------------------------------------------------------------------------
// Authentication & Registration Logic
// ----------------------------------------------------------------------------
export async function authenticateUser(identifier: string, password: string) {
  const normalized = (identifier || '').trim();
  const normalizedLower = normalized.toLowerCase();
  const normalizedUpper = normalized.toUpperCase();
  const trimmedPassword = (password || '').trim();

  // 1. Chief Librarian Admin
  if (normalizedLower === 'admin@gmail.com') {
    if (trimmedPassword === '123456') {
      return {
        success: true,
        user: {
          id: 0,
          name: 'Chief Librarian',
          email: 'admin@gmail.com',
          role: 'admin',
          college_id: 'STAFF-LIB-001',
          department: 'Library Services',
          status: 'active'
        }
      };
    } else {
      return { success: false, error: 'Invalid password for admin@gmail.com.' };
    }
  }

  // 2. Student Patrons from Supabase Postgres
  const p = getPgPool();
  const res = await p.query(
    `SELECT * FROM members WHERE LOWER(email) = LOWER($1) OR UPPER(college_id) = UPPER($2) LIMIT 1`,
    [normalizedLower, normalizedUpper]
  );

  if (res.rows.length === 0) {
    return {
      success: false,
      error: `No student account found with "${normalized}". Please ask the librarian to register your student details.`
    };
  }

  const member = res.rows[0];

  if (member.password !== trimmedPassword) {
    return { success: false, error: 'Incorrect password for this student account.' };
  }

  if (member.status === 'blocked') {
    return { success: false, error: 'This student account has been blocked by the library.' };
  }

  return {
    success: true,
    user: {
      id: member.member_id,
      name: member.name,
      email: member.email,
      role: member.member_type,
      college_id: member.college_id,
      department: member.department,
      status: member.status,
      max_books: member.max_books
    }
  };
}

export async function registerStudent(data: {
  name: string;
  collegeId: string;
  email: string;
  department?: string;
  password?: string;
  maxBooks?: number;
}) {
  const p = getPgPool();

  const name = data.name.trim();
  const collegeId = data.collegeId.trim().toUpperCase();
  const email = data.email.trim().toLowerCase();
  const department = (data.department || 'General').trim();
  const password = data.password && data.password.trim() ? data.password.trim() : 'student123';
  const maxBooks = data.maxBooks && data.maxBooks > 0 ? Number(data.maxBooks) : 3;

  if (!name || !collegeId || !email) {
    return { success: false, error: 'Name, College ID, and Email are required fields.' };
  }

  const existingEmail = await p.query('SELECT member_id FROM members WHERE LOWER(email) = LOWER($1)', [email]);
  if (existingEmail.rows.length > 0) {
    return { success: false, error: `A student with email '${email}' is already registered.` };
  }

  const existingCollegeId = await p.query('SELECT member_id FROM members WHERE UPPER(college_id) = UPPER($1)', [collegeId]);
  if (existingCollegeId.rows.length > 0) {
    return { success: false, error: `A student with College ID '${collegeId}' is already registered.` };
  }

  try {
    const insertRes = await p.query(
      `INSERT INTO members (college_id, name, email, password, department, member_type, max_books, status)
       VALUES ($1, $2, $3, $4, $5, 'student', $6, 'active')
       RETURNING *`,
      [collegeId, name, email, password, department, maxBooks]
    );
    const newMember = insertRes.rows[0];

    return {
      success: true,
      message: `Student account created successfully for ${name}. They can now log in using ${email} or ${collegeId}.`,
      member: newMember
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// Member / Student Management
// ----------------------------------------------------------------------------
export async function getMembersWithStats() {
  const p = getPgPool();
  const res = await p.query(`
    SELECT 
      m.member_id,
      m.college_id,
      m.name,
      m.email,
      m.department,
      m.member_type,
      m.max_books,
      m.status,
      m.created_at,
      COUNT(bi.issue_id)::int AS currently_issued_count,
      (m.max_books - COUNT(bi.issue_id))::int AS remaining_slots,
      COALESCE((
        SELECT SUM(f.amount) 
        FROM fines f 
        JOIN book_issues bi2 ON f.issue_id = bi2.issue_id 
        WHERE bi2.member_id = m.member_id AND f.status = 'unpaid'
      ), 0.00)::numeric AS total_unpaid_fines
    FROM members m
    LEFT JOIN book_issues bi ON m.member_id = bi.member_id AND bi.return_date IS NULL
    GROUP BY m.member_id
    ORDER BY m.name ASC
  `);
  return res.rows.map(row => ({
    ...row,
    total_unpaid_fines: Number(row.total_unpaid_fines) || 0
  }));
}

export async function updateMemberStatus(memberId: number, status: 'active' | 'blocked') {
  const p = getPgPool();
  await p.query('UPDATE members SET status = $1 WHERE member_id = $2', [status, memberId]);
  const res = await p.query('SELECT * FROM members WHERE member_id = $1', [memberId]);
  return res.rows[0];
}

export async function deleteMember(memberId: number) {
  const p = getPgPool();
  const checkRes = await p.query('SELECT * FROM members WHERE member_id = $1', [memberId]);
  if (checkRes.rows.length === 0) {
    return { success: false, error: 'Student account not found.' };
  }
  const member = checkRes.rows[0];

  const activeLoans = await p.query(
    'SELECT COUNT(*)::int as count FROM book_issues WHERE member_id = $1 AND return_date IS NULL',
    [memberId]
  );
  if (activeLoans.rows[0]?.count > 0) {
    return {
      success: false,
      error: `Cannot delete student '${member.name}': They currently have ${activeLoans.rows[0].count} active unreturned library books. Please process their returns first.`
    };
  }

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const issues = await client.query('SELECT issue_id FROM book_issues WHERE member_id = $1', [memberId]);
    for (const issue of issues.rows) {
      await client.query('DELETE FROM fines WHERE issue_id = $1', [issue.issue_id]);
    }
    await client.query('DELETE FROM book_issues WHERE member_id = $1', [memberId]);
    await client.query('DELETE FROM members WHERE member_id = $1', [memberId]);
    await client.query('COMMIT');
    return { success: true, message: `Student account for '${member.name}' (${member.college_id}) has been deleted.` };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------------
// Catalog & Book Management
// ----------------------------------------------------------------------------
export async function getCatalogWithCopies() {
  const p = getPgPool();
  const booksRes = await p.query('SELECT * FROM books ORDER BY department, title');
  const copiesRes = await p.query(`
    SELECT bc.*, bi.due_date, m.name as borrower_name
    FROM book_copies bc
    LEFT JOIN book_issues bi ON bc.accession_no = bi.accession_no AND bi.return_date IS NULL
    LEFT JOIN members m ON bi.member_id = m.member_id
    ORDER BY bc.accession_no
  `);

  return booksRes.rows.map(book => ({
    ...book,
    copies: copiesRes.rows.filter(c => c.book_id === book.book_id)
  }));
}

export async function addBookWithCopies(data: {
  title: string;
  author: string;
  isbn: string;
  department: string;
  numCopies: number;
  accessionPrefix?: string;
}) {
  const p = getPgPool();
  const title = data.title.trim();
  const author = data.author.trim();
  const isbn = data.isbn.trim();
  const department = data.department.trim();
  const numCopies = Math.max(1, Math.min(50, Number(data.numCopies) || 1));

  if (!title || !author || !isbn || !department) {
    return { success: false, error: 'Title, Author, ISBN, and Department are required.' };
  }

  const existing = await p.query('SELECT book_id FROM books WHERE isbn = $1', [isbn]);
  if (existing.rows.length > 0) {
    return { success: false, error: `A book with ISBN '${isbn}' already exists in catalog.` };
  }

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const insertBook = await client.query(
      'INSERT INTO books (isbn, title, author, department) VALUES ($1, $2, $3, $4) RETURNING book_id',
      [isbn, title, author, department]
    );
    const bookId = insertBook.rows[0].book_id;

    let deptSlug = 'GEN';
    const deptMatch = department.match(/\(([^)]+)\)/);
    if (deptMatch && deptMatch[1]) {
      deptSlug = deptMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
    } else {
      deptSlug = department.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'GEN');
    }
    const prefix = (data.accessionPrefix && data.accessionPrefix.trim()) ? data.accessionPrefix.trim().toUpperCase() : `ACC-${deptSlug}`;

    const countRes = await client.query('SELECT COUNT(*)::int as count FROM book_copies WHERE accession_no LIKE $1', [`${prefix}-%`]);
    const startSeq = (countRes.rows[0]?.count || 0) + 1;

    const createdCopies: string[] = [];
    for (let i = 0; i < numCopies; i++) {
      const seq = String(startSeq + i).padStart(3, '0');
      const accessionNo = `${prefix}-${seq}`;
      await client.query(
        "INSERT INTO book_copies (accession_no, book_id, status, acquired_date) VALUES ($1, $2, 'available', CURRENT_DATE)",
        [accessionNo, bookId]
      );
      createdCopies.push(accessionNo);
    }

    await client.query('COMMIT');
    return {
      success: true,
      message: `Added '${title}' with ${numCopies} physical ${numCopies === 1 ? 'copy' : 'copies'} (${createdCopies.join(', ')}).`,
      bookId,
      copies: createdCopies
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function deleteBook(bookId: number) {
  const p = getPgPool();
  const issuedCheck = await p.query(
    "SELECT accession_no FROM book_copies WHERE book_id = $1 AND status = 'issued' LIMIT 1",
    [bookId]
  );
  if (issuedCheck.rows.length > 0) {
    return {
      success: false,
      error: `Cannot delete book: Copy '${issuedCheck.rows[0].accession_no}' is currently issued to a student. Please return it first.`
    };
  }

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const copies = await client.query('SELECT accession_no FROM book_copies WHERE book_id = $1', [bookId]);
    for (const copy of copies.rows) {
      const issues = await client.query('SELECT issue_id FROM book_issues WHERE accession_no = $1', [copy.accession_no]);
      for (const issue of issues.rows) {
        await client.query('DELETE FROM fines WHERE issue_id = $1', [issue.issue_id]);
      }
      await client.query('DELETE FROM book_issues WHERE accession_no = $1', [copy.accession_no]);
    }
    await client.query('DELETE FROM book_copies WHERE book_id = $1', [bookId]);
    await client.query('DELETE FROM books WHERE book_id = $1', [bookId]);
    await client.query('COMMIT');
    return { success: true, message: 'Book and its copies deleted from catalog.' };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------------
// Circulation: Issue & Return
// ----------------------------------------------------------------------------
export async function issueBookTransaction(accessionNo: string, memberId: number, loanDays: number = 14) {
  const p = getPgPool();
  const client = await p.connect();

  try {
    await client.query('BEGIN');

    const copyRes = await client.query('SELECT * FROM book_copies WHERE accession_no = $1 FOR UPDATE', [accessionNo]);
    if (copyRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: `Book copy '${accessionNo}' not found.` };
    }
    const copy = copyRes.rows[0];
    if (copy.status !== 'available') {
      await client.query('ROLLBACK');
      return { success: false, error: `Copy '${accessionNo}' is currently ${copy.status}.` };
    }

    const memberRes = await client.query('SELECT * FROM members WHERE member_id = $1 FOR UPDATE', [memberId]);
    if (memberRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Student member not found.' };
    }
    const member = memberRes.rows[0];
    if (member.status === 'blocked') {
      await client.query('ROLLBACK');
      return { success: false, error: `Borrower '${member.name}' is blocked from borrowing.` };
    }

    const activeCountRes = await client.query(
      'SELECT COUNT(*)::int as count FROM book_issues WHERE member_id = $1 AND return_date IS NULL',
      [memberId]
    );
    const activeCount = activeCountRes.rows[0]?.count || 0;
    if (activeCount >= member.max_books) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Borrowing limit reached: ${member.name} has ${activeCount}/${member.max_books} books checked out.`
      };
    }

    const safeLoanDays = Math.max(1, Math.min(60, Number(loanDays) || 14));
    const issueRes = await client.query(
      `INSERT INTO book_issues (accession_no, member_id, issue_date, due_date)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + ($3 || ' days')::INTERVAL)
       RETURNING issue_id, issue_date, due_date`,
      [accessionNo, memberId, safeLoanDays]
    );
    const newIssue = issueRes.rows[0];

    await client.query("UPDATE book_copies SET status = 'issued' WHERE accession_no = $1", [accessionNo]);
    await client.query('COMMIT');

    return {
      success: true,
      data: {
        issue_id: newIssue.issue_id,
        accession_no: accessionNo,
        member_name: member.name,
        college_id: member.college_id,
        due_date: newIssue.due_date
      }
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function returnBookTransaction(accessionNo: string, finePerDay: number = 10.00) {
  const p = getPgPool();
  const client = await p.connect();

  try {
    await client.query('BEGIN');

    const issueRes = await client.query(
      `SELECT bi.*, m.name as borrower_name, m.college_id
       FROM book_issues bi
       JOIN members m ON bi.member_id = m.member_id
       WHERE bi.accession_no = $1 AND bi.return_date IS NULL
       ORDER BY bi.issue_id DESC
       LIMIT 1
       FOR UPDATE`,
      [accessionNo]
    );

    if (issueRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: `No active issued record found for copy '${accessionNo}'.` };
    }
    const issue = issueRes.rows[0];

    await client.query('UPDATE book_issues SET return_date = CURRENT_DATE WHERE issue_id = $1', [issue.issue_id]);
    await client.query("UPDATE book_copies SET status = 'available' WHERE accession_no = $1", [accessionNo]);

    // Calculate days overdue
    const diffRes = await client.query(
      'SELECT (CURRENT_DATE - $1::date)::int as diff',
      [issue.due_date]
    );
    const rawDiff = diffRes.rows[0]?.diff || 0;
    const daysOverdue = Math.max(0, rawDiff);

    let fineRecord = null;
    if (daysOverdue > 0) {
      const fineRate = Math.max(0, Number(finePerDay) || 10.00);
      const fineAmount = Math.round(daysOverdue * fineRate * 100) / 100;

      const fineRes = await client.query(
        `INSERT INTO fines (issue_id, days_overdue, amount, status, assessed_date)
         VALUES ($1, $2, $3, 'unpaid', NOW())
         ON CONFLICT (issue_id) DO UPDATE SET amount = EXCLUDED.amount, days_overdue = EXCLUDED.days_overdue
         RETURNING *`,
        [issue.issue_id, daysOverdue, fineAmount]
      );
      fineRecord = fineRes.rows[0];
    }

    await client.query('COMMIT');
    return {
      success: true,
      data: {
        issue_id: issue.issue_id,
        accession_no: accessionNo,
        member_id: issue.member_id,
        due_date: issue.due_date,
        return_date: new Date().toISOString().split('T')[0],
        days_overdue: daysOverdue,
        fine: fineRecord ? { ...fineRecord, amount: Number(fineRecord.amount) } : null,
        is_overdue: daysOverdue > 0
      }
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------------
// Analytical & Dashboard Queries
// ----------------------------------------------------------------------------
export async function getOverdueLoans() {
  const p = getPgPool();
  const res = await p.query(`
    SELECT 
      bi.issue_id,
      bi.accession_no,
      b.title AS book_title,
      b.author,
      b.department,
      m.college_id,
      m.name AS borrower_name,
      m.email AS borrower_email,
      m.member_type,
      m.status AS member_status,
      bi.issue_date,
      bi.due_date,
      (CURRENT_DATE - bi.due_date)::int AS days_overdue,
      ROUND(((CURRENT_DATE - bi.due_date) * 10.00)::numeric, 2) AS estimated_pending_fine
    FROM book_issues bi
    INNER JOIN book_copies bc ON bi.accession_no = bc.accession_no
    INNER JOIN books b        ON bc.book_id = b.book_id
    INNER JOIN members m      ON bi.member_id = m.member_id
    WHERE bi.return_date IS NULL
      AND bi.due_date < CURRENT_DATE
    ORDER BY days_overdue DESC, bi.issue_date ASC
  `);
  return res.rows.map(r => ({
    ...r,
    estimated_pending_fine: Number(r.estimated_pending_fine) || 0
  }));
}

export async function getUnpaidFinesByStudent() {
  const p = getPgPool();
  const res = await p.query(`
    SELECT 
      m.member_id,
      m.college_id AS student_id,
      m.name AS student_name,
      m.email AS student_email,
      m.status AS account_status,
      COUNT(f.fine_id)::int AS unpaid_fines_count,
      ROUND(SUM(f.amount)::numeric, 2) AS total_unpaid_amount,
      MAX(f.days_overdue)::int AS max_days_overdue
    FROM members m
    INNER JOIN book_issues bi ON m.member_id = bi.member_id
    INNER JOIN fines f        ON bi.issue_id = f.issue_id
    WHERE m.member_type = 'student'
      AND f.status = 'unpaid'
    GROUP BY 
      m.member_id,
      m.college_id,
      m.name,
      m.email,
      m.status
    ORDER BY total_unpaid_amount DESC, student_name ASC
  `);
  return res.rows.map(r => ({
    ...r,
    total_unpaid_amount: Number(r.total_unpaid_amount) || 0
  }));
}

export async function getActiveLoans() {
  const p = getPgPool();
  const res = await p.query(`
    SELECT 
      bi.issue_id,
      bi.accession_no,
      bi.issue_date,
      bi.due_date,
      b.title AS book_title,
      b.department,
      m.member_id,
      m.college_id,
      m.name AS borrower_name,
      m.member_type,
      (CURRENT_DATE - bi.due_date)::int AS overdue_days
    FROM book_issues bi
    JOIN book_copies bc ON bi.accession_no = bc.accession_no
    JOIN books b ON bc.book_id = b.book_id
    JOIN members m ON bi.member_id = m.member_id
    WHERE bi.return_date IS NULL
    ORDER BY bi.due_date ASC
  `);
  return res.rows;
}

export async function getDashboardSummary() {
  const p = getPgPool();
  const res = await p.query(`
    SELECT 
      (SELECT COUNT(*)::int FROM books) as "totalBooks",
      (SELECT COUNT(*)::int FROM book_copies) as "totalCopies",
      (SELECT COUNT(*)::int FROM book_issues WHERE return_date IS NULL) as "activeLoans",
      (SELECT COUNT(*)::int FROM book_issues WHERE return_date IS NULL AND due_date < CURRENT_DATE) as "overdueCount",
      COALESCE((SELECT SUM(amount)::numeric FROM fines WHERE status = 'unpaid'), 0.00) as "totalUnpaidFines"
  `);
  const row = res.rows[0] || {};
  return {
    totalBooks: Number(row.totalBooks) || 0,
    totalCopies: Number(row.totalCopies) || 0,
    activeLoans: Number(row.activeLoans) || 0,
    overdueCount: Number(row.overdueCount) || 0,
    totalUnpaidFines: Number(row.totalUnpaidFines) || 0
  };
}

export async function getStudentDashboard(memberId: number) {
  const p = getPgPool();
  const memberRes = await p.query('SELECT * FROM members WHERE member_id = $1', [memberId]);
  if (memberRes.rows.length === 0) return null;
  const member = memberRes.rows[0];

  const issuesRes = await p.query(`
    SELECT 
      bi.issue_id,
      bi.accession_no,
      TO_CHAR(bi.issue_date, 'YYYY-MM-DD') as issue_date,
      TO_CHAR(bi.due_date, 'YYYY-MM-DD') as due_date,
      TO_CHAR(bi.return_date, 'YYYY-MM-DD') as return_date,
      b.title,
      b.author,
      b.department,
      (bi.due_date - CURRENT_DATE)::int as days_remaining_raw,
      GREATEST(0, (CURRENT_DATE - bi.due_date)::int) as days_overdue,
      f.fine_id,
      COALESCE(f.amount, 0)::numeric as fine_amount,
      COALESCE(f.status, 'unpaid') as fine_status
    FROM book_issues bi
    JOIN book_copies bc ON bi.accession_no = bc.accession_no
    JOIN books b ON bc.book_id = b.book_id
    LEFT JOIN fines f ON bi.issue_id = f.issue_id
    WHERE bi.member_id = $1
    ORDER BY bi.issue_date DESC
  `, [memberId]);

  // Active currently borrowed books
  const activeLoans = issuesRes.rows
    .filter(i => !i.return_date)
    .map(i => {
      const daysRemaining = Number(i.days_remaining_raw) || 0;
      const isOverdue = daysRemaining < 0;
      const overdueDays = isOverdue ? Math.abs(daysRemaining) : 0;
      const currentDues = isOverdue ? overdueDays * 10.00 : 0.00;

      return {
        issue_id: i.issue_id,
        accession_no: i.accession_no,
        title: i.title,
        author: i.author,
        department: i.department,
        issue_date: i.issue_date,
        due_date: i.due_date,
        days_remaining: daysRemaining,
        is_overdue: isOverdue,
        overdue_days: overdueDays,
        dues: currentDues
      };
    });

  // History: past returned books
  const history = issuesRes.rows
    .filter(i => !!i.return_date)
    .map(i => ({
      issue_id: i.issue_id,
      accession_no: i.accession_no,
      title: i.title,
      author: i.author,
      department: i.department,
      issue_date: i.issue_date,
      due_date: i.due_date,
      return_date: i.return_date,
      fine_amount: Number(i.fine_amount) || 0,
      fine_status: i.fine_status
    }));

  // Total unpaid assessed fines
  const unpaidAssessedRes = await p.query(`
    SELECT COALESCE(SUM(f.amount), 0)::numeric as total
    FROM fines f
    JOIN book_issues bi ON f.issue_id = bi.issue_id
    WHERE bi.member_id = $1 AND f.status = 'unpaid'
  `, [memberId]);
  const unpaidAssessed = Number(unpaidAssessedRes.rows[0]?.total) || 0;

  // Total active overdue pending dues
  const activePendingDues = activeLoans.reduce((sum, loan) => sum + loan.dues, 0);
  const totalDues = unpaidAssessed + activePendingDues;

  return {
    member: {
      member_id: member.member_id,
      name: member.name,
      college_id: member.college_id,
      email: member.email,
      department: member.department,
      max_books: member.max_books,
      status: member.status
    },
    activeLoans,
    history,
    totalDues,
    usedQuota: activeLoans.length
  };
}
