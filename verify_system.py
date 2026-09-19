#!/usr/bin/env python3
"""
College Library Management System (LMS) - Verification & Demonstration Suite
Executes end-to-end schema validation, business logic enforcement (procedures),
transaction handling, edge case validation, and analytical query reporting
using Python's standard sqlite3 engine.
"""

import sqlite3
import datetime
from decimal import Decimal

DB_FILE = "lms_verification.db"

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    # Enable foreign key constraint checks in SQLite
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_schema(conn):
    """Initializes 3NF tables with primary and foreign key constraints."""
    cursor = conn.cursor()
    
    cursor.executescript("""
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
        amount        DECIMAL(8, 2) NOT NULL CHECK(amount >= 0.00),
        status        TEXT NOT NULL CHECK(status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
        assessed_date TEXT NOT NULL DEFAULT (datetime('now')),
        paid_date     TEXT NULL DEFAULT NULL,
        FOREIGN KEY (issue_id) REFERENCES Book_Issues(issue_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );
    """)
    conn.commit()
    print("[OK] Schema initialized successfully (3NF Tables, Constraints, ENUM checks).")

def seed_data(conn):
    """Populates catalog, physical inventory, members, and realistic circulation history."""
    today = datetime.date.today()
    cursor = conn.cursor()

    # 1. Books
    books = [
        (1, '978-0078022159', 'Database System Concepts', 'Abraham Silberschatz', 'Computer Science'),
        (2, '978-0262033848', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Computer Science'),
        (3, '978-0132774208', 'Digital Design: With Verilog HDL', 'M. Morris Mano', 'Electronics'),
        (4, '978-1259676512', 'Discrete Mathematics and Its Applications', 'Kenneth H. Rosen', 'Mathematics'),
        (5, '978-0135159552', 'University Physics with Modern Physics', 'Hugh D. Young', 'Physics')
    ]
    cursor.executemany("INSERT INTO Books (book_id, isbn, title, author, department) VALUES (?, ?, ?, ?, ?)", books)

    # 2. Book Copies (11 physical copies)
    copies = [
        ('ACC-CS-101', 1, 'available', (today - datetime.timedelta(days=180)).isoformat()),
        ('ACC-CS-102', 1, 'issued',    (today - datetime.timedelta(days=180)).isoformat()),
        ('ACC-CS-103', 1, 'available', (today - datetime.timedelta(days=90)).isoformat()),
        ('ACC-CS-201', 2, 'available', (today - datetime.timedelta(days=150)).isoformat()),
        ('ACC-CS-202', 2, 'available', (today - datetime.timedelta(days=60)).isoformat()),
        ('ACC-EC-101', 3, 'available', (today - datetime.timedelta(days=120)).isoformat()),
        ('ACC-EC-102', 3, 'issued',    (today - datetime.timedelta(days=120)).isoformat()),
        ('ACC-MA-101', 4, 'available', (today - datetime.timedelta(days=200)).isoformat()),
        ('ACC-MA-102', 4, 'available', (today - datetime.timedelta(days=45)).isoformat()),
        ('ACC-PH-101', 5, 'issued',    (today - datetime.timedelta(days=100)).isoformat()),
        ('ACC-PH-102', 5, 'available', (today - datetime.timedelta(days=30)).isoformat())
    ]
    cursor.executemany("INSERT INTO Book_Copies (accession_no, book_id, status, acquired_date) VALUES (?, ?, ?, ?)", copies)

    # 3. Members
    members = [
        (1, 'STU-2024-001', 'Aarav Sharma',     'aarav.sharma@college.edu',   'student', 3, 'active'),
        (2, 'STU-2024-042', 'Ananya Iyer',      'ananya.iyer@college.edu',    'student', 3, 'active'),
        (3, 'FAC-CS-012',   'Dr. Ramesh Gupta', 'ramesh.gupta@college.edu',   'faculty', 6, 'active'),
        (4, 'STU-2023-118', 'Rohan Verma',      'rohan.verma@college.edu',    'student', 2, 'blocked')
    ]
    cursor.executemany("INSERT INTO Members (member_id, college_id, name, email, member_type, max_books, status) VALUES (?, ?, ?, ?, ?, ?, ?)", members)

    # 4. Circulation Records
    issues = [
        # Issue 1: Returned on time, no fine
        (1, 'ACC-CS-101', 1, (today - datetime.timedelta(days=45)).isoformat(), (today - datetime.timedelta(days=31)).isoformat(), (today - datetime.timedelta(days=33)).isoformat()),
        # Issue 2: Returned 5 days late (Faculty, fine paid)
        (2, 'ACC-CS-201', 3, (today - datetime.timedelta(days=50)).isoformat(), (today - datetime.timedelta(days=20)).isoformat(), (today - datetime.timedelta(days=15)).isoformat()),
        # Issue 3: Returned 7 days late (Student, fine unpaid)
        (3, 'ACC-MA-101', 1, (today - datetime.timedelta(days=30)).isoformat(), (today - datetime.timedelta(days=16)).isoformat(), (today - datetime.timedelta(days=9)).isoformat()),
        # Issue 4: Returned 4 days late (Student, fine unpaid)
        (4, 'ACC-EC-101', 2, (today - datetime.timedelta(days=25)).isoformat(), (today - datetime.timedelta(days=11)).isoformat(), (today - datetime.timedelta(days=7)).isoformat()),
        # Issue 5: Active & OVERDUE (Student: Aarav Sharma, 10 days late, return_date NULL)
        (5, 'ACC-CS-102', 1, (today - datetime.timedelta(days=24)).isoformat(), (today - datetime.timedelta(days=10)).isoformat(), None),
        # Issue 6: Active & OVERDUE (Student: Rohan Verma, 16 days late, return_date NULL)
        (6, 'ACC-PH-101', 4, (today - datetime.timedelta(days=30)).isoformat(), (today - datetime.timedelta(days=16)).isoformat(), None),
        # Issue 7: Active & NOT overdue (Student: Ananya Iyer, due in 10 days)
        (7, 'ACC-EC-102', 2, (today - datetime.timedelta(days=4)).isoformat(),  (today + datetime.timedelta(days=10)).isoformat(), None)
    ]
    cursor.executemany("INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES (?, ?, ?, ?, ?, ?)", issues)

    # 5. Fines
    fines = [
        # Issue 2: 5 days @ ₹10 = ₹50 (Paid)
        (1, 2, 5, 50.00, 'paid', (today - datetime.timedelta(days=15)).isoformat(), (today - datetime.timedelta(days=14)).isoformat()),
        # Issue 3: 7 days @ ₹10 = ₹70 (Unpaid)
        (2, 3, 7, 70.00, 'unpaid', (today - datetime.timedelta(days=9)).isoformat(), None),
        # Issue 4: 4 days @ ₹10 = ₹40 (Unpaid)
        (3, 4, 4, 40.00, 'unpaid', (today - datetime.timedelta(days=7)).isoformat(), None)
    ]
    cursor.executemany("INSERT INTO Fines (fine_id, issue_id, days_overdue, amount, status, assessed_date, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?)", fines)

    conn.commit()
    print("[OK] Seed data inserted successfully (5 books, 11 copies, 4 members, realistic loan/fine history).")

# ----------------------------------------------------------------------------
# Business Logic Procedures (Equivalent to MySQL Stored Procedures)
# ----------------------------------------------------------------------------
def issue_book(conn, accession_no: str, member_id: int, loan_days: int = 14):
    """
    Executes IssueBook procedure logic with atomic transaction:
      1. Validates member exists and status == 'active'
      2. Ensures active borrowed count < max_books quota
      3. Validates book copy status == 'available'
      4. Atomically inserts Book_Issues record and updates Book_Copies status to 'issued'
    """
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")

        # 1. Validate Member
        cursor.execute("SELECT status, max_books FROM Members WHERE member_id = ?", (member_id,))
        member = cursor.fetchone()
        if not member:
            raise ValueError(f"Member ID {member_id} does not exist.")
        if member["status"] == "blocked":
            raise PermissionError("Cannot issue book: Member account is BLOCKED.")
        if member["status"] != "active":
            raise PermissionError(f"Cannot issue book: Member status is '{member['status']}'.")

        # 2. Check Quota Limit
        cursor.execute("SELECT COUNT(*) AS active_count FROM Book_Issues WHERE member_id = ? AND return_date IS NULL", (member_id,))
        active_count = cursor.fetchone()["active_count"]
        if active_count >= member["max_books"]:
            raise OverflowError(f"Borrowing limit reached: Member has {active_count}/{member['max_books']} active loans.")

        # 3. Check Copy Availability
        cursor.execute("SELECT status FROM Book_Copies WHERE accession_no = ?", (accession_no,))
        copy = cursor.fetchone()
        if not copy:
            raise ValueError(f"Book copy '{accession_no}' does not exist.")
        if copy["status"] != "available":
            raise ValueError(f"Book copy '{accession_no}' is not available (status: '{copy['status']}').")

        # 4. Insert Issue & Update Status
        today = datetime.date.today()
        duration = loan_days if loan_days and loan_days > 0 else 14
        due_date = today + datetime.timedelta(days=duration)

        cursor.execute("""
            INSERT INTO Book_Issues (accession_no, member_id, issue_date, due_date, return_date)
            VALUES (?, ?, ?, ?, NULL)
        """, (accession_no, member_id, today.isoformat(), due_date.isoformat()))
        new_issue_id = cursor.lastrowid

        cursor.execute("UPDATE Book_Copies SET status = 'issued' WHERE accession_no = ?", (accession_no,))

        conn.commit()
        return {
            "success": True,
            "issue_id": new_issue_id,
            "accession_no": accession_no,
            "member_id": member_id,
            "due_date": due_date.isoformat()
        }
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}

