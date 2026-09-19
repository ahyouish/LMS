import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'library_lms.db')
  : path.join(process.cwd(), 'library_lms.db');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    const isNew = !fs.existsSync(DB_PATH);
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA foreign_keys = ON;');
    
    if (isNew) {
      initDatabase(_db);
    } else {
      // Ensure tables exist and check for password column
      try {
        const tableCheck = _db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Members'").get();
        if (!tableCheck) {
          initDatabase(_db);
        } else {
          // Check if password column exists in Members
          const cols = _db.prepare("PRAGMA table_info(Members)").all() as any[];
          const hasPassword = cols.some(c => c.name === 'password');
          if (!hasPassword) {
            initDatabase(_db);
          }
        }
      } catch {
        initDatabase(_db);
      }
    }
  }
  return _db;
}

export function initDatabase(db: DatabaseSync) {
  db.exec(`
    DROP TABLE IF EXISTS Fines;
    DROP TABLE IF EXISTS Book_Issues;
    DROP TABLE IF EXISTS Book_Copies;
    DROP TABLE IF EXISTS Members;
    DROP TABLE IF EXISTS Books;

    CREATE TABLE Books (
      book_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      author      TEXT NOT NULL,
      department  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE Book_Copies (
      accession_no   TEXT PRIMARY KEY,
      book_id        INTEGER NOT NULL,
      status         TEXT NOT NULL CHECK(status IN ('available', 'issued', 'lost')) DEFAULT 'available',
      acquired_date  TEXT NOT NULL DEFAULT (date('now')),
      FOREIGN KEY (book_id) REFERENCES Books(book_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE Members (
      member_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id   TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      email        TEXT NOT NULL UNIQUE,
      password     TEXT NOT NULL DEFAULT 'student123',
      department   TEXT NOT NULL DEFAULT 'General',
      member_type  TEXT NOT NULL CHECK(member_type IN ('student', 'faculty')),
      max_books    INTEGER NOT NULL DEFAULT 3 CHECK(max_books > 0),
      status       TEXT NOT NULL CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE Book_Issues (
      issue_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      accession_no  TEXT NOT NULL,
      member_id     INTEGER NOT NULL,
      issue_date    TEXT NOT NULL DEFAULT (date('now')),
      due_date      TEXT NOT NULL,
      return_date   TEXT NULL DEFAULT NULL,
      FOREIGN KEY (accession_no) REFERENCES Book_Copies(accession_no) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (member_id) REFERENCES Members(member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CHECK (due_date >= issue_date),
      CHECK (return_date IS NULL OR return_date >= issue_date)
    );

    CREATE TABLE Fines (
      fine_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id      INTEGER NOT NULL UNIQUE,
      days_overdue  INTEGER NOT NULL CHECK(days_overdue > 0),
      amount        REAL NOT NULL CHECK(amount >= 0.00),
      status        TEXT NOT NULL CHECK(status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
      assessed_date TEXT NOT NULL DEFAULT (datetime('now')),
      paid_date     TEXT NULL DEFAULT NULL,
      FOREIGN KEY (issue_id) REFERENCES Book_Issues(issue_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `);

  // Populate Seed Data
  seedDatabase(db);
}

export function seedDatabase(db: DatabaseSync) {
  // Database initialized clean with no dummy data as requested.
  // Librarian adds real books and real students via the portal.
}

