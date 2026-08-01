import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

/* ── Lazy-loaded pages (code-split into separate chunks) ── */
const Hello = lazy(() => import('./pages/Hello'));
const CaptureReceipt = lazy(() => import('./pages/CaptureReceipt'));

/* ── Loading fallback ─────────────────────────────────── */
function PageLoader() {
  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="mx-auto h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
          <div className="h-5 w-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/60">
          Loading…
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Hello />} />
          <Route path="/capture" element={<CaptureReceipt />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
