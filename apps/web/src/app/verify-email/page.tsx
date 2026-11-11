'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await apiClient('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ instituteEmail: email, otp }),
      });

      router.push('/login?verified=true');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setIsResending(true);

    try {
      const res = await apiClient('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ instituteEmail: email }),
      });
      setMessage(res.message);
      setResendCooldown(60);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Verify Your Email</h1>
        <p className="text-sm text-zinc-500">
          Enter the 6-digit code sent to <strong className="text-zinc-700 dark:text-zinc-300">{email || 'your institute email'}</strong>
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

      <form onSubmit={handleVerify} className="space-y-4">
        {!emailParam && (
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Institute Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="otp">
            6-Digit Verification Code
          </label>
          <input
            id="otp"
            type="text"
            required
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            disabled={isLoading}
            className="w-full text-center tracking-widest text-xl font-bold rounded-md border border-zinc-300 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className="w-full inline-flex items-center justify-center rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Email'
          )}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm pt-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || isResending}
          className="text-emerald-600 hover:underline disabled:text-zinc-400 dark:text-emerald-400"
        >
          {isResending
            ? 'Sending...'
            : resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : 'Resend code'}
        </button>
        <Link href="/login" className="text-zinc-500 hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading verification...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}

