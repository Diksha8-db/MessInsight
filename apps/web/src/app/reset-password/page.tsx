'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setIsSuccess(true);
      setTimeout(() => router.push('/login?reset=true'), 2000);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Failed to reset password. Link may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-red-600">Invalid Reset Link</h1>
        <p className="text-sm text-zinc-500">
          No password reset token was provided in the URL. Please request a new link.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm font-medium text-emerald-600 hover:underline"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Password Reset Successful</h1>
        <p className="text-sm text-zinc-500">Your password has been updated. Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
        <p className="text-sm text-zinc-500">Enter a secure new password for your account</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="password">
            New Password (min 8 chars, uppercase, digit, symbol)
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
              Resetting...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading password reset...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

