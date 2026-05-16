export default function AuthenticatedLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 p-4 gap-3">
        {/* Brand */}
        <div className="h-8 bg-gray-200 rounded-lg w-3/4 mb-4 animate-pulse" />

        {/* Nav items */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-9 bg-gray-100 rounded-lg animate-pulse"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}

        <div className="mt-auto">
          <div className="h-px bg-gray-200 mb-3" />
          <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse" />
          <div className="h-9 bg-gray-200 rounded-lg w-32 animate-pulse" />
        </div>

        {/* Stat cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-5 border border-gray-200 space-y-3 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-8 w-8 bg-gray-100 rounded-lg" />
              </div>
              <div className="h-7 bg-gray-200 rounded w-20" />
              <div className="h-3 bg-gray-100 rounded w-28" />
            </div>
          ))}
        </div>

        {/* Table / chart area */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          {/* Table header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="h-5 bg-gray-200 rounded w-32" />
            <div className="flex gap-2">
              <div className="h-9 bg-gray-100 rounded-lg w-40" />
              <div className="h-9 bg-gray-100 rounded-lg w-28" />
            </div>
          </div>

          {/* Column headings */}
          <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 bg-gray-200 rounded" />
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-4 px-4 py-4 border-t border-gray-50"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {Array.from({ length: 5 }).map((_, j) => (
                <div
                  key={j}
                  className="h-4 bg-gray-100 rounded"
                  style={{ width: j === 0 ? '80%' : j === 4 ? '60%' : '90%' }}
                />
              ))}
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="h-4 bg-gray-100 rounded w-32" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 w-8 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
