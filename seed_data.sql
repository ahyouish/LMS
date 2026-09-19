-- ============================================================================
-- COLLEGE LIBRARY MANAGEMENT SYSTEM (LMS)
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.5+
-- File: seed_data.sql
-- Description: Realistic seed data covering at least 5 books, 11 physical copies,
--              4 members (students & faculty, active & blocked), and diverse
--              circulation history (on-time returns, paid fines, unpaid fines,
--              and active overdue loans).
-- ============================================================================

USE library_db;

-- Disable foreign key checks for clean truncation and insertion
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Fines;
TRUNCATE TABLE Book_Issues;
TRUNCATE TABLE Book_Copies;
TRUNCATE TABLE Members;
TRUNCATE TABLE Books;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Insert Books (Catalog: 5 Titles across multiple departments)
-- ----------------------------------------------------------------------------
INSERT INTO Books (book_id, isbn, title, author, department) VALUES
(1, '978-0078022159', 'Database System Concepts', 'Abraham Silberschatz', 'Computer Science'),
(2, '978-0262033848', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Computer Science'),
(3, '978-0132774208', 'Digital Design: With Verilog HDL', 'M. Morris Mano', 'Electronics'),
(4, '978-1259676512', 'Discrete Mathematics and Its Applications', 'Kenneth H. Rosen', 'Mathematics'),
(5, '978-0135159552', 'University Physics with Modern Physics', 'Hugh D. Young', 'Physics');

-- ----------------------------------------------------------------------------
-- 2. Insert Book Copies (11 Physical Barcoded Items)
-- ----------------------------------------------------------------------------
INSERT INTO Book_Copies (accession_no, book_id, status, acquired_date) VALUES
-- Copies for "Database System Concepts"
('ACC-CS-101', 1, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 180 DAY)),
('ACC-CS-102', 1, 'issued',    DATE_SUB(CURRENT_DATE, INTERVAL 180 DAY)),
('ACC-CS-103', 1, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)),

-- Copies for "Introduction to Algorithms"
('ACC-CS-201', 2, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 150 DAY)),
('ACC-CS-202', 2, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 60 DAY)),

-- Copies for "Digital Design"
('ACC-EC-101', 3, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 120 DAY)),
('ACC-EC-102', 3, 'issued',    DATE_SUB(CURRENT_DATE, INTERVAL 120 DAY)),

-- Copies for "Discrete Mathematics"
('ACC-MA-101', 4, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 200 DAY)),
('ACC-MA-102', 4, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 45 DAY)),

-- Copies for "University Physics"
('ACC-PH-101', 5, 'issued',    DATE_SUB(CURRENT_DATE, INTERVAL 100 DAY)),
('ACC-PH-102', 5, 'available', DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY));

-- ----------------------------------------------------------------------------
-- 3. Insert Members (4 Patrons: Students & Faculty, Active & Blocked)
-- ----------------------------------------------------------------------------
INSERT INTO Members (member_id, college_id, name, email, member_type, max_books, status) VALUES
(1, 'STU-2024-001', 'Aarav Sharma',     'aarav.sharma@college.edu',   'student', 3, 'active'),
(2, 'STU-2024-042', 'Ananya Iyer',      'ananya.iyer@college.edu',    'student', 3, 'active'),
(3, 'FAC-CS-012',   'Dr. Ramesh Gupta', 'ramesh.gupta@college.edu',   'faculty', 6, 'active'),
(4, 'STU-2023-118', 'Rohan Verma',      'rohan.verma@college.edu',    'student', 2, 'blocked');

-- ----------------------------------------------------------------------------
-- 4. Insert Circulation History (Book_Issues)
-- ----------------------------------------------------------------------------
-- Record 1: Aarav Sharma borrowed ACC-CS-101 in past, returned on time (no fine)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(1, 'ACC-CS-101', 1, 
    DATE_SUB(CURRENT_DATE, INTERVAL 45 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 31 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 33 DAY));

-- Record 2: Dr. Ramesh Gupta borrowed ACC-CS-201 in past, returned 5 days late (fine paid)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(2, 'ACC-CS-201', 3, 
    DATE_SUB(CURRENT_DATE, INTERVAL 50 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 15 DAY));

-- Record 3: Aarav Sharma borrowed ACC-MA-101 in past, returned 7 days late (fine UNPAID)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(3, 'ACC-MA-101', 1, 
    DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 16 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 9 DAY));

-- Record 4: Ananya Iyer borrowed ACC-EC-101 in past, returned 4 days late (fine UNPAID)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(4, 'ACC-EC-101', 2, 
    DATE_SUB(CURRENT_DATE, INTERVAL 25 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 11 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY));

-- Record 5: Aarav Sharma currently has ACC-CS-102 (CURRENTLY OVERDUE by 10 days!)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(5, 'ACC-CS-102', 1, 
    DATE_SUB(CURRENT_DATE, INTERVAL 24 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 10 DAY), 
    NULL);

-- Record 6: Rohan Verma currently has ACC-PH-101 (CURRENTLY OVERDUE by 16 days!)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(6, 'ACC-PH-101', 4, 
    DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY), 
    DATE_SUB(CURRENT_DATE, INTERVAL 16 DAY), 
    NULL);

-- Record 7: Ananya Iyer currently has ACC-EC-102 (ACTIVE, due in 10 days, NOT overdue)
INSERT INTO Book_Issues (issue_id, accession_no, member_id, issue_date, due_date, return_date) VALUES
(7, 'ACC-EC-102', 2, 
    DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY), 
    DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY), 
    NULL);

-- ----------------------------------------------------------------------------
-- 5. Insert Fines (Associated with Late Returns: ₹10 per overdue day)
-- ----------------------------------------------------------------------------
-- Fine for Issue 2: 5 days overdue @ ₹10.00/day = ₹50.00 (Paid by Dr. Ramesh Gupta)
INSERT INTO Fines (fine_id, issue_id, days_overdue, amount, status, assessed_date, paid_date) VALUES
(1, 2, 5, 50.00, 'paid', 
    DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 DAY), 
    DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 14 DAY));

-- Fine for Issue 3: 7 days overdue @ ₹10.00/day = ₹70.00 (Unpaid by Aarav Sharma)
INSERT INTO Fines (fine_id, issue_id, days_overdue, amount, status, assessed_date, paid_date) VALUES
(2, 3, 7, 70.00, 'unpaid', 
    DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 9 DAY), 
    NULL);

-- Fine for Issue 4: 4 days overdue @ ₹10.00/day = ₹40.00 (Unpaid by Ananya Iyer)
INSERT INTO Fines (fine_id, issue_id, days_overdue, amount, status, assessed_date, paid_date) VALUES
(3, 4, 4, 40.00, 'unpaid', 
    DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY), 
    NULL);
