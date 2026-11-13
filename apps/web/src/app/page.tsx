import Link from 'next/link';
import {
  UtensilsCrossed,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  MessageSquareHeart,
  ChevronRight,
  LogIn,
  UserPlus,
  KeyRound,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <UtensilsCrossed size={22} />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Mess<span className="text-blue-400">Insight</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <LogIn size={16} /> Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
            >
              <UserPlus size={16} /> Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium mb-6">
          <Sparkles size={14} className="text-blue-400 animate-pulse" />
          NIT Patna Institute Mess Management & Demand Prediction
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight">
          AI-Powered Smart Mess & Canteen Intelligence
        </h1>

        <p className="mt-5 text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
          Real-time daily menu feedback, automated NLP sentiment insights, demand prediction,
          and transparent grievance tracking.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-600/30 flex items-center gap-2 group"
          >
            Enter Portal
            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/register"
            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            Create Student Account
          </Link>
        </div>

        {/* Demo Credentials Quick-Reference Box */}
        <div className="mt-12 w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-left shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <KeyRound size={16} className="text-emerald-400" />
              Pre-Configured Demo Credentials (NIT Patna)
            </div>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded font-mono">
              Password: Password@123
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
                Student Account
              </div>
              <div className="text-xs font-mono text-slate-200 break-all select-all">
                aarav.sharma@nitp.ac.in
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Daily menu, rating, complaints</div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
                Mess Manager
              </div>
              <div className="text-xs font-mono text-slate-200 break-all select-all">
                manager.hostela@nitp.ac.in
              </div>
              <div className="text-[11px] text-slate-400 mt-1">AI forecast, menu publisher, resolve</div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">
                Administrator
              </div>
              <div className="text-xs font-mono text-slate-200 break-all select-all">
                admin@nitp.ac.in
              </div>
              <div className="text-[11px] text-slate-400 mt-1">RBAC users, audit logs, analytics</div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full text-left">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <MessageSquareHeart size={20} />
            </div>
            <h3 className="font-semibold text-slate-100 text-base">Student Feedback & Ratings</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Rate daily dishes, upload photos of hygiene issues, and track complaint resolutions in real-time.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-semibold text-slate-100 text-base">Demand & Waste Prediction</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              ML microservice predicts expected headcounts per meal to prevent shortages and reduce food waste.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-semibold text-slate-100 text-base">Role-Based Security</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Strict token-version invalidation, tamper-evident audit logs, and domain-restricted registration.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        MessInsight • Production Cloud-Native • National Institute of Technology Patna
      </footer>
    </div>
  );
}
