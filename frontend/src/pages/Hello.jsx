import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import VerificationForm from '../components/VerificationForm';
import {
  getDashboardStats,
  queryReceipts,
  updateReceipt,
  updateReceiptStatus,
} from '../api/receipts';
import {
  getPendingCount,
  syncOfflineQueue,
  onOfflineSync,
} from '../lib/offlineQueue';

/* ── SVG Icons (inline to avoid deps) ──────────────────── */
const icons = {
  search: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  receipt: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-2.636-6.364" strokeLinecap="round" />
      <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  mapPin: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  image: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
};

/* ── Toast Hook ──────────────────────────────────── */
function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, exiting: false });
    timerRef.current = setTimeout(() => {
      setToast((prev) => prev ? { ...prev, exiting: true } : null);
      setTimeout(() => setToast(null), 300);
    }, 2500);
  }, []);

  return { toast, showToast };
}

/* ── Helpers ──────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'badge-pending';
    case 'Received': return 'badge-received';
    case 'Later': return 'badge-later';
    default: return 'badge-pending';
  }
}

function getFreightBadgeClass(type) {
  return type === 'Paid' ? 'badge-paid' : 'badge-topay';
}

/* ── CSV Export Helper ──────────────────────────── */
function exportToCSV(receiptsList) {
  if (!receiptsList || receiptsList.length === 0) return;

  const headers = [
    'LR Number',
    'Route',
    'E-Way Bill No.',
    'Date',
    'Consignor (Seller)',
    'Consignee (Buyer)',
    'Destination',
    'Freight Type',
    'Articles',
    'Invoice Number',
    'Description',
    'Acknowledgement Status',
    'OCR Confidence (%)',
    'Remarks',
    'Created At',
  ];

  const rows = receiptsList.map((r) => [
    `"${(r.lrNumber || '').replace(/"/g, '""')}"`,
    `"${(r.route || 'MALUR-MASTHI').replace(/"/g, '""')}"`,
    `"${(r.ewayBillNumber || '').replace(/"/g, '""')}"`,
    `"${r.date ? new Date(r.date).toISOString().split('T')[0] : ''}"`,
    `"${(r.consignor || '').replace(/"/g, '""')}"`,
    `"${(r.consignee || '').replace(/"/g, '""')}"`,
    `"${(r.destination || '').replace(/"/g, '""')}"`,
    `"${(r.freightType || '').replace(/"/g, '""')}"`,
    `"${(r.articles || '').replace(/"/g, '""')}"`,
    `"${(r.invoiceNumber || '').replace(/"/g, '""')}"`,
    `"${(r.description || '').replace(/"/g, '""')}"`,
    `"${(r.acknowledgementStatus || '').replace(/"/g, '""')}"`,
    `"${r.ocrConfidence ?? ''}"`,
    `"${(r.remarks || '').replace(/"/g, '""')}"`,
    `"${r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `OCR_Receipts_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── KPI Card ────────────────────────────────────── */
function KPICard({ label, value, accent, icon, delay }) {
  return (
    <div className={`kpi-card accent-${accent} animate-slide-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon" style={{ background: `rgba(148, 163, 184, 0.06)` }}>
          {icon}
        </div>
      </div>
      <div className="kpi-value">{value ?? '—'}</div>
    </div>
  );
}

/* ── Receipt Detail Modal ────────────────────────── */
function ReceiptModal({ receipt, onClose, onStatusUpdate, onEditStart, onEditSave, isSavingEdit, editMode }) {
  if (!receipt) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Receipt Detail</p>
            <h2 className="mt-1 text-lg font-bold text-slate-100">LR #{receipt.lrNumber}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg" aria-label="Close modal">
            {icons.x}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Image preview */}
          {receipt.imagePath && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={receipt.imagePath}
                alt={`Receipt ${receipt.lrNumber}`}
                className="w-full max-h-64 object-contain"
                loading="lazy"
              />
            </div>
          )}

          {/* Status badges row */}
          <div className="flex flex-wrap gap-2">
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              🚚 {receipt.route || 'MALUR-MASTHI'}
            </span>
            <span className={`badge ${getStatusBadgeClass(receipt.acknowledgementStatus)}`}>
              {receipt.acknowledgementStatus === 'Pending' ? icons.clock : icons.check}
              {receipt.acknowledgementStatus}
            </span>
            <span className={`badge ${getFreightBadgeClass(receipt.freightType)}`}>
              {receipt.freightType}
            </span>
            {receipt.ocrConfidence != null && (
              <span className="badge" style={{
                background: 'rgba(139, 92, 246, 0.12)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}>
                OCR {receipt.ocrConfidence}%
              </span>
            )}
          </div>

          {/* Field grid */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ['Date', formatDate(receipt.date)],
              ['E-Way Bill No.', receipt.ewayBillNumber || '—'],
              ['Destination', receipt.destination],
              ['Consignor (Seller)', receipt.consignor],
              ['Consignee (Buyer)', receipt.consignee],
              ['Articles', receipt.articles],
              ['Invoice No.', receipt.invoiceNumber],
              ['Description', receipt.description],
              ['Remarks', receipt.remarks],
            ].map(([label, val]) => (
              <div key={label}>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</dt>
                <dd className="mt-0.5 text-slate-200 font-medium">{val || '—'}</dd>
              </div>
            ))}
          </dl>

          {editMode ? (
            <div className="pt-3 border-t border-slate-800">
              <VerificationForm
                ocrData={receipt}
                imagePath={receipt.imagePath || ''}
                ocrConfidence={receipt.ocrConfidence || 95}
                initialRoute={receipt.route || 'MALUR-MASTHI'}
                initialDate={receipt.date ? new Date(receipt.date).toISOString().split('T')[0] : ''}
                onSave={onEditSave}
                onRetake={onClose}
                onCancel={onClose}
                isSubmitting={isSavingEdit}
                showContinueButton={false}
                cancelLabel="Cancel"
                saveButtonLabel="Save Changes"
                saveNextButtonLabel="Save Changes"
              />
            </div>
          ) : (
            <>
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  className="btn-action action-receive flex-1"
                  onClick={() => onStatusUpdate(receipt._id, 'Received')}
                >
                  {icons.check} Mark Received
                </button>
                <button
                  className="btn-action flex-1"
                  style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}
                  onClick={() => onStatusUpdate(receipt._id, 'Later')}
                >
                  {icons.clock} Mark Later
                </button>
              </div>
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  className="btn-action flex-1"
                  style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                  onClick={() => onEditStart(receipt)}
                >
                  ✏️ Edit Entry
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Loading Skeleton ────────────────────────────── */
function ReceiptSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="receipt-card" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex gap-3 items-center">
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
            <div className="flex-1 space-y-2">
              <div className="skeleton" style={{ width: '40%', height: 14 }} />
              <div className="skeleton" style={{ width: '65%', height: 12 }} />
            </div>
            <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 9999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD — Main Component
   ═══════════════════════════════════════════════════ */
export default function Hello() {
  // State
  const [stats, setStats] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [freightFilter, setFreightFilter] = useState('All');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Modal
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Offline queue
  const [offlinePending, setOfflinePending] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Toast
  const { toast, showToast } = useToast();

  // Debounce ref
  const debounceRef = useRef(null);

  /* ── Fetch stats ─────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const params = {};
      if (routeFilter !== 'All') params.route = routeFilter;
      const data = await getDashboardStats(params);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [routeFilter]);

  /* ── Fetch receipts ──────────────────────────── */
  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (routeFilter !== 'All') params.route = routeFilter;
      if (statusFilter !== 'All') params.acknowledgementStatus = statusFilter;
      if (freightFilter !== 'All') params.freightType = freightFilter;
      if (destination) params.destination = destination;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await queryReceipts(params);
      setReceipts(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReceiptsLoading(false);
    }
  }, [search, routeFilter, statusFilter, freightFilter, destination, startDate, endDate, showToast]);

  /* ── Initial load ──────────────────────── */
  useEffect(() => {
    fetchStats();
    fetchReceipts();

    // Check offline queue
    getPendingCount().then(setOfflinePending);

    // Listen for online/offline changes
    const handleOnline = () => {
      setIsOnline(true);
      // Refresh data when coming back online
      fetchStats();
      fetchReceipts();
      getPendingCount().then(setOfflinePending);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register sync callback for toast notifications
    onOfflineSync((result) => {
      if (result.synced > 0) {
        showToast(`${result.synced} offline receipt${result.synced > 1 ? 's' : ''} synced!`, 'success');
        fetchStats();
        fetchReceipts();
      }
      getPendingCount().then(setOfflinePending);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Debounced fetch on filter change ─────────── */
  useEffect(() => {
    fetchStats();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchReceipts();
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, routeFilter, statusFilter, freightFilter, destination, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Status update handler ──────────────────── */
  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateReceiptStatus(id, { acknowledgementStatus: newStatus });
      showToast(`Receipt marked as ${newStatus}`, 'success');
      setSelectedReceipt(null);
      setEditMode(false);
      // Refresh
      fetchStats();
      fetchReceipts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEditStart = (receipt) => {
    setSelectedReceipt(receipt);
    setEditMode(true);
  };

  const handleEditSave = async (payload) => {
    if (!selectedReceipt?._id) return;

    setIsSavingEdit(true);
    try {
      await updateReceipt(selectedReceipt._id, payload);
      showToast('Receipt updated successfully', 'success');
      setEditMode(false);
      setSelectedReceipt(null);
      fetchStats();
      fetchReceipts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  /* ── Refresh handler ───────────────────────── */
  const handleRefresh = () => {
    setLoading(true);
    setReceiptsLoading(true);
    fetchStats();
    fetchReceipts();
  };

  const handleDateSelect = (dateValue) => {
    setSelectedDate(dateValue);
    setStartDate(dateValue);
    setEndDate(dateValue);
  };

  const handleShowAllDates = () => {
    setSelectedDate('');
    setStartDate('');
    setEndDate('');
  };

  const dateGroups = useMemo(() => {
    return receipts.reduce((groups, receipt) => {
      const key = receipt.date ? receipt.date.split('T')[0] : 'unknown';
      if (!groups[key]) {
        groups[key] = { date: key, count: 0 };
      }
      groups[key].count += 1;
      return groups;
    }, {});
  }, [receipts]);

  const statusTabs = ['All', 'Pending', 'Received', 'Later'];
  const freightTabs = ['All', 'Paid', 'To Pay'];

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-5xl px-4 py-6 safe-top safe-bottom">

        {/* ── Route Selection Banner ──────────────── */}
        <div className="mb-5 animate-slide-up">
          <label className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
            Select Route Ledger
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'All', label: '🌐 ALL ROUTES' },
              { id: 'MALUR-MASTHI', label: '🚛 MALUR-MASTHI' },
              { id: 'NELAMANGALA', label: '🚚 NELAMANGALA' },
            ].map((route) => (
              <button
                key={route.id}
                onClick={() => setRouteFilter(route.id)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition border text-center ${
                  routeFilter === route.id
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                id={`route-tab-${route.id.toLowerCase()}`}
              >
                {route.label}
              </button>
            ))}
          </div>
        </div>
        <header className="flex items-center justify-between mb-6 animate-fade-in">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                OCR-SUSTEM
              </p>
              {!isOnline && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-[0.6rem] font-semibold text-amber-300">Offline</span>
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            {receipts.length > 0 && (
              <button
                onClick={() => {
                  exportToCSV(receipts);
                  showToast('Exported receipts to CSV / Excel!', 'success');
                }}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
                title="Export to Excel / CSV"
                id="btn-export-csv"
              >
                {icons.download}
                <span className="hidden sm:inline">Export Excel</span>
              </button>
            )}
            {offlinePending > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 animate-slide-down" title={`${offlinePending} receipt(s) waiting to sync`}>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-semibold text-amber-300">{offlinePending}</span>
              </div>
            )}
            <button onClick={handleRefresh} className="btn-ghost p-2" title="Refresh" aria-label="Refresh dashboard">
              {icons.refresh}
            </button>
            <Link to="/capture" className="btn-primary" id="capture-receipt-cta">
              {icons.plus}
              <span className="hidden sm:inline">Capture Receipt</span>
            </Link>
          </div>
        </header>

        {/* ── Error banner ─────────────────────────── */}
        {error && (
          <div className="mb-4 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400 text-sm animate-slide-down">
            <strong>Connection Error:</strong> {error}
          </div>
        )}

        {/* ── KPI Cards ────────────────────────────── */}
        {loading ? (
          <div className="kpi-grid mb-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="kpi-card">
                <div className="skeleton" style={{ width: '50%', height: 12, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: '60%', height: 28 }} />
              </div>
            ))}
          </div>
        ) : stats && (
          <div className="kpi-grid mb-6">
            <KPICard label="Today" value={stats.todayCount} accent="emerald" delay={0}
              icon={<span style={{ color: '#10b981' }}>{icons.calendar}</span>} />
            <KPICard label="Pending" value={stats.pendingCount} accent="amber" delay={60}
              icon={<span style={{ color: '#f59e0b' }}>{icons.clock}</span>} />
            <KPICard label="Received" value={stats.receivedCount} accent="blue" delay={120}
              icon={<span style={{ color: '#3b82f6' }}>{icons.check}</span>} />
            <KPICard label="Paid" value={stats.paidCount} accent="cyan" delay={180}
              icon={<span style={{ color: '#06b6d4' }}>₹</span>} />
            <KPICard label="To Pay" value={stats.toPayCount} accent="rose" delay={240}
              icon={<span style={{ color: '#f43f5e' }}>₹</span>} />
            <KPICard label="Total" value={stats.totalCount} accent="violet" delay={300}
              icon={<span style={{ color: '#8b5cf6' }}>{icons.receipt}</span>} />
          </div>
        )}

        {/* ── Daily Entries Overview ───────────────── */}
        <div className="mb-5 animate-slide-up delay-100">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Daily entries</p>
              <p className="text-sm text-slate-300">Open a date to review or add receipts</p>
            </div>
            <button
              onClick={handleShowAllDates}
              className="text-xs font-semibold text-emerald-400"
            >
              {selectedDate ? 'Show all dates' : 'All dates'}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.values(dateGroups).sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
              <button
                key={entry.date}
                type="button"
                onClick={() => handleDateSelect(entry.date)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedDate === entry.date
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{formatDate(entry.date)}</span>
                  <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[0.65rem] font-semibold">
                    {entry.count} {entry.count === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{entry.date}</p>
              </button>
            ))}
          </div>
        </div>

        {selectedDate && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 animate-slide-up delay-150">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Selected date</p>
                <p className="text-base font-semibold text-slate-100">{formatDate(selectedDate)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleShowAllDates}
                  className="btn-secondary text-xs"
                >
                  Back to dates
                </button>
                <Link to="/capture" className="btn-primary text-xs">
                  {icons.plus} Add Receipt
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Search Bar ───────────────────────────── */}
        <div className="search-container mb-4 animate-slide-up delay-200" id="search-bar">
          <span className="search-icon">{icons.search}</span>
          <input
            type="text"
            placeholder="Search by LR Number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="search-input"
          />
        </div>

        {/* ── Filter Bar ──────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-4 animate-slide-up delay-250">
          {/* Status tabs */}
          <div className="filter-tabs">
            {statusTabs.map((tab) => (
              <button
                key={tab}
                className={`filter-tab ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab)}
                id={`filter-status-${tab.toLowerCase()}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Freight tabs */}
          <div className="filter-tabs">
            {freightTabs.map((tab) => (
              <button
                key={tab}
                className={`filter-tab ${freightFilter === tab ? 'active' : ''}`}
                onClick={() => setFreightFilter(tab)}
                id={`filter-freight-${tab.toLowerCase().replace(' ', '-')}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Destination dropdown */}
          {stats?.uniqueDestinations?.length > 0 && (
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="filter-tab rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
              id="filter-destination"
              style={{ appearance: 'auto' }}
            >
              <option value="">All Destinations</option>
              {stats.uniqueDestinations.map((dest) => (
                <option key={dest} value={dest}>{dest}</option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
              id="filter-start-date"
            />
            <span className="text-slate-600 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
              id="filter-end-date"
            />
          </div>
        </div>

        {/* ── Results count ────────────────────────── */}
        <div className="flex items-center justify-between mb-3 text-sm text-slate-500 animate-fade-in delay-300">
          <p>
            {receiptsLoading
              ? 'Loading…'
              : selectedDate
                ? `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} for ${formatDate(selectedDate)}`
                : `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} across selected dates`}
          </p>
          {(search || statusFilter !== 'All' || freightFilter !== 'All' || destination || startDate || endDate) && (
            <button
              className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setFreightFilter('All');
                setDestination('');
                setStartDate('');
                setEndDate('');
              }}
              id="clear-filters"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* ── Receipt List ─────────────────────────── */}
        {receiptsLoading ? (
          <ReceiptSkeleton />
        ) : receipts.length === 0 ? (
          <div className="empty-state animate-scale-in">
            <div className="empty-state-icon">{icons.receipt}</div>
            <p className="text-slate-400 font-medium">No receipts found</p>
            <p className="text-sm text-slate-600 mt-1">
              {search || statusFilter !== 'All'
                ? 'Try adjusting the LR number search or filters'
                : selectedDate
                  ? 'No entries exist for this day yet'
                  : 'Select a date to review entries'}
            </p>
            {!search && statusFilter === 'All' && (
              <Link to="/capture" className="btn-primary mt-4">
                {icons.plus} Add Receipt
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r, index) => (
              <div
                key={r._id}
                className="receipt-card animate-slide-up"
                style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
                onClick={() => setSelectedReceipt(r)}
                id={`receipt-${r._id}`}
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail / icon */}
                  <div
                    className="flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center"
                    style={{ background: 'rgba(148, 163, 184, 0.04)' }}
                  >
                    {r.imagePath ? (
                      <img
                        src={r.imagePath}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-slate-600">{icons.image}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        LR #{r.lrNumber}
                      </span>
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                        {r.route || 'MALUR-MASTHI'}
                      </span>
                      <span className={`badge ${getStatusBadgeClass(r.acknowledgementStatus)}`}>
                        {r.acknowledgementStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1 truncate">
                        {r.consignor || '—'} → {r.consignee || '—'}
                      </span>
                      {r.destination && (
                        <span className="flex items-center gap-0.5">
                          {icons.mapPin} {r.destination}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right section */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${getFreightBadgeClass(r.freightType)}`}>
                      {r.freightType}
                    </span>
                    {r.acknowledgementStatus === 'Pending' && (
                      <button
                        className="btn-action action-receive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(r._id, 'Received');
                        }}
                        title="Mark as Received"
                        aria-label={`Mark receipt ${r.lrNumber} as received`}
                      >
                        {icons.check}
                      </button>
                    )}
                    <span className="text-slate-600">{icons.chevron}</span>
                  </div>
                </div>

                {/* Date & ewaybill row */}
                <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-1">
                  <span className="flex items-center gap-1">
                    {icons.calendar} {formatDate(r.date)}
                  </span>
                  <div className="flex items-center gap-3">
                    {r.ewayBillNumber && (
                      <span className="font-mono text-emerald-400/90 font-semibold">E-Way: {r.ewayBillNumber}</span>
                    )}
                    {r.invoiceNumber && (
                      <span>Inv: {r.invoiceNumber}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Receipt Detail Modal ───────────────── */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => {
            setSelectedReceipt(null);
            setEditMode(false);
          }}
          onStatusUpdate={handleStatusUpdate}
          onEditStart={handleEditStart}
          onEditSave={handleEditSave}
          isSavingEdit={isSavingEdit}
          editMode={editMode}
        />
      )}

      {/* ── Toast Notification ─────────────────── */}
      {toast && (
        <div className={`toast toast-${toast.type} ${toast.exiting ? 'toast-exit' : ''}`}>
          {toast.type === 'success' ? icons.check : '⚠'} {toast.message}
        </div>
      )}
    </div>
  );
}
