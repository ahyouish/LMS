-- ============================================================================
-- COLLEGE LIBRARY MANAGEMENT SYSTEM (LMS)
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.5+
-- Schema Normalization: 3NF Compliant
-- File: schema.sql
-- Description: DDL table definitions, primary/foreign key constraints, 
--              check constraints, ENUMs, and performance indexes.
-- ============================================================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS library_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE library_db;

-- ----------------------------------------------------------------------------
-- Drop existing tables in reverse dependency order for clean migrations
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS Fines;
DROP TABLE IF EXISTS Book_Issues;
DROP TABLE IF EXISTS Book_Copies;
DROP TABLE IF EXISTS Members;
DROP TABLE IF EXISTS Books;

-- ----------------------------------------------------------------------------
-- 1. Books Table (Catalog Level Entity)
-- Stores bibliographic data for book titles.
-- 3NF: Contains only title-level metadata. Physical copies are separated.
-- ----------------------------------------------------------------------------
CREATE TABLE Books (
    book_id         INT AUTO_INCREMENT PRIMARY KEY,
    isbn            VARCHAR(20) NOT NULL UNIQUE,
    title           VARCHAR(255) NOT NULL,
    author          VARCHAR(255) NOT NULL,
    department      VARCHAR(100) NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_books_department (department),
    INDEX idx_books_title (title)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Book_Copies Table (Physical Inventory Entity)
-- Represents individual barcode/accession items of a cataloged book.
-- 3NF: book_id is FK. Tracks specific physical item availability independently.
-- ----------------------------------------------------------------------------
CREATE TABLE Book_Copies (
    accession_no    VARCHAR(50) PRIMARY KEY,
    book_id         INT NOT NULL,
    status          ENUM('available', 'issued', 'lost') NOT NULL DEFAULT 'available',
    acquired_date   DATE NOT NULL DEFAULT (CURRENT_DATE),
    
    -- Constraints
    CONSTRAINT fk_book_copies_book
        FOREIGN KEY (book_id) REFERENCES Books (book_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
        
    -- Indexes
    INDEX idx_copies_book_id (book_id),
    INDEX idx_copies_status (status)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Members Table (Library Patron Entity)
-- Stores student and faculty member accounts and borrow limits.
-- 3NF: Member attributes depend strictly on member_id (candidate key college_id/email).
-- ----------------------------------------------------------------------------
CREATE TABLE Members (
    member_id       INT AUTO_INCREMENT PRIMARY KEY,
    college_id      VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    member_type     ENUM('student', 'faculty') NOT NULL,
    max_books       INT NOT NULL DEFAULT 3,
    status          ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_members_max_books CHECK (max_books > 0),
    
    -- Indexes
    INDEX idx_members_status (status),
    INDEX idx_members_type (member_type)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Book_Issues Table (Circulation / Borrowing Transaction Entity)
-- Tracks checkout history, due dates, and return timestamps.
-- 3NF: return_date IS NULL indicates a currently unreturned/active borrow.
-- ----------------------------------------------------------------------------
CREATE TABLE Book_Issues (
    issue_id        INT AUTO_INCREMENT PRIMARY KEY,
    accession_no    VARCHAR(50) NOT NULL,
    member_id       INT NOT NULL,
    issue_date      DATE NOT NULL DEFAULT (CURRENT_DATE),
    due_date        DATE NOT NULL,
    return_date     DATE NULL DEFAULT NULL,
    
    -- Constraints
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
    
    -- Performance Indexes
    INDEX idx_issues_member (member_id),
    INDEX idx_issues_accession (accession_no),
    INDEX idx_issues_active_lookup (return_date, due_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Fines Table (Late Fee Assessment Entity)
-- 1-to-1 relationship with Book_Issues for circulation transactions with late returns.
-- 3NF: Depends on issue_id (unique). Calculates fee assessment status.
-- ----------------------------------------------------------------------------
CREATE TABLE Fines (
    fine_id         INT AUTO_INCREMENT PRIMARY KEY,
    issue_id        INT NOT NULL UNIQUE,
    days_overdue    INT NOT NULL,
    amount          DECIMAL(8, 2) NOT NULL,
    status          ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
    assessed_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_date       DATETIME NULL DEFAULT NULL,
    
    -- Constraints
    CONSTRAINT fk_fines_issue
        FOREIGN KEY (issue_id) REFERENCES Book_Issues (issue_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
        
    CONSTRAINT chk_fines_overdue CHECK (days_overdue > 0),
    CONSTRAINT chk_fines_amount CHECK (amount >= 0.00),
    
    -- Indexes
    INDEX idx_fines_status (status)
) ENGINE=InnoDB;
