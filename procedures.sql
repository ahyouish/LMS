-- ============================================================================
-- COLLEGE LIBRARY MANAGEMENT SYSTEM (LMS)
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.5+
-- File: procedures.sql
-- Description: Stored procedures with atomic transactions and validation checks
--              1. IssueBook: Validates member eligibility, quota, and copy status.
--              2. ReturnBook: Stamps return date, frees copy, assesses late fines.
-- ============================================================================

USE library_db;

DROP PROCEDURE IF EXISTS IssueBook;
DROP PROCEDURE IF EXISTS ReturnBook;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- Stored Procedure: IssueBook
-- Parameters:
--   p_accession_no : VARCHAR(50) - Barcode / Accession ID of the physical copy
--   p_member_id    : INT         - Primary key ID of the borrowing member
--   p_loan_days    : INT         - Number of days allowed before return is due
-- Business Logic:
--   1. Validates that the member exists, is 'active', and not 'blocked'.
--   2. Verifies member has not reached their quota (max_books).
--   3. Verifies that the physical book copy exists and status is 'available'.
--   4. Atomically creates a Book_Issues record and marks Book_Copies as 'issued'.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE IssueBook(
    IN p_accession_no VARCHAR(50),
    IN p_member_id    INT,
    IN p_loan_days    INT
)
proc_label: BEGIN
    -- Local variables
    DECLARE v_member_status   VARCHAR(20);
    DECLARE v_max_books       INT;
    DECLARE v_active_issues   INT;
    DECLARE v_copy_status     VARCHAR(20);
    DECLARE v_loan_duration   INT;
    DECLARE v_due_date        DATE;
    DECLARE v_new_issue_id    INT;

    -- Exception handler for transactional rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- 1. Validate Member existence and status
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

    -- 2. Verify Member Borrowing Quota (active borrowings where return_date IS NULL)
    SELECT COUNT(*)
      INTO v_active_issues
      FROM Book_Issues
     WHERE member_id = p_member_id
       AND return_date IS NULL;

    IF v_active_issues >= v_max_books THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: Member has reached maximum borrowing quota.';
    END IF;

    -- 3. Verify Book Copy existence and availability
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

    -- Determine loan duration (default to 14 days if NULL or invalid)
    SET v_loan_duration = IF(p_loan_days IS NOT NULL AND p_loan_days > 0, p_loan_days, 14);
    SET v_due_date = DATE_ADD(CURRENT_DATE, INTERVAL v_loan_duration DAY);

    -- 4. Atomic Transaction: Record Issue and Update Copy Status
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

    -- Return execution summary
    SELECT 
        v_new_issue_id AS issue_id,
        p_accession_no AS accession_no,
        p_member_id AS member_id,
        CURRENT_DATE AS issue_date,
        v_due_date AS due_date,
        'SUCCESS: Book issued successfully' AS status_message;

END proc_label$$

-- ----------------------------------------------------------------------------
-- Stored Procedure: ReturnBook
-- Parameters:
--   p_accession_no  : VARCHAR(50)   - Barcode / Accession ID of returning copy
--   p_fine_per_day  : DECIMAL(8, 2) - Penalty fine charged per overdue day
-- Business Logic:
--   1. Finds the active issue record for the physical copy.
--   2. Sets return_date to CURRENT_DATE and updates copy status to 'available'.
--   3. Calculates days overdue (CURRENT_DATE - due_date).
--   4. If overdue (>0 days), creates an unpaid record in Fines table.
-- ----------------------------------------------------------------------------
CREATE PROCEDURE ReturnBook(
    IN p_accession_no  VARCHAR(50),
    IN p_fine_per_day  DECIMAL(8, 2)
)
proc_label: BEGIN
    -- Local variables
    DECLARE v_issue_id       INT;
    DECLARE v_member_id      INT;
    DECLARE v_due_date       DATE;
    DECLARE v_days_overdue   INT;
    DECLARE v_fine_rate      DECIMAL(8, 2);
    DECLARE v_fine_amount    DECIMAL(8, 2) DEFAULT 0.00;
    DECLARE v_fine_id        INT DEFAULT NULL;

    -- Exception handler for transactional rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- 1. Locate active borrowing record for this book copy
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

    -- Default fine rate to 10.00 rupees per day if unspecified or negative
    SET v_fine_rate = IF(p_fine_per_day IS NOT NULL AND p_fine_per_day >= 0.00, p_fine_per_day, 10.00);

    -- Calculate days overdue
    SET v_days_overdue = DATEDIFF(CURRENT_DATE, v_due_date);

    -- 2. Atomic Transaction: Update issue, restore copy availability, assess fine if overdue
    START TRANSACTION;

        -- Stamp return date
        UPDATE Book_Issues
           SET return_date = CURRENT_DATE
         WHERE issue_id = v_issue_id;

        -- Restore copy status
        UPDATE Book_Copies
           SET status = 'available'
         WHERE accession_no = p_accession_no;

        -- Check if return is overdue
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

    -- Return execution summary
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
