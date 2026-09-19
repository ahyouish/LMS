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
-- Clean Slate: All dummy data removed as requested.
-- Real books and members are registered through the College Library LMS portal.
-- ----------------------------------------------------------------------------

