export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800">MessInsight — Manager</span>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}

