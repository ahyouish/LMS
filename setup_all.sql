-- ============================================================================
-- COLLEGE LIBRARY MANAGEMENT SYSTEM (LMS)
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.5+
-- File: setup_all.sql
-- Description: Master all-in-one setup script.
--              Executes DDL, Stored Procedures, Seed Data, and Verification.
-- Usage: mysql -u root -p < setup_all.sql
--    or: source /path/to/setup_all.sql; inside MySQL client.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: DATABASE & TABLE DDL (3NF SCHEMA)
-- ----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS library_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE library_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Fines;
DROP TABLE IF EXISTS Book_Issues;
DROP TABLE IF EXISTS Book_Copies;
DROP TABLE IF EXISTS Members;
DROP TABLE IF EXISTS Books;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Books (
    book_id         INT AUTO_INCREMENT PRIMARY KEY,
    isbn            VARCHAR(20) NOT NULL UNIQUE,
    title           VARCHAR(255) NOT NULL,
    author          VARCHAR(255) NOT NULL,
    department      VARCHAR(100) NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_books_department (department),
    INDEX idx_books_title (title)
) ENGINE=InnoDB;

CREATE TABLE Book_Copies (
    accession_no    VARCHAR(50) PRIMARY KEY,
    book_id         INT NOT NULL,
    status          ENUM('available', 'issued', 'lost') NOT NULL DEFAULT 'available',
    acquired_date   DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT fk_book_copies_book
        FOREIGN KEY (book_id) REFERENCES Books (book_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    INDEX idx_copies_book_id (book_id),
    INDEX idx_copies_status (status)
) ENGINE=InnoDB;

CREATE TABLE Members (
    member_id       INT AUTO_INCREMENT PRIMARY KEY,
    college_id      VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    member_type     ENUM('student', 'faculty') NOT NULL,
    max_books       INT NOT NULL DEFAULT 3,
    status          ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_members_max_books CHECK (max_books > 0),
    INDEX idx_members_status (status),
    INDEX idx_members_type (member_type)
) ENGINE=InnoDB;

CREATE TABLE Book_Issues (
    issue_id        INT AUTO_INCREMENT PRIMARY KEY,
    accession_no    VARCHAR(50) NOT NULL,
    member_id       INT NOT NULL,
    issue_date      DATE NOT NULL DEFAULT (CURRENT_DATE),
    due_date        DATE NOT NULL,
    return_date     DATE NULL DEFAULT NULL,
    CONSTRAINT fk_issues_copy
        FOREIGN KEY (accession_no) REFERENCES Book_Copies (accession_no)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_issues_member
        FOREIGN KEY (member_id) REFERENCES Members (member_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_issue_dates CHECK (due_date >= issue_date),
    CONSTRAINT chk_return_date CHECK (return_date IS NULL OR return_date >= issue_date),
    INDEX idx_issues_member (member_id),
    INDEX idx_issues_accession (accession_no),
    INDEX idx_issues_active_lookup (return_date, due_date)
) ENGINE=InnoDB;

CREATE TABLE Fines (
    fine_id         INT AUTO_INCREMENT PRIMARY KEY,
    issue_id        INT NOT NULL UNIQUE,
    days_overdue    INT NOT NULL,
    amount          DECIMAL(8, 2) NOT NULL,
    status          ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
    assessed_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_date       DATETIME NULL DEFAULT NULL,
    CONSTRAINT fk_fines_issue
        FOREIGN KEY (issue_id) REFERENCES Book_Issues (issue_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_fines_overdue CHECK (days_overdue > 0),
    CONSTRAINT chk_fines_amount CHECK (amount >= 0.00),
    INDEX idx_fines_status (status)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- SECTION 2: STORED PROCEDURES
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS IssueBook;
DROP PROCEDURE IF EXISTS ReturnBook;

DELIMITER $$

CREATE PROCEDURE IssueBook(
    IN p_accession_no VARCHAR(50),
    IN p_member_id    INT,
    IN p_loan_days    INT
)
proc_label: BEGIN
    DECLARE v_member_status   VARCHAR(20);
    DECLARE v_max_books       INT;
    DECLARE v_active_issues   INT;
    DECLARE v_copy_status     VARCHAR(20);
    DECLARE v_loan_duration   INT;
    DECLARE v_due_date        DATE;
    DECLARE v_new_issue_id    INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Validate Member existence & eligibility
    SELECT status, max_books
      INTO v_member_status, v_max_books
      FROM Members
     WHERE member_id = p_member_id;

    IF v_member_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Member does not exist with the specified ID.';
    END IF;

    IF v_member_status = 'blocked' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Member account is BLOCKED. Cannot issue books.';
    END IF;

    IF v_member_status <> 'active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Member account is not active.';
    END IF;

    -- Verify Quota Limit
    SELECT COUNT(*)
      INTO v_active_issues
      FROM Book_Issues
     WHERE member_id = p_member_id
       AND return_date IS NULL;

    IF v_active_issues >= v_max_books THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Member has reached maximum borrowing quota.';
    END IF;

    -- Verify Copy Availability
    SELECT status
      INTO v_copy_status
      FROM Book_Copies
     WHERE accession_no = p_accession_no
       FOR UPDATE;

    IF v_copy_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Book copy with specified accession number does not exist.';
    END IF;

    IF v_copy_status <> 'available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Book copy is not available for issue (currently issued or lost).';
    END IF;

    SET v_loan_duration = IF(p_loan_days IS NOT NULL AND p_loan_days > 0, p_loan_days, 14);
    SET v_due_date = DATE_ADD(CURRENT_DATE, INTERVAL v_loan_duration DAY);

    START TRANSACTION;
        INSERT INTO Book_Issues (
            accession_no,
            member_id,
            issue_date,
            due_date,
            return_date
        ) VALUES (
            p_accession_no,
            p_member_id,
            CURRENT_DATE,
            v_due_date,
            NULL
        );

        SET v_new_issue_id = LAST_INSERT_ID();

        UPDATE Book_Copies
           SET status = 'issued'
         WHERE accession_no = p_accession_no;
    COMMIT;

    SELECT 
        v_new_issue_id AS issue_id,
        p_accession_no AS accession_no,
        p_member_id AS member_id,
        CURRENT_DATE AS issue_date,
        v_due_date AS due_date,
        'SUCCESS: Book issued successfully' AS status_message;

END proc_label$$

CREATE PROCEDURE ReturnBook(
    IN p_accession_no  VARCHAR(50),
    IN p_fine_per_day  DECIMAL(8, 2)
)
proc_label: BEGIN
    DECLARE v_issue_id       INT;
    DECLARE v_member_id      INT;
    DECLARE v_due_date       DATE;
    DECLARE v_days_overdue   INT;
    DECLARE v_fine_rate      DECIMAL(8, 2);
    DECLARE v_fine_amount    DECIMAL(8, 2) DEFAULT 0.00;
    DECLARE v_fine_id        INT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT issue_id, member_id, due_date
      INTO v_issue_id, v_member_id, v_due_date
      FROM Book_Issues
     WHERE accession_no = p_accession_no
       AND return_date IS NULL
     ORDER BY issue_id DESC
     LIMIT 1
       FOR UPDATE;

    IF v_issue_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: No active borrow record found for this book copy.';
    END IF;

    SET v_fine_rate = IF(p_fine_per_day IS NOT NULL AND p_fine_per_day >= 0.00, p_fine_per_day, 10.00);
    SET v_days_overdue = DATEDIFF(CURRENT_DATE, v_due_date);

    START TRANSACTION;
        UPDATE Book_Issues
           SET return_date = CURRENT_DATE
         WHERE issue_id = v_issue_id;

        UPDATE Book_Copies
           SET status = 'available'
         WHERE accession_no = p_accession_no;

        IF v_days_overdue > 0 THEN
            SET v_fine_amount = ROUND(v_days_overdue * v_fine_rate, 2);

            INSERT INTO Fines (
                issue_id,
                days_overdue,
                amount,
                status,
                assessed_date
            ) VALUES (
                v_issue_id,
                v_days_overdue,
                v_fine_amount,
                'unpaid',
                NOW()
            );

            SET v_fine_id = LAST_INSERT_ID();
        END IF;
    COMMIT;

    SELECT 
        v_issue_id AS issue_id,
        p_accession_no AS accession_no,
        v_member_id AS member_id,
        v_due_date AS due_date,
        CURRENT_DATE AS return_date,
        GREATEST(v_days_overdue, 0) AS days_overdue,
        v_fine_amount AS fine_assessed,
        v_fine_id AS fine_id,
        IF(v_days_overdue > 0, 'OVERDUE: Fine assessed and marked unpaid', 'SUCCESS: Book returned on time') AS status_message;

END proc_label$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- SECTION 3: SEED DATA INSERTION
-- ----------------------------------------------------------------------------
-- Clean Slate: All dummy accounts and books removed as requested.
-- Real books and student patrons are registered directly via the portal.

-- ----------------------------------------------------------------------------
-- SECTION 4: EXECUTE ANALYTICAL QUERIES
-- ----------------------------------------------------------------------------
SELECT '--- [ANALYTICAL QUERY 1: CURRENTLY OVERDUE BOOKS] ---' AS Query_Title;

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
    DATEDIFF(CURRENT_DATE, bi.due_date) AS days_overdue,
    ROUND(DATEDIFF(CURRENT_DATE, bi.due_date) * 10.00, 2) AS estimated_pending_fine_rupees
FROM Book_Issues bi
INNER JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
INNER JOIN Books b        ON bc.book_id = b.book_id
INNER JOIN Members m      ON bi.member_id = m.member_id
WHERE bi.return_date IS NULL
  AND bi.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;

SELECT '--- [ANALYTICAL QUERY 2: TOTAL UNPAID FINES PER STUDENT] ---' AS Query_Title;

SELECT 
    m.member_id,
    m.college_id AS student_id,
    m.name AS student_name,
    m.email AS student_email,
    COUNT(f.fine_id) AS unpaid_fines_count,
    SUM(f.amount) AS total_unpaid_amount
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
ORDER BY total_unpaid_amount DESC;
