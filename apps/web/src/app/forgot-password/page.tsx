'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, KeyRound } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const res = await apiClient('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ instituteEmail: email }),
      });
      setMessage(res.message);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Failed to submit request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-sm text-zinc-500">
            Enter your institute email and we will send you a secure link to reset your password.
          </p>
        </div>

        {message && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Institute Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Link...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-500">
          Remember your password?{' '}
          <Link href="/login" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}

