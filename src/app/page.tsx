'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Library, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Search, 
  ArrowRight, 
  BookMarked, 
  RefreshCw, 
  TrendingUp, 
  UserCheck, 
  UserX, 
  UserPlus, 
  LogIn, 
  LogOut, 
  GraduationCap, 
  Key, 
  Mail, 
  Lock, 
  PlusCircle, 
  Trash2 
} from 'lucide-react';

interface BookCopy {
  accession_no: string;
  book_id: number;
  status: 'available' | 'issued' | 'lost';
  acquired_date: string;
  due_date?: string;
  borrower_name?: string;
}

interface Book {
  book_id: number;
  isbn: string;
  title: string;
  author: string;
  department: string;
  copies: BookCopy[];
}

interface Member {
  member_id: number;
  college_id: string;
  name: string;
  email: string;
  department?: string;
  member_type: 'student' | 'faculty';
  max_books: number;
  status: 'active' | 'blocked';
  currently_issued_count: number;
  remaining_slots: number;
  total_unpaid_fines: number;
}

interface OverdueLoan {
  issue_id: number;
  accession_no: string;
  book_title: string;
  author: string;
  department: string;
  college_id: string;
  borrower_name: string;
  borrower_email: string;
  member_type: 'student' | 'faculty';
  member_status: 'active' | 'blocked';
  issue_date: string;
  due_date: string;
  days_overdue: number;
  estimated_pending_fine: number;
}

interface StudentFine {
  member_id: number;
  student_id: string;
  student_name: string;
  student_email: string;
  account_status: 'active' | 'blocked';
  unpaid_fines_count: number;
  total_unpaid_amount: number;
  max_days_overdue: number;
}

interface ActiveLoan {
  issue_id: number;
  accession_no: string;
  issue_date: string;
  due_date: string;
  book_title: string;
  department: string;
  member_id: number;
  college_id: string;
  borrower_name: string;
  member_type: 'student' | 'faculty';
  overdue_days: number;
}

interface UserSession {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'student' | 'faculty';
  college_id: string;
  department?: string;
  status: string;
  max_books?: number;
}

const ACADEMIC_DEPARTMENTS = [
  'Computer Science (CSE)',
  'Artificial Intelligence (AI)',
  'Electronics and Communication (ECE)',
  'Electronics and Computer (ESE)',
  'Electronics and Electrical (EEE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering (CE)',
] as const;

