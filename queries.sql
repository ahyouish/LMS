-- ============================================================================
-- COLLEGE LIBRARY MANAGEMENT SYSTEM (LMS)
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.5+
-- File: queries.sql
-- Description: Analytical and operational queries
--   1. List all currently overdue books with borrower contact info.
--   2. Total unpaid fines per student.
--   3. Supplementary: Member borrowing quota utilization.
--   4. Supplementary: Catalog inventory availability overview.
-- ============================================================================

USE library_db;

-- ============================================================================
-- ANALYTICAL QUERY 1: Currently Overdue Books with Borrower Contact Info
-- Description:
--   Identifies all physical copies that are currently checked out 
--   (return_date IS NULL) and have passed their due date (due_date < CURRENT_DATE).
--   Computes real-time days overdue and retrieves patron contact details.
-- ============================================================================
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
    CURRENT_DATE AS reference_date,
    DATEDIFF(CURRENT_DATE, bi.due_date) AS days_overdue,
    ROUND(DATEDIFF(CURRENT_DATE, bi.due_date) * 10.00, 2) AS estimated_pending_fine_rupees
FROM Book_Issues bi
INNER JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
INNER JOIN Books b        ON bc.book_id = b.book_id
INNER JOIN Members m      ON bi.member_id = m.member_id
WHERE bi.return_date IS NULL
  AND bi.due_date < CURRENT_DATE
ORDER BY days_overdue DESC, bi.issue_date ASC;


-- ============================================================================
-- ANALYTICAL QUERY 2: Total Unpaid Fines Per Student
-- Description:
--   Aggregates total outstanding monetary liability and count of unpaid fines
--   specifically for students (member_type = 'student').
-- ============================================================================
SELECT 
    m.member_id,
    m.college_id AS student_id,
    m.name AS student_name,
    m.email AS student_email,
    m.status AS account_status,
    COUNT(f.fine_id) AS unpaid_fines_count,
    SUM(f.amount) AS total_unpaid_amount,
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


-- ============================================================================
-- SUPPLEMENTARY QUERY 3: Member Borrowing Quota & Utilization Summary
-- Description:
--   Lists all registered members with their quota limit, active checked-out
--   books, and remaining borrowing capacity.
-- ============================================================================
SELECT 
    m.member_id,
    m.college_id,
    m.name AS member_name,
    m.member_type,
    m.status AS account_status,
    m.max_books AS max_allowed_books,
    COUNT(bi.issue_id) AS currently_issued_count,
    (m.max_books - COUNT(bi.issue_id)) AS remaining_quota_slots
FROM Members m
LEFT JOIN Book_Issues bi 
    ON m.member_id = bi.member_id 
   AND bi.return_date IS NULL
GROUP BY 
    m.member_id,
    m.college_id,
    m.name,
    m.member_type,
    m.status,
    m.max_books
ORDER BY currently_issued_count DESC, m.name ASC;


-- ============================================================================
-- SUPPLEMENTARY QUERY 4: Inventory & Catalog Availability Overview
-- Description:
--   Aggregates physical copy distribution across book titles, showing total
--   copies, available copies, issued copies, and lost copies.
-- ============================================================================
SELECT 
    b.book_id,
    b.isbn,
    b.title,
    b.department,
    COUNT(bc.accession_no) AS total_physical_copies,
    SUM(CASE WHEN bc.status = 'available' THEN 1 ELSE 0 END) AS available_copies,
    SUM(CASE WHEN bc.status = 'issued' THEN 1 ELSE 0 END) AS issued_copies,
    SUM(CASE WHEN bc.status = 'lost' THEN 1 ELSE 0 END) AS lost_copies
FROM Books b
LEFT JOIN Book_Copies bc ON b.book_id = bc.book_id
GROUP BY 
    b.book_id,
    b.isbn,
    b.title,
    b.department
ORDER BY b.department ASC, b.title ASC;