def return_book(conn, accession_no: str, fine_per_day: float = 10.00):
    """
    Executes ReturnBook procedure logic with atomic transaction:
      1. Finds active borrowing record (return_date IS NULL)
      2. Stamps return_date = today
      3. Sets Book_Copies status back to 'available'
      4. Calculates overdue days: if > 0, generates unpaid Fine entry
    """
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")

        # 1. Find active issue record
        cursor.execute("""
            SELECT issue_id, member_id, due_date 
            FROM Book_Issues 
            WHERE accession_no = ? AND return_date IS NULL
            ORDER BY issue_id DESC LIMIT 1
        """, (accession_no,))
        issue = cursor.fetchone()
        if not issue:
            raise ValueError(f"No active loan record found for book copy '{accession_no}'.")

        issue_id = issue["issue_id"]
        due_date = datetime.date.fromisoformat(issue["due_date"])
        today = datetime.date.today()

        # 2. Update Book_Issues return_date
        cursor.execute("UPDATE Book_Issues SET return_date = ? WHERE issue_id = ?", (today.isoformat(), issue_id))

        # 3. Update Book_Copies status
        cursor.execute("UPDATE Book_Copies SET status = 'available' WHERE accession_no = ?", (accession_no,))

        # 4. Overdue Fine Assessment
        days_overdue = (today - due_date).days
        fine_id = None
        fine_amount = 0.00
        if days_overdue > 0:
            fine_rate = fine_per_day if fine_per_day >= 0 else 10.00
            fine_amount = round(days_overdue * fine_rate, 2)
            cursor.execute("""
                INSERT INTO Fines (issue_id, days_overdue, amount, status, assessed_date)
                VALUES (?, ?, ?, 'unpaid', datetime('now'))
            """, (issue_id, days_overdue, fine_amount))
            fine_id = cursor.lastrowid

        conn.commit()
        return {
            "success": True,
            "issue_id": issue_id,
            "accession_no": accession_no,
            "days_overdue": max(0, days_overdue),
            "fine_amount": fine_amount,
            "fine_id": fine_id,
            "is_overdue": days_overdue > 0
        }
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}