export default function CollegeLibraryApp() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Librarian Navigation Tab
  const [adminTab, setAdminTab] = useState<'circulation' | 'add-book' | 'register-student' | 'catalog' | 'members' | 'overdue' | 'fines'>('circulation');
  
  // Student Navigation Tab
  const [studentTab, setStudentTab] = useState<'my-loans' | 'my-fines' | 'catalog'>('my-loans');

  // Shared Data states
  const [summary, setSummary] = useState<any>({ totalBooks: 0, totalCopies: 0, activeLoans: 0, overdueCount: 0, totalUnpaidFines: 0 });
  const [catalog, setCatalog] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([]);
  const [studentFines, setStudentFines] = useState<StudentFine[]>([]);
  const [studentDashboard, setStudentDashboard] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Issue Form State (Librarian)
  const [selectedCopy, setSelectedCopy] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [loanDays, setLoanDays] = useState<number>(14);
  const [issueLoading, setIssueLoading] = useState<boolean>(false);
  const [issueFeedback, setIssueFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Return Form State (Librarian)
  const [returnCopy, setReturnCopy] = useState<string>('');
  const [fineRate, setFineRate] = useState<number>(10.00); // 10 Rupees per day
  const [returnLoading, setReturnLoading] = useState<boolean>(false);
  const [returnFeedback, setReturnFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Book Form State (Librarian)
  const [newBookTitle, setNewBookTitle] = useState<string>('');
  const [newBookAuthor, setNewBookAuthor] = useState<string>('');
  const [newBookIsbn, setNewBookIsbn] = useState<string>('');
  const [newBookDept, setNewBookDept] = useState<string>(ACADEMIC_DEPARTMENTS[0]);
  const [newBookCopies, setNewBookCopies] = useState<number>(2);
  const [newBookPrefix, setNewBookPrefix] = useState<string>('');
  const [addBookLoading, setAddBookLoading] = useState<boolean>(false);
  const [addBookFeedback, setAddBookFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Student Registration Form State (Librarian)
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentCollegeId, setNewStudentCollegeId] = useState<string>('');
  const [newStudentEmail, setNewStudentEmail] = useState<string>('');
  const [newStudentDept, setNewStudentDept] = useState<string>(ACADEMIC_DEPARTMENTS[0]);
  const [newStudentPassword, setNewStudentPassword] = useState<string>('student123');
  const [newStudentQuota, setNewStudentQuota] = useState<number>(3);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [registerFeedback, setRegisterFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Action status message for Member/Book actions
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('All');

  // Check initial session
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          setCurrentUser(d.user);
        }
      })
      .catch(console.error)
      .finally(() => setAuthChecking(false));
  }, []);

  // Load Librarian Data
  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, catRes, memRes, actRes, ovdRes, finRes] = await Promise.all([
        fetch('/api/system/summary').then(r => r.json()),
        fetch('/api/catalog').then(r => r.json()),
        fetch('/api/members').then(r => r.json()),
        fetch('/api/circulation/active').then(r => r.json()),
        fetch('/api/analytics/overdue').then(r => r.json()),
        fetch('/api/analytics/fines').then(r => r.json()),
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (catRes.success) setCatalog(catRes.data);
      if (memRes.success) setMembers(memRes.data);
      if (actRes.success) setActiveLoans(actRes.data);
      if (ovdRes.success) setOverdueLoans(ovdRes.data);
      if (finRes.success) setStudentFines(finRes.data);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Student Data
  const loadStudentData = useCallback(async (memberId: number) => {
    try {
      setLoading(true);
      const [dashRes, catRes] = await Promise.all([
        fetch(`/api/students/dashboard?memberId=${memberId}`).then(r => r.json()),
        fetch('/api/catalog').then(r => r.json())
      ]);

      if (dashRes.success) setStudentDashboard(dashRes.data);
      if (catRes.success) setCatalog(catRes.data);
    } catch (err) {
      console.error('Failed to load student data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        loadAdminData();
      } else {
        loadStudentData(currentUser.id);
      }
    }
  }, [currentUser, loadAdminData, loadStudentData]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword.trim() })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || 'Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Server connection error.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setStudentDashboard(null);
    setLoginEmail('');
    setLoginPassword('');
  };

  // Handle Librarian Add Book
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddBookLoading(true);
    setAddBookFeedback(null);

    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newBookTitle,
          author: newBookAuthor,
          isbn: newBookIsbn,
          department: newBookDept,
          numCopies: Number(newBookCopies),
          accessionPrefix: newBookPrefix || undefined
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAddBookFeedback({ type: 'success', text: data.message });
        setNewBookTitle('');
        setNewBookAuthor('');
        setNewBookIsbn('');
        setNewBookPrefix('');
        setNewBookCopies(2);
        loadAdminData();
      } else {
        setAddBookFeedback({ type: 'error', text: data.error || 'Failed to add book.' });
      }
    } catch (err: any) {
      setAddBookFeedback({ type: 'error', text: err.message });
    } finally {
      setAddBookLoading(false);
    }
  };

  // Handle Librarian Delete Book
  const handleDeleteBook = async (bookId: number, bookTitle: string) => {
    if (!confirm(`Are you sure you want to delete '${bookTitle}' and all its copies from the catalog?`)) return;

    try {
      const res = await fetch(`/api/catalog?bookId=${bookId}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionFeedback({ type: 'success', text: data.message });
        loadAdminData();
      } else {
        setActionFeedback({ type: 'error', text: data.error || 'Failed to delete book.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message });
    }
  };

  // Handle Librarian Register Student
  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterFeedback(null);

    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStudentName,
          collegeId: newStudentCollegeId,
          email: newStudentEmail,
          department: newStudentDept,
          password: newStudentPassword,
          maxBooks: newStudentQuota
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setRegisterFeedback({ type: 'success', text: data.message });
        setNewStudentName('');
        setNewStudentCollegeId('');
        setNewStudentEmail('');
        setNewStudentPassword('student123');
        loadAdminData();
      } else {
        setRegisterFeedback({ type: 'error', text: data.error || 'Registration failed.' });
      }
    } catch (err: any) {
      setRegisterFeedback({ type: 'error', text: err.message });
    } finally {
      setRegisterLoading(false);
    }
  };

  // Handle Librarian Delete Student Account
  const handleDeleteMember = async (memberId: number, memberName: string, collegeId: string) => {
    if (!confirm(`Are you sure you want to delete the student account for ${memberName} (${collegeId})?`)) return;

    try {
      const res = await fetch(`/api/members?memberId=${memberId}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionFeedback({ type: 'success', text: data.message });
        loadAdminData();
      } else {
        setActionFeedback({ type: 'error', text: data.error || 'Failed to delete student account.' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message });
    }
  };

  // Handle Issue Book (Librarian)
  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCopy || !selectedMember) {
      setIssueFeedback({ type: 'error', text: 'Please select both a book copy and a patron.' });
      return;
    }

    setIssueLoading(true);
    setIssueFeedback(null);

    try {
      const res = await fetch('/api/circulation/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessionNo: selectedCopy,
          memberId: Number(selectedMember),
          loanDays: Number(loanDays)
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIssueFeedback({
          type: 'success',
          text: `Success: Copy ${selectedCopy} issued to ${data.data.member_name}. Due date: ${data.data.due_date}.`
        });
        setSelectedCopy('');
        setSelectedMember('');
        loadAdminData();
      } else {
        setIssueFeedback({ type: 'error', text: data.error || 'Failed to issue book.' });
      }
    } catch (err: any) {
      setIssueFeedback({ type: 'error', text: err.message });
    } finally {
      setIssueLoading(false);
    }
  };

  // Handle Return Book (Librarian)
  const handleReturnBook = async (accessionToReturn?: string) => {
    const copyToProcess = accessionToReturn || returnCopy;
    if (!copyToProcess) {
      setReturnFeedback({ type: 'error', text: 'Please select a book copy to return.' });
      return;
    }

    setReturnLoading(true);
    setReturnFeedback(null);

    try {
      const res = await fetch('/api/circulation/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessionNo: copyToProcess,
          finePerDay: Number(fineRate)
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const d = data.data;
        let msg = `Success: Copy ${copyToProcess} returned to inventory.`;
        if (d.is_overdue) {
          msg += ` OVERDUE by ${d.days_overdue} days. Fine assessed: ₹${d.fine.amount.toFixed(2)} (Status: unpaid).`;
        } else {
          msg += ' Returned on time (₹0.00 fine).';
        }
        setReturnFeedback({ type: 'success', text: msg });
        setReturnCopy('');
        loadAdminData();
      } else {
        setReturnFeedback({ type: 'error', text: data.error || 'Failed to return book.' });
      }
    } catch (err: any) {
      setReturnFeedback({ type: 'error', text: err.message });
    } finally {
      setReturnLoading(false);
    }
  };

  // Toggle member active/blocked (Librarian)
  const handleToggleMemberStatus = async (memberId: number, currentStatus: 'active' | 'blocked') => {
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      const res = await fetch('/api/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, status: nextStatus })
      });
      if (res.ok) {
        loadAdminData();
      }
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  // Available copies list for dropdown
  const availableCopies = catalog.flatMap(b => 
    b.copies.filter(c => c.status === 'available').map(c => ({
      accession_no: c.accession_no,
      title: b.title,
      department: b.department
    }))
  );

  const departments = ['All', ...ACADEMIC_DEPARTMENTS];

  const filteredCatalog = catalog.filter(b => {
    const matchesDept = deptFilter === 'All' || b.department === deptFilter;
    const matchesQuery = 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.copies.some(c => c.accession_no.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDept && matchesQuery;
  });

  if (authChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen text-blue-600">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="font-semibold">Loading College Library LMS...</span>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 1: LOGIN SCREEN (CREDENTIALS ONLY)
  // ==========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-8 relative">
          <div className="text-center mb-6">
            <div className="crest-badge mx-auto mb-3">
              <Library size={26} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              College Library <span className="text-blue-600">LMS</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
              Student & Staff Sign In
            </p>
          </div>

          {loginError && (
            <div className="alert alert-error mb-5">
              <XCircle size={18} className="shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="login-email">
                <Mail size={14} className="inline mr-1 text-blue-600" /> Email Address or College ID
              </label>
              <input
                id="login-email"
                type="text"
                className="form-control"
                placeholder="name@college.edu or College ID (e.g. STU101)"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="login-password">
                <Lock size={14} className="inline mr-1 text-blue-600" /> Password
              </label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn btn-primary w-full justify-center py-2.5 text-base font-semibold shadow-md"
              id="btn-login"
            >
              <LogIn size={18} />
              {loginLoading ? 'Signing In...' : 'Sign In to LMS'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: LOGGED IN APP (LIBRARIAN ADMIN vs. STUDENT PATRON)
  // ==========================================================================
  return (
    <div className="container">
      {/* College LMS Header */}
      <header className="header">
        <div className="brand-section">
          <div className="crest-badge" id="app-logo">
            <Library size={26} />
          </div>
          <div>
            <h1 className="brand-title">
              College Library <span>LMS</span>
            </h1>
            <p className="brand-subtitle">
              {currentUser.role === 'admin' 
                ? 'Library Staff Portal • Issue, Return & Manage Books' 
                : `Student Portal • ${currentUser.department || 'Academic'} Department`}
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="header-actions">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            {currentUser.role === 'admin' ? (
              <span className="badge badge-admin">
                <Key size={12} /> Librarian
              </span>
            ) : (
              <span className="badge badge-student">
                <GraduationCap size={12} /> Student
              </span>
            )}
            <div className="text-left leading-tight pr-1">
              <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
              <div className="text-[11px] text-slate-500 font-mono">{currentUser.college_id}</div>
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            className="btn btn-outline-danger text-xs"
            id="btn-logout"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      {actionFeedback && (
        <div className={`alert alert-${actionFeedback.type} mb-5`}>
          {actionFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* ====================================================================
          ROLE A: LIBRARIAN / ADMIN PORTAL
          ==================================================================== */}
      {currentUser.role === 'admin' && (
        <>
          {/* KPI Stats */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Total Books</div>
                <div className="stat-val">{summary.totalBooks}</div>
              </div>
              <div className="stat-icon"><BookOpen size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Total Copies</div>
                <div className="stat-val">{summary.totalCopies}</div>
              </div>
              <div className="stat-icon"><BookMarked size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Issued Books</div>
                <div className="stat-val">{summary.activeLoans}</div>
              </div>
              <div className="stat-icon"><TrendingUp size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Overdue Books</div>
                <div className="stat-val text-rose-600">
                  {summary.overdueCount} {summary.overdueCount > 0 && <span className="pulse-dot pulse-red ml-1"></span>}
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#fff1f2', color: '#e11d48' }}><AlertTriangle size={22} /></div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Unpaid Fines (₹10/day)</div>
                <div className="stat-val text-slate-900">₹{summary.totalUnpaidFines?.toFixed(2) || '0.00'}</div>
              </div>
              <div className="stat-icon" style={{ background: '#f8fafc', color: '#0f172a' }}>
                <span className="font-bold text-lg">₹</span>
              </div>
            </div>
          </section>

          {/* Librarian Nav Tabs */}
          <nav className="nav-tabs" role="tablist">
            <button 
              className={`nav-tab ${adminTab === 'circulation' ? 'active' : ''}`}
              onClick={() => { setAdminTab('circulation'); setActionFeedback(null); }}
              id="tab-circulation"
            >
              <RotateCcw size={16} />
              Issue & Return
              <span className="tab-badge">{activeLoans.length}</span>
            </button>

            <button 
              className={`nav-tab ${adminTab === 'add-book' ? 'active' : ''}`}
              onClick={() => { setAdminTab('add-book'); setActionFeedback(null); }}
              id="tab-add-book"
            >
              <PlusCircle size={16} />
              Add Books
            </button>

            <button 
              className={`nav-tab ${adminTab === 'register-student' ? 'active' : ''}`}
              onClick={() => { setAdminTab('register-student'); setActionFeedback(null); }}
              id="tab-register-student"
            >
              <UserPlus size={16} />
              Register Student
            </button>

            <button 
              className={`nav-tab ${adminTab === 'catalog' ? 'active' : ''}`}
              onClick={() => { setAdminTab('catalog'); setActionFeedback(null); }}
              id="tab-catalog"
            >
              <BookOpen size={16} />
              Book Catalog
              <span className="tab-badge">{catalog.length}</span>
            </button>

            <button 
              className={`nav-tab ${adminTab === 'members' ? 'active' : ''}`}
              onClick={() => { setAdminTab('members'); setActionFeedback(null); }}
              id="tab-members"
            >
              <Users size={16} />
              Student List
              <span className="tab-badge">{members.length}</span>
            </button>

            <button 
              className={`nav-tab ${adminTab === 'overdue' ? 'active' : ''}`}
              onClick={() => { setAdminTab('overdue'); setActionFeedback(null); }}
              id="tab-overdue"
            >
              <AlertTriangle size={16} />
              Overdue Books
              {overdueLoans.length > 0 && (
                <span className="tab-badge" style={{ background: '#fecdd3', color: '#9f1239' }}>{overdueLoans.length}</span>
              )}
            </button>

            <button 
              className={`nav-tab ${adminTab === 'fines' ? 'active' : ''}`}
              onClick={() => { setAdminTab('fines'); setActionFeedback(null); }}
              id="tab-fines"
            >
              <span className="font-bold text-sm">₹</span>
              Pending Fines
              <span className="tab-badge">{studentFines.length}</span>
            </button>
          </nav>

          {/* TAB 1: ISSUE & RETURN */}
          {adminTab === 'circulation' && (
            <section>
              <div className="circulation-grid">
                {/* Issue Book Panel */}
                <div className="glass-card" id="panel-issue-book">
                  <div className="card-header">
                    <div className="card-title-group">
                      <h2><BookOpen size={20} className="text-blue-600" /> Issue a Book</h2>
                      <p className="card-subtitle">Select an available book copy and a student to issue.</p>
                    </div>
                  </div>

                  {issueFeedback && (
                    <div className={`alert alert-${issueFeedback.type}`}>
                      {issueFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <span>{issueFeedback.text}</span>
                    </div>
                  )}

                  {availableCopies.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-500">
                      <BookOpen size={32} className="mx-auto text-slate-400 mb-2" />
                      <p className="font-medium text-slate-700">No books currently available in the library.</p>
                      <p className="text-xs mt-1">Please add books first using the <strong>Add Books</strong> tab.</p>
                      <button 
                        onClick={() => setAdminTab('add-book')} 
                        className="btn btn-primary mt-3 text-xs"
                      >
                        <PlusCircle size={14} /> Add Books
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleIssueBook}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="select-copy">Select Book Copy</label>
                        <select 
                          id="select-copy"
                          className="form-control form-select"
                          value={selectedCopy}
                          onChange={e => setSelectedCopy(e.target.value)}
                          required
                        >
                          <option value="">-- Choose Available Book Copy --</option>
                          {availableCopies.map(c => (
                            <option key={c.accession_no} value={c.accession_no}>
                              {c.accession_no} • {c.title} ({c.department})
                            </option>
                          ))}
                        </select>
                        <div className="form-help">
                          {availableCopies.length} copies currently available in library.
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="select-member">Select Student</label>
                        <select 
                          id="select-member"
                          className="form-control form-select"
                          value={selectedMember}
                          onChange={e => setSelectedMember(e.target.value)}
                          required
                        >
                          <option value="">-- Choose Student --</option>
                          {members.map(m => (
                            <option key={m.member_id} value={m.member_id}>
                              {m.name} ({m.college_id}) • [{m.currently_issued_count}/{m.max_books} books borrowed] {m.status === 'blocked' ? '⚠️ BLOCKED' : ''}
                            </option>
                          ))}
                        </select>
                        <div className="form-help">
                          {members.length === 0 
                            ? 'No registered students yet. Please use the Register Student tab.' 
                            : 'Students who have reached their borrowing limit or are blocked cannot borrow.'}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="input-loan-days">Loan Duration (Days)</label>
                        <input 
                          type="number"
                          id="input-loan-days"
                          className="form-control"
                          value={loanDays}
                          min="1"
                          max="60"
                          onChange={e => setLoanDays(parseInt(e.target.value) || 14)}
                          required
                        />
                      </div>

                      <button 
                        type="submit" 
                        className="btn btn-primary w-full justify-center"
                        disabled={issueLoading || availableCopies.length === 0 || members.length === 0}
                        id="btn-submit-issue"
                      >
                        <ArrowRight size={18} />
                        {issueLoading ? 'Issuing Book...' : 'Issue Book'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Return Book Panel */}
                <div className="glass-card" id="panel-return-book">
                  <div className="card-header">
                    <div className="card-title-group">
                      <h2><RotateCcw size={20} className="text-blue-600" /> Return a Book</h2>
                      <p className="card-subtitle">Select an issued book copy to mark it returned and calculate any late fine.</p>
                    </div>
                  </div>

                  {returnFeedback && (
                    <div className={`alert alert-${returnFeedback.type}`}>
                      {returnFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <span>{returnFeedback.text}</span>
                    </div>
                  )}

                  {activeLoans.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-500">
                      <Clock size={32} className="mx-auto text-slate-400 mb-2" />
                      <p className="font-medium text-slate-700">No books currently borrowed.</p>
                      <p className="text-xs mt-1">When books are checked out to students, they can be returned here.</p>
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleReturnBook(); }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="select-return-copy">Book Copy to Return</label>
                        <select 
                          id="select-return-copy"
                          className="form-control form-select"
                          value={returnCopy}
                          onChange={e => setReturnCopy(e.target.value)}
                          required
                        >
                          <option value="">-- Choose Issued Book Copy --</option>
                          {activeLoans.map(loan => (
                            <option key={loan.accession_no} value={loan.accession_no}>
                              {loan.accession_no} • {loan.book_title} (Student: {loan.borrower_name}) {loan.overdue_days > 0 ? `⚠️ ${loan.overdue_days}d OVERDUE` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="input-fine-rate">Fine Rate per Overdue Day (₹)</label>
                        <input 
                          type="number"
                          step="1"
                          id="input-fine-rate"
                          className="form-control"
                          value={fineRate}
                          min="0"
                          max="500"
                          onChange={e => setFineRate(parseFloat(e.target.value) || 10.00)}
                          required
                        />
                        <div className="form-help">Default late fine is ₹10 per day (e.g. 10 days = ₹100).</div>
                      </div>

                      {returnCopy && (() => {
                        const match = activeLoans.find(l => l.accession_no === returnCopy);
                        if (match && match.overdue_days > 0) {
                          return (
                            <div className="alert alert-error mb-4">
                              <AlertTriangle size={18} />
                              <div>
                                <strong>Overdue Book:</strong> {match.overdue_days} days late. Fine will be <strong>₹{(match.overdue_days * fineRate).toFixed(2)}</strong>.
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <button 
                        type="submit" 
                        className="btn btn-secondary w-full justify-center border-slate-300"
                        disabled={returnLoading}
                        id="btn-submit-return"
                      >
                        <CheckCircle2 size={18} />
                        {returnLoading ? 'Processing Return...' : 'Confirm Book Return'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Active Loans Table */}
              <div className="glass-card">
                <div className="card-header">
                  <div className="card-title-group">
                    <h2><Clock size={20} className="text-blue-600" /> Currently Issued Books</h2>
                    <p className="card-subtitle">List of all books currently borrowed by students.</p>
                  </div>
                </div>

                {activeLoans.length === 0 ? (
                  <div className="empty-state">
                    <BookOpen className="empty-state-icon" />
                    <h3 className="text-base font-semibold text-slate-700">No Books Currently Issued</h3>
                    <p className="text-sm text-slate-500 mt-1">All books are currently in the library.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Copy ID</th>
                          <th>Book Title</th>
                          <th>Department</th>
                          <th>Student</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLoans.map(loan => (
                          <tr key={loan.issue_id}>
                            <td className="mono font-bold text-blue-600">{loan.accession_no}</td>
                            <td className="font-semibold text-slate-900">{loan.book_title}</td>
                            <td><span className="badge badge-faculty">{loan.department}</span></td>
                            <td>{loan.borrower_name} <span className="mono text-xs text-slate-500">({loan.college_id})</span></td>
                            <td className="mono">{loan.due_date}</td>
                            <td>
                              {loan.overdue_days > 0 ? (
                                <span className="badge badge-overdue">
                                  <AlertTriangle size={12} /> {loan.overdue_days}d Overdue (₹{loan.overdue_days * 10})
                                </span>
                              ) : (
                                <span className="badge badge-available">
                                  <CheckCircle2 size={12} /> On Track
                                </span>
                              )}
                            </td>
                            <td>
                              <button 
                                className="btn btn-secondary py-1 px-3 text-xs"
                                onClick={() => handleReturnBook(loan.accession_no)}
                              >
                                Return
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 2: ADD NEW BOOK */}
          {adminTab === 'add-book' && (
            <section className="glass-card max-w-2xl mx-auto" id="panel-add-book">
              <div className="card-header">
                <div className="card-title-group">
                  <h2 className="text-xl text-slate-900 flex items-center gap-2">
                    <PlusCircle size={22} className="text-blue-600" /> Add New Book
                  </h2>
                  <p className="card-subtitle">
                    Enter book details and choose how many copies to add to the library.
                  </p>
                </div>
              </div>

              {addBookFeedback && (
                <div className={`alert alert-${addBookFeedback.type}`}>
                  {addBookFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  <span>{addBookFeedback.text}</span>
                </div>
              )}

              <form onSubmit={handleAddBook} className="space-y-4">
                <div>
                  <label className="form-label" htmlFor="new-book-title">Book Title</label>
                  <input
                    id="new-book-title"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Operating System Concepts"
                    value={newBookTitle}
                    onChange={e => setNewBookTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="new-book-author">Author(s)</label>
                    <input
                      id="new-book-author"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Silberschatz, Galvin"
                      value={newBookAuthor}
                      onChange={e => setNewBookAuthor(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" htmlFor="new-book-isbn">ISBN Number</label>
                    <input
                      id="new-book-isbn"
                      type="text"
                      className="form-control mono"
                      placeholder="e.g. 978-0132576277"
                      value={newBookIsbn}
                      onChange={e => setNewBookIsbn(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="new-book-dept">Academic Department</label>
                    <select
                      id="new-book-dept"
                      className="form-control form-select"
                      value={newBookDept}
                      onChange={e => setNewBookDept(e.target.value)}
                      required
                    >
                      {ACADEMIC_DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" htmlFor="new-book-copies">Number of Copies</label>
                    <input
                      id="new-book-copies"
                      type="number"
                      className="form-control"
                      value={newBookCopies}
                      min="1"
                      max="50"
                      onChange={e => setNewBookCopies(parseInt(e.target.value) || 1)}
                      required
                    />
                    <div className="form-help">Number of copies to create for this book.</div>
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="new-book-prefix">
                    Copy ID Prefix (Optional)
                  </label>
                  <input
                    id="new-book-prefix"
                    type="text"
                    className="form-control mono"
                    placeholder="e.g. ACC-CSE (Leave blank to use department code automatically)"
                    value={newBookPrefix}
                    onChange={e => setNewBookPrefix(e.target.value)}
                  />
                  <div className="form-help">
                    Copies will be numbered automatically (e.g. <code>ACC-CSE-001</code>, <code>ACC-CSE-002</code>).
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addBookLoading}
                  className="btn btn-primary w-full justify-center py-2.5 text-base font-semibold"
                  id="btn-add-book-submit"
                >
                  <PlusCircle size={18} />
                  {addBookLoading ? 'Adding Book...' : 'Add Book & Create Copies'}
                </button>
              </form>
            </section>
          )}

          {/* TAB 3: REGISTER STUDENT */}
          {adminTab === 'register-student' && (
            <section className="glass-card max-w-2xl mx-auto" id="panel-register-student">
              <div className="card-header">
                <div className="card-title-group">
                  <h2 className="text-xl text-slate-900 flex items-center gap-2">
                    <UserPlus size={22} className="text-blue-600" /> Register a Student
                  </h2>
                  <p className="card-subtitle">
                    Add a student account so they can borrow books and log into their portal.
                  </p>
                </div>
              </div>

              {registerFeedback && (
                <div className={`alert alert-${registerFeedback.type}`}>
                  {registerFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  <span>{registerFeedback.text}</span>
                </div>
              )}

              <form onSubmit={handleRegisterStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="new-student-name">Full Name</label>
                    <input
                      id="new-student-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Priya Sharma"
                      value={newStudentName}
                      onChange={e => setNewStudentName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" htmlFor="new-student-id">College ID (Roll Number)</label>
                    <input
                      id="new-student-id"
                      type="text"
                      className="form-control"
                      placeholder="e.g. STU-2024-001"
                      value={newStudentCollegeId}
                      onChange={e => setNewStudentCollegeId(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="new-student-email">Email (Used for Login)</label>
                    <input
                      id="new-student-email"
                      type="email"
                      className="form-control"
                      placeholder="e.g. student@college.edu"
                      value={newStudentEmail}
                      onChange={e => setNewStudentEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" htmlFor="new-student-dept">Academic Department</label>
                    <select
                      id="new-student-dept"
                      className="form-control form-select"
                      value={newStudentDept}
                      onChange={e => setNewStudentDept(e.target.value)}
                      required
                    >
                      {ACADEMIC_DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="new-student-password">Login Password</label>
                    <input
                      id="new-student-password"
                      type="text"
                      className="form-control font-mono"
                      placeholder="student123"
                      value={newStudentPassword}
                      onChange={e => setNewStudentPassword(e.target.value)}
                      required
                    />
                    <div className="form-help">The student will use this password to sign in.</div>
                  </div>

                  <div>
                    <label className="form-label" htmlFor="new-student-quota">Max Books Allowed</label>
                    <input
                      id="new-student-quota"
                      type="number"
                      className="form-control"
                      value={newStudentQuota}
                      min="1"
                      max="10"
                      onChange={e => setNewStudentQuota(parseInt(e.target.value) || 3)}
                      required
                    />
                    <div className="form-help">Standard limit is 3 books per student.</div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={registerLoading}
                  className="btn btn-primary w-full justify-center py-2.5 text-base font-semibold"
                  id="btn-register-student-submit"
                >
                  <UserPlus size={18} />
                  {registerLoading ? 'Creating Student Account...' : 'Register Student'}
                </button>
              </form>
            </section>
          )}

          {/* TAB 4: BOOK CATALOG */}
          {adminTab === 'catalog' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2><BookOpen size={20} className="text-blue-600" /> Book Catalog</h2>
                  <p className="card-subtitle">View all library books, copies, and real-time shelf availability.</p>
                </div>
                <button 
                  className="btn btn-primary text-xs" 
                  onClick={() => setAdminTab('add-book')}
                >
                  <PlusCircle size={14} /> Add New Book
                </button>
              </div>

              <div className="search-filter-bar">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text"
                    className="search-input"
                    placeholder="Search by Title, Author, ISBN, or Copy ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  {departments.map(dept => (
                    <button
                      key={dept}
                      className={`btn ${deptFilter === dept ? 'btn-primary' : 'btn-secondary'} py-1.5 px-3 text-xs`}
                      onClick={() => setDeptFilter(dept)}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {filteredCatalog.length === 0 ? (
                <div className="empty-state">
                  <BookOpen className="empty-state-icon" />
                  <h3 className="text-base font-semibold text-slate-700">No Books in Catalog</h3>
                  <p className="text-sm text-slate-500 mt-1">Click 'Add New Book' to add your first book to the library.</p>
                  <button 
                    onClick={() => setAdminTab('add-book')} 
                    className="btn btn-primary mt-3 text-xs"
                  >
                    <PlusCircle size={14} /> Add New Book
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCatalog.map(book => (
                    <div key={book.book_id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{book.title}</h3>
                            <span className="badge badge-faculty">{book.department}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">By {book.author} • ISBN: {book.isbn}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="badge badge-available">
                            {book.copies.filter(c => c.status === 'available').length} of {book.copies.length} Available
                          </span>
                          <button
                            className="btn btn-outline-danger py-1 px-2.5 text-xs"
                            onClick={() => handleDeleteBook(book.book_id, book.title)}
                            title="Delete this book from catalog"
                          >
                            <Trash2 size={12} /> Delete Book
                          </button>
                        </div>
                      </div>

                      <div className="copies-tags">
                        {book.copies.map(copy => (
                          <div key={copy.accession_no} className={`copy-tag badge-${copy.status}`}>
                            <span>{copy.accession_no}</span>
                            <span className="opacity-75 text-[11px]">({copy.status})</span>
                            {copy.status === 'available' && (
                              <button
                                className="underline ml-1 cursor-pointer text-blue-700 font-medium"
                                onClick={() => {
                                  setSelectedCopy(copy.accession_no);
                                  setAdminTab('circulation');
                                }}
                              >
                                Issue →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 5: STUDENT LIST */}
          {adminTab === 'members' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2><Users size={20} className="text-blue-600" /> Student List</h2>
                  <p className="card-subtitle">View registered students, check borrowed books, block/unblock, or delete student accounts.</p>
                </div>
                <button 
                  className="btn btn-primary text-xs" 
                  onClick={() => setAdminTab('register-student')}
                >
                  <UserPlus size={14} /> Register Student
                </button>
              </div>

              {members.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-state-icon" />
                  <h3 className="text-base font-semibold text-slate-700">No Students Registered</h3>
                  <p className="text-sm text-slate-500 mt-1">Register students using the 'Register Student' tab so they can borrow books and log in.</p>
                  <button 
                    onClick={() => setAdminTab('register-student')} 
                    className="btn btn-primary mt-3 text-xs"
                  >
                    <UserPlus size={14} /> Register Student
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>College ID</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Role</th>
                        <th>Books Borrowed / Limit</th>
                        <th>Unpaid Fines</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => {
                        const percentage = Math.round((m.currently_issued_count / m.max_books) * 100);
                        const fillColor = percentage >= 100 ? 'red' : percentage >= 60 ? 'yellow' : 'green';

                        return (
                          <tr key={m.member_id}>
                            <td className="mono text-blue-600 font-bold">{m.college_id}</td>
                            <td className="font-semibold text-slate-900">{m.name}</td>
                            <td><a href={`mailto:${m.email}`} className="text-slate-600">{m.email}</a></td>
                            <td><span className="badge badge-faculty">{m.department || 'General'}</span></td>
                            <td><span className={`badge badge-${m.member_type}`}>{m.member_type}</span></td>
                            <td>
                              <div className="quota-bar-wrapper">
                                <div className="quota-progress">
                                  <div className={`quota-fill quota-fill-${fillColor}`} style={{ width: `${Math.min(100, percentage)}%` }}></div>
                                </div>
                                <span className="mono text-xs">{m.currently_issued_count}/{m.max_books}</span>
                              </div>
                            </td>
                            <td>
                              {m.total_unpaid_fines > 0 ? (
                                <span className="badge badge-overdue mono">₹{m.total_unpaid_fines.toFixed(2)}</span>
                              ) : (
                                <span className="mono text-slate-500">₹0.00</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge badge-${m.status}`}>
                                {m.status === 'blocked' ? <UserX size={12} /> : <UserCheck size={12} />}
                                {m.status}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button
                                  className={`btn ${m.status === 'active' ? 'btn-secondary' : 'btn-primary'} py-1 px-2 text-xs`}
                                  onClick={() => handleToggleMemberStatus(m.member_id, m.status)}
                                >
                                  {m.status === 'active' ? 'Block' : 'Unblock'}
                                </button>
                                <button
                                  className="btn btn-outline-danger py-1 px-2 text-xs"
                                  onClick={() => handleDeleteMember(m.member_id, m.name, m.college_id)}
                                  title="Delete this student account"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* TAB 6: OVERDUE BOOKS */}
          {adminTab === 'overdue' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2><AlertTriangle size={22} className="text-rose-600" /> Overdue Books</h2>
                  <p className="card-subtitle">Books that have not been returned on time and are accumulating late fines.</p>
                </div>
              </div>

              {overdueLoans.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 className="empty-state-icon text-emerald-600" />
                  <h3 className="text-base font-semibold text-slate-700">No Overdue Books</h3>
                  <p className="text-sm text-slate-500 mt-1">All borrowed books are currently within their allowed return dates.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Copy ID</th>
                        <th>Book Title</th>
                        <th>Student Name</th>
                        <th>College ID</th>
                        <th>Email</th>
                        <th>Due Date</th>
                        <th>Days Late</th>
                        <th>Fine (₹10/day)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueLoans.map(item => (
                        <tr key={item.issue_id}>
                          <td className="mono text-rose-600 font-bold">{item.accession_no}</td>
                          <td className="font-semibold text-slate-900">{item.book_title}</td>
                          <td>{item.borrower_name}</td>
                          <td className="mono">{item.college_id}</td>
                          <td><a href={`mailto:${item.borrower_email}`} className="text-blue-600">{item.borrower_email}</a></td>
                          <td className="mono text-rose-600">{item.due_date}</td>
                          <td><span className="badge badge-overdue">{item.days_overdue} days late</span></td>
                          <td className="mono text-slate-900 font-bold">₹{item.estimated_pending_fine?.toFixed(2)}</td>
                          <td>
                            <button 
                              className="btn btn-danger py-1 px-3 text-xs"
                              onClick={() => {
                                handleReturnBook(item.accession_no);
                                setAdminTab('circulation');
                              }}
                            >
                              Return
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* TAB 7: PENDING FINES */}
          {adminTab === 'fines' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2>
                    <span className="text-blue-600 font-bold text-xl mr-1">₹</span> 
                    Pending Student Fines
                  </h2>
                  <p className="card-subtitle">Total unpaid fines grouped by student.</p>
                </div>
              </div>

              {studentFines.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 className="empty-state-icon text-emerald-600" />
                  <h3 className="text-base font-semibold text-slate-700">No Pending Fines</h3>
                  <p className="text-sm text-slate-500 mt-1">All student fines are cleared or no fines have been issued.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Unpaid Fines</th>
                        <th>Days Late</th>
                        <th>Total Fine (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentFines.map(sf => (
                        <tr key={sf.member_id}>
                          <td className="mono text-blue-600 font-bold">{sf.student_id}</td>
                          <td className="font-semibold text-slate-900">{sf.student_name}</td>
                          <td><a href={`mailto:${sf.student_email}`} className="text-slate-600">{sf.student_email}</a></td>
                          <td><span className={`badge badge-${sf.account_status}`}>{sf.account_status}</span></td>
                          <td><span className="badge badge-overdue">{sf.unpaid_fines_count} unpaid</span></td>
                          <td className="mono">{sf.max_days_overdue} days</td>
                          <td className="mono text-rose-600 font-bold text-base">₹{sf.total_unpaid_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ====================================================================
          ROLE B: STUDENT PORTAL
          ==================================================================== */}
      {currentUser.role === 'student' && studentDashboard && (
        <>
          {/* Student Welcome Banner */}
          <div className="glass-card mb-6 bg-gradient-to-r from-blue-50 to-white border border-blue-200">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="badge badge-student mb-2">
                  <GraduationCap size={12} /> Student Account
                </span>
                <h2 className="text-2xl font-bold text-slate-900">
                  Welcome, <span className="text-blue-600">{currentUser.name}</span>
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  College ID: <span className="mono font-semibold text-blue-700">{currentUser.college_id}</span> &bull; Department: <strong>{currentUser.department}</strong>
                </p>
              </div>

              <div className="flex gap-4">
                <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm text-center min-w-[120px]">
                  <div className="text-xs uppercase text-slate-500 font-semibold">Borrowed Books</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {studentDashboard.usedQuota} / {currentUser.max_books || 3}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm text-center min-w-[120px]">
                  <div className="text-xs uppercase text-slate-500 font-semibold">Unpaid Fines</div>
                  <div className={`text-2xl font-bold ${studentDashboard.totalUnpaidFines > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{studentDashboard.totalUnpaidFines.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Student Navigation Tabs */}
          <nav className="nav-tabs" role="tablist">
            <button 
              className={`nav-tab ${studentTab === 'my-loans' ? 'active' : ''}`}
              onClick={() => setStudentTab('my-loans')}
              id="student-tab-loans"
            >
              <BookOpen size={16} />
              My Borrowed Books
              <span className="tab-badge">{studentDashboard.activeLoans.length}</span>
            </button>

            <button 
              className={`nav-tab ${studentTab === 'my-fines' ? 'active' : ''}`}
              onClick={() => setStudentTab('my-fines')}
              id="student-tab-fines"
            >
              <span className="font-bold text-sm">₹</span>
              My Fines
              <span className="tab-badge">{studentDashboard.fines.length}</span>
            </button>

            <button 
              className={`nav-tab ${studentTab === 'catalog' ? 'active' : ''}`}
              onClick={() => setStudentTab('catalog')}
              id="student-tab-catalog"
            >
              <Search size={16} />
              Browse Books
              <span className="tab-badge">{catalog.length}</span>
            </button>
          </nav>

          {/* STUDENT TAB 1: MY BORROWED BOOKS */}
          {studentTab === 'my-loans' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2><Clock size={20} className="text-blue-600" /> My Borrowed Books</h2>
                  <p className="card-subtitle">Keep track of due dates to return books on time and avoid late fines (₹10/day).</p>
                </div>
              </div>

              {studentDashboard.activeLoans.length === 0 ? (
                <div className="empty-state">
                  <BookOpen className="empty-state-icon" />
                  <h3 className="text-lg font-bold text-slate-800">You have no borrowed books right now</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Visit the library to borrow books using your College ID <span className="text-blue-600 mono font-bold">{currentUser.college_id}</span>.
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Copy ID</th>
                        <th>Book Title</th>
                        <th>Author</th>
                        <th>Department</th>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDashboard.activeLoans.map((loan: any) => (
                        <tr key={loan.issue_id}>
                          <td className="mono text-blue-600 font-bold">{loan.accession_no}</td>
                          <td className="font-semibold text-slate-900">{loan.title}</td>
                          <td className="text-slate-600">{loan.author}</td>
                          <td><span className="badge badge-faculty">{loan.department}</span></td>
                          <td className="mono">{loan.issue_date}</td>
                          <td className="mono font-semibold">{loan.due_date}</td>
                          <td>
                            {loan.days_overdue > 0 ? (
                              <span className="badge badge-overdue">
                                <AlertTriangle size={12} /> {loan.days_overdue} days Overdue (₹{loan.days_overdue * 10})
                              </span>
                            ) : (
                              <span className="badge badge-available">
                                <CheckCircle2 size={12} /> On Track
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* STUDENT TAB 2: MY FINES */}
          {studentTab === 'my-fines' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2>
                    <span className="text-blue-600 font-bold text-xl mr-1">₹</span> 
                    My Fines
                  </h2>
                  <p className="card-subtitle">Late fines assessed at ₹10 per overdue day on late returned books.</p>
                </div>
              </div>

              {studentDashboard.fines.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 className="empty-state-icon text-emerald-600" />
                  <h3 className="text-lg font-bold text-slate-800">No Fines</h3>
                  <p className="text-sm text-slate-500 mt-1">You have no unpaid or past library fines.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fine #</th>
                        <th>Book Title</th>
                        <th>Copy ID</th>
                        <th>Days Late</th>
                        <th>Amount (₹)</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDashboard.fines.map((f: any) => (
                        <tr key={f.fine_id}>
                          <td className="mono">#{f.fine_id}</td>
                          <td className="font-semibold text-slate-900">{f.title}</td>
                          <td className="mono text-blue-600">{f.accession_no}</td>
                          <td className="mono">{f.days_overdue} days</td>
                          <td className="mono font-bold text-rose-600">₹{f.amount.toFixed(2)}</td>
                          <td>
                            <span className={f.status === 'unpaid' ? 'badge badge-overdue' : 'badge badge-available'}>
                              {f.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="mono text-slate-500 text-xs">{f.assessed_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* STUDENT TAB 3: BROWSE BOOKS */}
          {studentTab === 'catalog' && (
            <section className="glass-card">
              <div className="card-header">
                <div className="card-title-group">
                  <h2><Search size={20} className="text-blue-600" /> Browse Library Books</h2>
                  <p className="card-subtitle">Search all books in the library and check if copies are available.</p>
                </div>
              </div>

              <div className="search-filter-bar">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text"
                    className="search-input"
                    placeholder="Search by Title, Author, or ISBN..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  {departments.map(dept => (
                    <button
                      key={dept}
                      className={`btn ${deptFilter === dept ? 'btn-primary' : 'btn-secondary'} py-1.5 px-3 text-xs`}
                      onClick={() => setDeptFilter(dept)}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {filteredCatalog.length === 0 ? (
                <div className="empty-state">
                  <BookOpen className="empty-state-icon" />
                  <h3 className="text-base font-semibold text-slate-700">No Books in Library Catalog</h3>
                  <p className="text-sm text-slate-500 mt-1">Please check back later as library staff adds books.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCatalog.map(book => {
                    const availableCount = book.copies.filter(c => c.status === 'available').length;
                    return (
                      <div key={book.book_id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex justify-between items-center flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{book.title}</h3>
                            <span className="badge badge-faculty">{book.department}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">Author: <strong>{book.author}</strong> • ISBN: <span className="mono">{book.isbn}</span></p>
                        </div>

                        <div>
                          {availableCount > 0 ? (
                            <span className="badge badge-available text-sm py-1 px-3">
                              ✓ {availableCount} of {book.copies.length} Copies Available
                            </span>
                          ) : (
                            <span className="badge badge-overdue text-sm py-1 px-3">
                              All Copies Currently Checked Out
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Footer */}
      <footer className="footer">
        <div>
          <strong className="text-blue-600">College Library LMS</strong> • Library Management System
        </div>
        <div className="flex gap-4 text-xs">
          <span>Signed in as: <strong className="text-slate-800">{currentUser.name}</strong></span>
          <span>Role: <strong className="text-blue-600 uppercase">{currentUser.role}</strong></span>
        </div>
      </footer>
    </div>
  );
}
