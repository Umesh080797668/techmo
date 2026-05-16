export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-600/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
      </div>
    </div>
  );
}
