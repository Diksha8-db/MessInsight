export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          MessInsight
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Smart Mess and Canteen Feedback System with Demand Prediction
        </p>
        <div className="pt-4">
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            System Operational • Phase 0
          </span>
        </div>
      </div>
    </main>
  );
}

