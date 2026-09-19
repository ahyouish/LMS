# Alexandria Academic - College Library Management System (LMS)

A complete, 3NF-compliant relational database and modern full-stack **Next.js web application** designed specifically for academic borrow/return circulation, inventory tracking, patron quota enforcement, and overdue fine collection.

---

## Table of Contents
1. [Relational Architecture & 3NF Schema](#relational-architecture--3nf-schema)
2. [Data Dictionary](#data-dictionary)
3. [Stored Procedures & Business Logic](#stored-procedures--business-logic)
4. [Seed Data & Sample Scenarios](#seed-data--sample-scenarios)
5. [Analytical & Reporting Queries](#analytical--reporting-queries)
6. [Next.js Web Application Features](#nextjs-web-application-features)
7. [Running the Application Locally](#running-the-application-locally)
8. [MySQL / MariaDB CLI Setup](#mysql--mariadb-cli-setup)

---

## Relational Architecture & 3NF Schema

The database strictly conforms to **Third Normal Form (3NF)**:
- **1NF**: All columns contain atomic, non-decomposable values with dedicated primary keys.
- **2NF**: All non-key attributes are fully functionally dependent on primary keys (no partial composite key dependencies).
- **3NF**: Eliminates transitive dependencies. Catalog bibliographic metadata (`Books`) is decoupled from physical barcode instances (`Book_Copies`), ensuring changing a title or author never impacts physical circulation records.

```
+--------------------+       1:N       +-------------------------+
|       BOOKS        | <-------------- |       BOOK_COPIES       |
+--------------------+                 +-------------------------+
| PK book_id         |                 | PK accession_no         |
| UQ isbn            |                 | FK book_id              |
|    title           |                 |    status (ENUM)        |
|    author          |                 +-------------------------+
|    department      |                              | 1
+--------------------+                              |
                                                    | 1:N
+--------------------+                 +-------------------------+
|      MEMBERS       |                 |       BOOK_ISSUES       |
+--------------------+                 +-------------------------+
| PK member_id       | 1               | PK issue_id             |
| UQ college_id      | <-------------- | FK accession_no         |
|    name            |      1:N        | FK member_id            |
| UQ email           |                 |    issue_date           |
|    member_type     |                 |    due_date             |
|    max_books       |                 |    return_date (NULL)   |
|    status (ENUM)   |                 +-------------------------+
+--------------------+                              | 1
                                                    |
                                                    | 1:1 (0..1)
                                       +-------------------------+
                                       |          FINES          |
                                       +-------------------------+
                                       | PK fine_id              |
                                       | FK, UQ issue_id         |
                                       |    days_overdue         |
                                       |    amount               |
                                       |    status (ENUM)        |
                                       +-------------------------+
```

---

## Data Dictionary

### 1. `Books`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `book_id` | `INT` / `INTEGER` | `PRIMARY KEY`, `AUTO_INCREMENT` | Unique internal book identifier |
| `isbn` | `VARCHAR(20)` | `UNIQUE`, `NOT NULL` | Standard International Book Number |
| `title` | `VARCHAR(255)` | `NOT NULL` | Title of the publication |
| `author` | `VARCHAR(255)` | `NOT NULL` | Primary author name(s) |
| `department` | `VARCHAR(100)` | `NOT NULL` | Academic department (CS, Electronics, etc.) |

### 2. `Book_Copies`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `accession_no` | `VARCHAR(50)` | `PRIMARY KEY` | Barcode identifier on physical item |
| `book_id` | `INT` | `FOREIGN KEY` &rarr; `Books(book_id)` | Catalog link |
| `status` | `ENUM` | `'available', 'issued', 'lost'` | Current shelf availability |
| `acquired_date` | `DATE` | `DEFAULT (CURRENT_DATE)` | Date added to library collection |

### 3. `Members`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `member_id` | `INT` / `INTEGER` | `PRIMARY KEY`, `AUTO_INCREMENT` | Internal patron ID |
| `college_id` | `VARCHAR(50)` | `UNIQUE`, `NOT NULL` | Campus student/faculty badge ID |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full patron name |
| `email` | `VARCHAR(100)` | `UNIQUE`, `NOT NULL` | College email address |
| `member_type` | `ENUM` | `'student', 'faculty'` | Patron role category |
| `max_books` | `INT` | `DEFAULT 3`, `CHECK(max_books > 0)` | Maximum simultaneous loan quota |
| `status` | `ENUM` | `'active', 'blocked'` | Patron account standing |

### 4. `Book_Issues`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `issue_id` | `INT` / `INTEGER` | `PRIMARY KEY`, `AUTO_INCREMENT` | Circulation transaction ID |
| `accession_no` | `VARCHAR(50)` | `FOREIGN KEY` &rarr; `Book_Copies` | Borrowed copy barcode |
| `member_id` | `INT` | `FOREIGN KEY` &rarr; `Members` | Borrower patron ID |
| `issue_date` | `DATE` | `NOT NULL` | Date book was checked out |
| `due_date` | `DATE` | `NOT NULL` | Date book must be returned |
| `return_date` | `DATE` | `NULL` | Return date timestamp (`NULL` = active loan) |

### 5. `Fines`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `fine_id` | `INT` / `INTEGER` | `PRIMARY KEY`, `AUTO_INCREMENT` | Fine assessment ID |
| `issue_id` | `INT` | `FOREIGN KEY` &rarr; `Book_Issues`, `UNIQUE` | Circulation transaction link |
| `days_overdue` | `INT` | `CHECK(days_overdue > 0)` | Days elapsed past `due_date` |
| `amount` | `DECIMAL(8,2)` | `CHECK(amount >= 0.00)` | Monetary fine penalty |
| `status` | `ENUM` | `'unpaid', 'paid'` | Payment settlement status |

---

## Stored Procedures & Business Logic

### `IssueBook(accession_no, member_id, loan_days)`
1. **Patron Verification**: Confirms member exists and is `'active'`. Rejects if member is `'blocked'`.
2. **Quota Check**: Calculates currently active unreturned loans (`return_date IS NULL`). Rejects if `count >= max_books`.
3. **Copy Availability Check**: Queries `Book_Copies` with row locking (`FOR UPDATE`). Rejects if copy is `'issued'` or `'lost'`.
4. **Atomic Transaction**:
   - Computes `due_date = CURRENT_DATE + loan_days` (default 14 days).
   - Inserts record into `Book_Issues`.
   - Sets `Book_Copies.status = 'issued'`.
   - Commits transaction atomically or rolls back on failure (`SIGNAL SQLSTATE '45000'`).

### `ReturnBook(accession_no, fine_per_day)`
1. **Active Record Lookup**: Identifies active issue for `accession_no` where `return_date IS NULL`.
2. **Timestamp & Restore**: Sets `return_date = CURRENT_DATE` and restores `Book_Copies.status = 'available'`.
3. **Overdue Fine Assessment**: Calculates `days_overdue = DATEDIFF(CURRENT_DATE, due_date)`. If `days_overdue > 0`:
   - Assesses fine = `days_overdue * fine_per_day` (default $2.00/day).
   - Inserts fine record into `Fines` with status `'unpaid'`.
   - Commits transaction atomically.

---

## Analytical & Reporting Queries

### Analytical Query 1: Currently Overdue Books with Borrower Contact Info
```sql
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
    DATEDIFF(CURRENT_DATE, bi.due_date) AS days_overdue,
    ROUND(DATEDIFF(CURRENT_DATE, bi.due_date) * 2.00, 2) AS estimated_pending_fine
FROM Book_Issues bi
INNER JOIN Book_Copies bc ON bi.accession_no = bc.accession_no
INNER JOIN Books b        ON bc.book_id = b.book_id
INNER JOIN Members m      ON bi.member_id = m.member_id
WHERE bi.return_date IS NULL
  AND bi.due_date < CURRENT_DATE
ORDER BY days_overdue DESC, bi.issue_date ASC;
```

### Analytical Query 2: Total Unpaid Fines Per Student
```sql
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
```

---

## Next.js Web Application Features

The included Next.js web application features:
- **Circulation Desk**: Issue and return books with real-time patron quota gauge and fine preview.
- **Overdue Loans Tab**: Live view of Analytical Query 1 with direct return action.
- **Student Fines Tab**: Live view of Analytical Query 2 with total liability summary.
- **Catalog & Inventory Browser**: Search by title, author, or ISBN; filter by department; inspect copy barcodes.
- **Patron Management**: Quota usage progress bars and instant Active/Blocked toggle to test procedure rules.
- **Vanilla CSS Glassmorphism Design**: Deep dark space theme with indigo and cyan neon accents.

---

## Running the Application Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the Next.js development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

3. **Run the Python SQLite verification suite** (runs headlessly in terminal):
   ```bash
   python verify_system.py
   ```

---

## MySQL / MariaDB CLI Setup

To set up the complete schema, stored procedures, seed data, and analytical queries on an external MySQL 8.0+ server:

```bash
mysql -u root -p < setup_all.sql
```
Or run modular scripts in order:
1. `mysql -u root -p < schema.sql`
2. `mysql -u root -p < procedures.sql`
3. `mysql -u root -p < seed_data.sql`
4. `mysql -u root -p < queries.sql`
