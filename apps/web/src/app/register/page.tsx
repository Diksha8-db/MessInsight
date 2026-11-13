'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/apiClient';

interface FieldErrors {
  name?: string;
  instituteEmail?: string;
  password?: string;
}

interface ZodIssue {
  path: string[];
  message: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ password: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);

    try {
      await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, instituteEmail: email, password }),
      });

      router.push(`/verify-email?email=${encodeURIComponent(email)}&registered=true`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'VALIDATION_ERROR' && err.details) {
        // Map Zod field errors to individual fields
        const issues = err.details as ZodIssue[];
        const mapped: FieldErrors = {};
        for (const issue of issues) {
          const field = issue.path[0] as keyof FieldErrors;
          if (field) mapped[field] = issue.message;
        }
        setFieldErrors(mapped);
        setErrorMessage('Please fix the errors below.');
      } else {
        const error = err as { message?: string };
        setErrorMessage(error.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Create an Account</h1>
          <p className="text-sm text-zinc-500">Register to access the mess portal</p>
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Aarav Sharma"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors(f => ({ ...f, name: undefined })); }}
              disabled={isLoading}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-zinc-900 ${fieldErrors.name ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500 dark:border-zinc-700'}`}
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors(f => ({ ...f, instituteEmail: undefined })); }}
              disabled={isLoading}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-zinc-900 ${fieldErrors.instituteEmail ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500 dark:border-zinc-700'}`}
            />
            {fieldErrors.instituteEmail && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.instituteEmail}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Min 8 chars, uppercase, number, symbol"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: undefined })); }}
                disabled={isLoading}
                className={`w-full rounded-md border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 dark:bg-zinc-900 ${fieldErrors.password ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500 dark:border-zinc-700'}`}
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
            {fieldErrors.password && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>}
            <p className="mt-1 text-xs text-zinc-400">Must be 8+ characters with uppercase, lowercase, number & symbol</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">
              Confirm Password
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
                Registering...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-500">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}

