'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'MANAGER' | 'ADMIN';
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await apiClient<LoginUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ instituteEmail: email, password }),
      });

      const returnUrl = searchParams.get('returnUrl');
      // Protect against open redirects: only allow relative paths
      if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
        router.push(returnUrl);
        return;
      }

      // Role-based default redirect
      if (res.data.role === 'ADMIN') {
        router.push('/admin');
      } else if (res.data.role === 'MANAGER') {
        router.push('/manager');
      } else {
        router.push('/student');
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setErrorMessage(error.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Sign in to MessInsight</h1>
        <p className="text-sm text-zinc-500">Enter your institute email and password to access your dashboard</p>
      </div>

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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Forgot password?
            </Link>
          </div>
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
          Register with Institute Email
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