// ----------------------------------------------------------------------------
// Catalog & Book Management (Add & Delete Books)
// ----------------------------------------------------------------------------
export function addBookWithCopies(data: {
  title: string;
  author: string;
  isbn: string;
  department: string;
  numCopies: number;
  accessionPrefix?: string;
}) {
  const db = getDb();
  const title = data.title.trim();
  const author = data.author.trim();
  const isbn = data.isbn.trim();
  const department = data.department.trim();
  const numCopies = Math.max(1, Math.min(50, Number(data.numCopies) || 1));

  if (!title || !author || !isbn || !department) {
    return { success: false, error: 'Title, Author, ISBN, and Department are required.' };
  }

  // Check unique ISBN
  const existing = db.prepare('SELECT book_id FROM Books WHERE isbn = ?').get(isbn);
  if (existing) {
    return { success: false, error: `A book with ISBN '${isbn}' already exists in catalog.` };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    const insertBook = db.prepare('INSERT INTO Books (isbn, title, author, department) VALUES (?, ?, ?, ?)');
    const bookResult = insertBook.run(isbn, title, author, department);
    const bookId = Number(bookResult.lastInsertRowid);

    // Create physical copies
    let deptSlug = 'GEN';
    const deptMatch = department.match(/\(([^)]+)\)/);
    if (deptMatch && deptMatch[1]) {
      deptSlug = deptMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
    } else {
      deptSlug = department.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'GEN');
    }
    const prefix = (data.accessionPrefix && data.accessionPrefix.trim()) ? data.accessionPrefix.trim().toUpperCase() : `ACC-${deptSlug}`;

    const insertCopy = db.prepare("INSERT INTO Book_Copies (accession_no, book_id, status, acquired_date) VALUES (?, ?, 'available', date('now'))");
    
    // Count existing copies with similar prefix to ensure unique accession numbers
    const existingCopies = db.prepare("SELECT COUNT(*) as count FROM Book_Copies WHERE accession_no LIKE ?").get(`${prefix}-%`) as any;
    const startSeq = (existingCopies?.count || 0) + 1;

    const createdCopies: string[] = [];
    for (let i = 0; i < numCopies; i++) {
      const seq = String(startSeq + i).padStart(3, '0');
      const accessionNo = `${prefix}-${seq}`;
      insertCopy.run(accessionNo, bookId);
      createdCopies.push(accessionNo);
    }

    db.exec('COMMIT;');
    return {
      success: true,
      message: `Added '${title}' with ${numCopies} physical ${numCopies === 1 ? 'copy' : 'copies'} (${createdCopies.join(', ')}).`,
      bookId,
      copies: createdCopies
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, error: err.message };
  }
}