# ----------------------------------------------------------------------------
# Analytical Query Runners
# ----------------------------------------------------------------------------
def run_analytical_query_1(conn):
    """Query 1: List all currently overdue books with borrower contact info."""
    cursor = conn.cursor()
    query = """
    SELECT 
        bi.issue_id,
        bi.accession_no,
        b.title AS book_title,
        b.department,
        m.college_id,
        m.name AS borrower_name,
        m.email AS borrower_email,
        m.member_type,
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
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    print("\n" + "="*115)
    print("ANALYTICAL QUERY 1: CURRENTLY OVERDUE BOOKS & BORROWER CONTACT INFO")
    print("="*115)
    header = f"{'Issue ID':<10} | {'Accession':<12} | {'Book Title':<32} | {'Borrower':<18} | {'Email':<25} | {'Due Date':<10} | {'Overdue':<8}"
    print(header)
    print("-" * 115)
    for r in rows:
        print(f"{r['issue_id']:<10} | {r['accession_no']:<12} | {r['book_title'][:30]:<32} | {r['borrower_name']:<18} | {r['borrower_email']:<25} | {r['due_date']:<10} | {r['days_overdue']:<3} days")
    print("="*115)
    return rows

def run_analytical_query_2(conn):
    """Query 2: Total unpaid fines per student."""
    cursor = conn.cursor()
    query = """
    SELECT 
        m.member_id,
        m.college_id AS student_id,
        m.name AS student_name,
        m.email AS student_email,
        COUNT(f.fine_id) AS unpaid_fines_count,
        ROUND(SUM(f.amount), 2) AS total_unpaid_amount
    FROM Members m
    INNER JOIN Book_Issues bi ON m.member_id = bi.member_id
    INNER JOIN Fines f        ON bi.issue_id = f.issue_id
    WHERE m.member_type = 'student'
      AND f.status = 'unpaid'
    GROUP BY 
        m.member_id,
        m.college_id,
        m.name,
        m.email
    ORDER BY total_unpaid_amount DESC, student_name ASC;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    print("\n" + "="*95)
    print("ANALYTICAL QUERY 2: TOTAL UNPAID FINES PER STUDENT")
    print("="*95)
    header = f"{'Student ID':<15} | {'Student Name':<20} | {'Email':<28} | {'Unpaid Fines':<12} | {'Total Due (Rs)':<12}"
    print(header)
    print("-" * 95)
    for r in rows:
        print(f"{r['student_id']:<15} | {r['student_name']:<20} | {r['student_email']:<28} | {r['unpaid_fines_count']:<12} | Rs. {r['total_unpaid_amount']:<10.2f}")
    print("="*95)
    return rows

