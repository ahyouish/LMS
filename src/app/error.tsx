'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Captured by App Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-8 text-center shadow-lg">
        <div className="w-14 h-14 mx-auto mb-4 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-200">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-600 mb-4">
          {error?.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="btn btn-primary text-sm px-4 py-2 inline-flex items-center gap-2"
          >
            <RefreshCw size={16} /> Try Again
          </button>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="btn btn-secondary text-sm px-4 py-2"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