export function deleteBook(bookId: number) {
  const db = getDb();
  
  // Check if any copy is currently issued
  const issuedCheck = db.prepare(`
    SELECT bc.accession_no 
    FROM Book_Copies bc 
    WHERE bc.book_id = ? AND bc.status = 'issued'
  `).get(bookId) as any;

  if (issuedCheck) {
    return { 
      success: false, 
      error: `Cannot delete book: Copy '${issuedCheck.accession_no}' is currently issued to a student. Please return it first.` 
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // Delete past fines and issues associated with this book's copies
    const copies = db.prepare('SELECT accession_no FROM Book_Copies WHERE book_id = ?').all(bookId) as any[];
    for (const copy of copies) {
      const issues = db.prepare('SELECT issue_id FROM Book_Issues WHERE accession_no = ?').all(copy.accession_no) as any[];
      for (const issue of issues) {
        db.prepare('DELETE FROM Fines WHERE issue_id = ?').run(issue.issue_id);
      }
      db.prepare('DELETE FROM Book_Issues WHERE accession_no = ?').run(copy.accession_no);
    }

    db.prepare('DELETE FROM Book_Copies WHERE book_id = ?').run(bookId);
    db.prepare('DELETE FROM Books WHERE book_id = ?').run(bookId);

    db.exec('COMMIT;');
    return { success: true, message: 'Book and its copies deleted from catalog.' };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// Patron / Student Management (Delete Student)
// ----------------------------------------------------------------------------
export function deleteMember(memberId: number) {
  const db = getDb();

  const member = db.prepare('SELECT * FROM Members WHERE member_id = ?').get(memberId) as any;
  if (!member) {
    return { success: false, error: 'Member not found.' };
  }

  // Check if member has active unreturned loans
  const activeLoans = db.prepare('SELECT COUNT(*) as count FROM Book_Issues WHERE member_id = ? AND return_date IS NULL').get(memberId) as any;
  if (activeLoans && activeLoans.count > 0) {
    return {
      success: false,
      error: `Cannot delete student '${member.name}': They currently have ${activeLoans.count} active unreturned library books. Please process their returns first.`
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // Clean up historical fines and returned issues
    const pastIssues = db.prepare('SELECT issue_id FROM Book_Issues WHERE member_id = ?').all(memberId) as any[];
    for (const issue of pastIssues) {
      db.prepare('DELETE FROM Fines WHERE issue_id = ?').run(issue.issue_id);
    }
    db.prepare('DELETE FROM Book_Issues WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM Members WHERE member_id = ?').run(memberId);

    db.exec('COMMIT;');
    return { success: true, message: `Student account for '${member.name}' (${member.college_id}) has been deleted.` };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// Authentication & Registration Logic
// ----------------------------------------------------------------------------
export function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  
  // 1. Check if Admin / Librarian (admin@gmail.com)
  if (normalizedEmail === 'admin@gmail.com') {
    if (password === '123456') {
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

  // 2. Check Member Accounts (Students & Faculty)
  const db = getDb();
  const member = db.prepare('SELECT * FROM Members WHERE LOWER(email) = ?').get(normalizedEmail) as any;

  if (!member) {
    return { success: false, error: 'No patron account registered with this email address.' };
  }

  if (member.password !== password) {
    return { success: false, error: 'Incorrect password for this student account.' };
  }

  return {
    success: true,
    user: {
      id: member.member_id,
      name: member.name,
      email: member.email,
      role: member.member_type, // 'student' or 'faculty'
      college_id: member.college_id,
      department: member.department,
      status: member.status,
      max_books: member.max_books
    }
  };
}

export function registerStudent(data: {
  name: string;
  collegeId: string;
  email: string;
  department?: string;
  password?: string;
  maxBooks?: number;
}) {
  const db = getDb();

  const name = data.name.trim();
  const collegeId = data.collegeId.trim().toUpperCase();
  const email = data.email.trim().toLowerCase();
  const department = (data.department || 'General').trim();
  const password = data.password && data.password.trim() ? data.password.trim() : 'student123';
  const maxBooks = data.maxBooks && data.maxBooks > 0 ? Number(data.maxBooks) : 3;

  if (!name || !collegeId || !email) {
    return { success: false, error: 'Name, College ID, and Email are required fields.' };
  }

  // Check unique constraints
  const existingEmail = db.prepare('SELECT member_id FROM Members WHERE LOWER(email) = ?').get(email);
  if (existingEmail) {
    return { success: false, error: `A member with email '${email}' already exists.` };
  }

  const existingCollegeId = db.prepare('SELECT member_id FROM Members WHERE UPPER(college_id) = ?').get(collegeId);
  if (existingCollegeId) {
    return { success: false, error: `A member with College ID '${collegeId}' already exists.` };
  }

  try {
    const insertStmt = db.prepare(`
      INSERT INTO Members (college_id, name, email, password, department, member_type, max_books, status)
      VALUES (?, ?, ?, ?, ?, 'student', ?, 'active')
    `);
    const result = insertStmt.run(collegeId, name, email, password, department, maxBooks);
    const newMemberId = Number(result.lastInsertRowid);

    return {
      success: true,
      member: {
        member_id: newMemberId,
        college_id: collegeId,
        name,
        email,
        department,
        member_type: 'student',
        max_books: maxBooks,
        status: 'active'
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getStudentDashboard(memberId: number) {
  const db = getDb();
  
  const member = db.prepare('SELECT * FROM Members WHERE member_id = ?').get(memberId) as any;
  if (!member) {
    return null;
  }

  // Active Loans with real-time due status
  const activeLoans = db.prepare(`
    SELECT 
      bi.issue_id,
      bi.accession_no,
      bi.issue_date,
      bi.due_date,
      b.title,
      b.author,
      b.department,
      CAST((julianday('now') - julianday(bi.due_date)) AS INTEGER) as days_overdue
    FROM Book_Issues bi
    JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
    JOIN Books b ON bc.book_id = b.book_id
    WHERE bi.member_id = ? AND bi.return_date IS NULL
    ORDER BY bi.due_date ASC
  `).all(memberId) as any[];

  // Fines
  const fines = db.prepare(`
    SELECT 
      f.fine_id,
      f.issue_id,
      f.days_overdue,
      f.amount,
      f.status,
      f.assessed_date,
      f.paid_date,
      b.title,
      bi.accession_no
    FROM Fines f
    JOIN Book_Issues bi ON f.issue_id = bi.issue_id
    JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
    JOIN Books b ON bc.book_id = b.book_id
    WHERE bi.member_id = ?
    ORDER BY f.assessed_date DESC
  `).all(memberId) as any[];

  const totalUnpaidFines = fines
    .filter(f => f.status === 'unpaid')
    .reduce((sum, f) => sum + f.amount, 0);

  return {
    member: {
      member_id: member.member_id,
      name: member.name,
      college_id: member.college_id,
      email: member.email,
      department: member.department,
      max_books: member.max_books,
      status: member.status,
      member_type: member.member_type
    },
    activeLoans,
    fines,
    totalUnpaidFines: Math.round(totalUnpaidFines * 100) / 100,
    usedQuota: activeLoans.length,
    remainingQuota: Math.max(0, member.max_books - activeLoans.length)
  };
}

// ----------------------------------------------------------------------------
// Circulation Procedures (Atomic Transactions & Business Logic)
// ----------------------------------------------------------------------------
export function issueBookTransaction(accessionNo: string, memberId: number, loanDays: number = 14) {
  const db = getDb();
  
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Verify Member
    const member = db.prepare('SELECT status, max_books FROM Members WHERE member_id = ?').get(memberId) as any;
    if (!member) {
      throw new Error(`Member with ID #${memberId} does not exist.`);
    }
    if (member.status === 'blocked') {
      throw new Error('Borrowing rejected: Member account is BLOCKED due to disciplinary or administrative hold.');
    }
    if (member.status !== 'active') {
      throw new Error(`Borrowing rejected: Member account status is '${member.status}'.`);
    }

    // 2. Check Quota Limit (active loans count)
    const activeResult = db.prepare('SELECT COUNT(*) as count FROM Book_Issues WHERE member_id = ? AND return_date IS NULL').get(memberId) as any;
    const currentActive = activeResult ? activeResult.count : 0;
    if (currentActive >= member.max_books) {
      throw new Error(`Quota limit reached: Member has ${currentActive} of max ${member.max_books} active borrowed books.`);
    }

    // 3. Verify Book Copy Status
    const copy = db.prepare('SELECT status FROM Book_Copies WHERE accession_no = ?').get(accessionNo) as any;
    if (!copy) {
      throw new Error(`Book copy '${accessionNo}' does not exist.`);
    }
    if (copy.status !== 'available') {
      throw new Error(`Copy '${accessionNo}' is currently ${copy.status.toUpperCase()} and cannot be issued.`);
    }

    // 4. Create Issue Record & Mark Copy Issued
    const duration = loanDays > 0 ? loanDays : 14;
    const insertIssueStmt = db.prepare(`
      INSERT INTO Book_Issues (accession_no, member_id, issue_date, due_date, return_date)
      VALUES (?, ?, date('now'), date('now', '+' || ? || ' days'), NULL)
    `);
    const result = insertIssueStmt.run(accessionNo, memberId, duration);
    const newIssueId = Number(result.lastInsertRowid);

    db.prepare("UPDATE Book_Copies SET status = 'issued' WHERE accession_no = ?").run(accessionNo);

    db.exec('COMMIT;');

    const issueDetails = db.prepare(`
      SELECT bi.*, b.title, m.name as member_name 
      FROM Book_Issues bi
      JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
      JOIN Books b ON bc.book_id = b.book_id
      JOIN Members m ON bi.member_id = m.member_id
      WHERE bi.issue_id = ?
    `).get(newIssueId);

    return { success: true, data: issueDetails };
  } catch (error: any) {
    db.exec('ROLLBACK;');
    return { success: false, error: error.message };
  }
}

export function returnBookTransaction(accessionNo: string, finePerDay: number = 10.00) {
  const db = getDb();

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Locate active borrowing
    const issue = db.prepare(`
      SELECT issue_id, member_id, due_date, date('now') as today,
             CAST((julianday('now') - julianday(due_date)) AS INTEGER) as days_late
      FROM Book_Issues 
      WHERE accession_no = ? AND return_date IS NULL
      ORDER BY issue_id DESC LIMIT 1
    `).get(accessionNo) as any;

    if (!issue) {
      throw new Error(`No active borrow record found for book copy '${accessionNo}'.`);
    }

    const { issue_id, member_id, due_date, days_late } = issue;
    const daysOverdue = Math.max(0, days_late || 0);

    // 2. Mark Return Date & Restore Copy Status
    db.prepare("UPDATE Book_Issues SET return_date = date('now') WHERE issue_id = ?").run(issue_id);
    db.prepare("UPDATE Book_Copies SET status = 'available' WHERE accession_no = ?").run(accessionNo);

    // 3. Assess fine if overdue (₹10 per day)
    let fineRecord = null;
    if (daysOverdue > 0) {
      const fineRate = finePerDay >= 0 ? finePerDay : 10.00;
      const amount = Math.round(daysOverdue * fineRate * 100) / 100;

      const fineStmt = db.prepare(`
        INSERT INTO Fines (issue_id, days_overdue, amount, status, assessed_date)
        VALUES (?, ?, ?, 'unpaid', datetime('now'))
      `);
      const fineRes = fineStmt.run(issue_id, daysOverdue, amount);
      fineRecord = {
        fine_id: Number(fineRes.lastInsertRowid),
        days_overdue: daysOverdue,
        amount,
        status: 'unpaid'
      };
    }

    db.exec('COMMIT;');

    return {
      success: true,
      data: {
        issue_id,
        accession_no: accessionNo,
        member_id,
        due_date,
        return_date: new Date().toISOString().split('T')[0],
        days_overdue: daysOverdue,
        fine: fineRecord,
        is_overdue: daysOverdue > 0
      }
    };
  } catch (error: any) {
    db.exec('ROLLBACK;');
    return { success: false, error: error.message };
  }
}

// ----------------------------------------------------------------------------
// Analytical Queries
// ----------------------------------------------------------------------------

export function getOverdueLoans() {
  const db = getDb();
  return db.prepare(`
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
      CAST((julianday('now') - julianday(bi.due_date)) AS INTEGER) AS days_overdue,
      ROUND(CAST((julianday('now') - julianday(bi.due_date)) AS INTEGER) * 10.00, 2) AS estimated_pending_fine
    FROM Book_Issues bi
    INNER JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
    INNER JOIN Books b        ON bc.book_id = b.book_id
    INNER JOIN Members m      ON bi.member_id = m.member_id
    WHERE bi.return_date IS NULL
      AND date(bi.due_date) < date('now')
    ORDER BY days_overdue DESC, bi.issue_date ASC;
  `).all();
}

export function getUnpaidFinesByStudent() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      m.member_id,
      m.college_id AS student_id,
      m.name AS student_name,
      m.email AS student_email,
      m.status AS account_status,
      COUNT(f.fine_id) AS unpaid_fines_count,
      ROUND(SUM(f.amount), 2) AS total_unpaid_amount,
      MAX(f.days_overdue) AS max_days_overdue
    FROM Members m
    INNER JOIN Book_Issues bi ON m.member_id = bi.member_id
    INNER JOIN Fines f        ON bi.issue_id = f.issue_id
    WHERE m.member_type = 'student'
      AND f.status = 'unpaid'
    GROUP BY 
      m.member_id,
      m.college_id,
      m.name,
      m.email,
      m.status
    ORDER BY total_unpaid_amount DESC, student_name ASC;
  `).all();
}

export function getCatalogWithCopies() {
  const db = getDb();
  const books = db.prepare('SELECT * FROM Books ORDER BY department, title').all() as any[];
  const copies = db.prepare(`
    SELECT bc.*, bi.due_date, m.name as borrower_name
    FROM Book_Copies bc
    LEFT JOIN Book_Issues bi ON bc.accession_no = bi.accession_no AND bi.return_date IS NULL
    LEFT JOIN Members m ON bi.member_id = m.member_id
    ORDER BY bc.accession_no
  `).all() as any[];

  return books.map(book => ({
    ...book,
    copies: copies.filter(c => c.book_id === book.book_id)
  }));
}

export function getMembersWithStats() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      m.*,
      COUNT(bi.issue_id) AS currently_issued_count,
      (m.max_books - COUNT(bi.issue_id)) AS remaining_slots,
      COALESCE((
        SELECT SUM(f.amount) 
        FROM Fines f 
        JOIN Book_Issues bi2 ON f.issue_id = bi2.issue_id 
        WHERE bi2.member_id = m.member_id AND f.status = 'unpaid'
      ), 0.00) AS total_unpaid_fines
    FROM Members m
    LEFT JOIN Book_Issues bi ON m.member_id = bi.member_id AND bi.return_date IS NULL
    GROUP BY m.member_id
    ORDER BY m.name ASC
  `).all();
}

export function getActiveLoans() {
  const db = getDb();
  return db.prepare(`
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
      CAST((julianday('now') - julianday(bi.due_date)) AS INTEGER) AS overdue_days
    FROM Book_Issues bi
    JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
    JOIN Books b ON bc.book_id = b.book_id
    JOIN Members m ON bi.member_id = m.member_id
    WHERE bi.return_date IS NULL
    ORDER BY bi.due_date ASC
  `).all();
}

export function getDashboardSummary() {
  const db = getDb();
  const totalBooks = (db.prepare('SELECT COUNT(*) as count FROM Books').get() as any).count;
  const totalCopies = (db.prepare('SELECT COUNT(*) as count FROM Book_Copies').get() as any).count;
  const activeLoans = (db.prepare('SELECT COUNT(*) as count FROM Book_Issues WHERE return_date IS NULL').get() as any).count;
  const overdueCount = (db.prepare("SELECT COUNT(*) as count FROM Book_Issues WHERE return_date IS NULL AND date(due_date) < date('now')").get() as any).count;
  const totalUnpaidFines = (db.prepare("SELECT COALESCE(SUM(amount), 0.00) as sum FROM Fines WHERE status = 'unpaid'").get() as any).sum;

  return {
    totalBooks,
    totalCopies,
    activeLoans,
    overdueCount,
    totalUnpaidFines
  };
}