def test_business_logic_rules(conn):
    """Tests procedures with intentional positive and negative edge cases."""
    print("\n" + "="*70)
    print("TESTING STORED PROCEDURE BUSINESS LOGIC & CONSTRAINTS")
    print("="*70)

    # Test 1: Blocked member rejection
    res1 = issue_book(conn, accession_no="ACC-CS-103", member_id=4, loan_days=14)
    assert not res1["success"] and "BLOCKED" in res1["error"]
    print("[OK] Test 1 Passed: Blocked member (Rohan Verma) correctly rejected from issuing.")

    # Test 2: Copy already issued rejection
    res2 = issue_book(conn, accession_no="ACC-CS-102", member_id=3, loan_days=14)
    assert not res2["success"] and "not available" in res2["error"]
    print("[OK] Test 2 Passed: Already-issued copy (ACC-CS-102) correctly rejected.")

    # Test 3: Quota limit rejection
    # Give member 2 enough loans to hit their max_books limit (max = 3, currently has 1 active)
    res_fill_1 = issue_book(conn, accession_no="ACC-CS-103", member_id=2, loan_days=14)
    assert res_fill_1["success"]
    res_fill_2 = issue_book(conn, accession_no="ACC-CS-201", member_id=2, loan_days=14)
    assert res_fill_2["success"]
    # Now member 2 has 3 active loans (ACC-EC-102, ACC-CS-103, ACC-CS-201). 4th loan must fail!
    res3 = issue_book(conn, accession_no="ACC-CS-202", member_id=2, loan_days=14)
    assert not res3["success"] and "Borrowing limit reached" in res3["error"]
    print("[OK] Test 3 Passed: Member quota limit enforced (max 3 books reached).")

    # Test 4: Return book overdue with automatic fine calculation (10 days @ Rs 10 = Rs 100)
    res4 = return_book(conn, accession_no="ACC-CS-102", fine_per_day=10.00)
    assert res4["success"] and res4["is_overdue"] and res4["fine_amount"] == 100.00
    print(f"[OK] Test 4 Passed: Overdue book returned, fine assessed = Rs. {res4['fine_amount']:.2f}, status marked 'unpaid'.")

    # Test 5: Return book on time
    # ACC-CS-103 was issued today, returning it now has 0 overdue days and 0 fine
    res5 = return_book(conn, accession_no="ACC-CS-103")
    assert res5["success"] and not res5["is_overdue"] and res5["fine_amount"] == 0.0
    print("[OK] Test 5 Passed: On-time book return processed with $0.00 fine.")

if __name__ == "__main__":
    conn = get_connection()
    init_schema(conn)
    seed_data(conn)
    run_analytical_query_1(conn)
    run_analytical_query_2(conn)
    test_business_logic_rules(conn)
    conn.close()
    print("\n[SUCCESS] ALL VERIFICATION TESTS & QUERIES COMPLETED SUCCESSFULLY!")

