import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { uploadReceiptImage } from '../api/upload';
import { runReceiptOCR } from '../api/ocr';
import { createReceipt, queryReceipts } from '../api/receipts';
import VerificationForm from '../components/VerificationForm';
import { getPendingCount } from '../lib/offlineQueue';

/* ── Constants ───────────────────────────────────── */
const STEPS = {
  idle: 'idle',
  processing: 'processing',
  done: 'done',
  saved: 'saved',
  error: 'error',
};

const PIPELINE_STAGES = [
  { key: 'upload', label: 'Upload' },
  { key: 'process', label: 'Process' },
  { key: 'ocr', label: 'OCR Extract' },
  { key: 'verify', label: 'Verify & Save' },
];

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatEntryDateLabel(dateStr) {
  if (!dateStr) return 'Select Date';
  const today = getLocalDateString();
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ── SVG icons ───────────────────────────────────── */
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);
const UploadCloudIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);
const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);
const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-emerald-400">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Step Indicator ──────────────────────────────── */
function StepIndicator({ activeIndex }) {
  return (
    <div className="flex items-center gap-2 px-2 animate-fade-in">
      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage.key} className="contents">
          <div
            className={`step-dot ${i < activeIndex ? 'completed' : ''} ${i === activeIndex ? 'active' : ''}`}
          >
            {i < activeIndex ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < PIPELINE_STAGES.length - 1 && (
            <div className="step-line">
              <div className={`step-line-fill ${i < activeIndex ? 'filled' : ''}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Animated Processing Icon ────────────────────── */
function ProcessingIcon() {
  return (
    <div className="relative mx-auto w-20 h-20 animate-float">
      <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 animate-pulse-glow" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 64 64" fill="none" className="h-12 w-12 text-emerald-400">
          <rect x="12" y="6" width="40" height="52" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <line x1="20" y1="18" x2="44" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="20" y1="26" x2="38" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          <line x1="20" y1="34" x2="42" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <line x1="20" y1="42" x2="36" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
          <line x1="16" y1="20" x2="48" y2="20" stroke="#34d399" strokeWidth="1.5" opacity="0.6">
            <animate attributeName="y1" values="14;50;14" dur="2s" repeatCount="indefinite" />
            <animate attributeName="y2" values="14;50;14" dur="2s" repeatCount="indefinite" />
          </line>
        </svg>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────── */
export default function CaptureReceipt() {
  const [step, setStep] = useState(STEPS.idle);
  const [localPreview, setLocalPreview] = useState(null);
  const [processedPreview, setProcessedPreview] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // OCR state
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState(null);

  // Save State
  const [isSaving, setIsSaving] = useState(false);
  const [savedReceiptResult, setSavedReceiptResult] = useState(null);
  const [saveWarnings, setSaveWarnings] = useState([]);
  const [saveError, setSaveError] = useState(null);

  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [routeEntries, setRouteEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState('');

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null); // Stores current file for retry

  /* ── Camera helpers ──────────────────────────── */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview, stopCamera]);

  useEffect(() => {
    let ignore = false;

    async function loadRouteEntries() {
      if (!selectedRoute) {
        setRouteEntries([]);
        setEntriesError('');
        return;
      }

      setEntriesLoading(true);
      setEntriesError('');

      try {
        const data = await queryReceipts({ route: selectedRoute });
        if (ignore) return;

        const grouped = data.reduce((acc, receipt) => {
          const key = receipt.date?.split('T')[0];
          if (!key) return acc;
          if (!acc[key]) {
            acc[key] = { date: key, count: 0, receipts: [] };
          }
          acc[key].count += 1;
          acc[key].receipts.push(receipt);
          return acc;
        }, {});

        const entries = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
        const today = getLocalDateString();

        if (!entries.some((entry) => entry.date === today)) {
          entries.unshift({ date: today, count: 0, receipts: [] });
        }

        setRouteEntries(entries);
      } catch (err) {
        if (!ignore) setEntriesError(err.message || 'Unable to load daily entries');
      } finally {
        if (!ignore) setEntriesLoading(false);
      }
    }

    loadRouteEntries();
    return () => {
      ignore = true;
    };
  }, [selectedRoute]);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setError('Camera access denied. Use "Upload existing image" instead.');
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      stopCamera();
      await handleFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  /* ── Trigger OCR extraction ──────────────────── */
  const triggerOCR = useCallback(async (imagePath) => {
    setIsOcrRunning(true);
    setOcrError(null);
    try {
      const result = await runReceiptOCR(imagePath);
      setOcrResult(result);
      setStep(STEPS.done);
    } catch (err) {
      setOcrError(err.message);
    } finally {
      setIsOcrRunning(false);
    }
  }, []);

  /* ── File handling ───────────────────────────── */
  async function handleFile(file) {
    if (!file?.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      triggerShake();
      return;
    }

    fileRef.current = file; // Store for potential retry
    setError(null);
    setOcrError(null);
    setOcrResult(null);
    setUploadResult(null);
    setProcessedPreview(null);
    setSavedReceiptResult(null);
    setSaveWarnings([]);
    setSaveError(null);
    setSavedOffline(false);
    setUploadProgress(0);
    setStep(STEPS.processing);

    const previewUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });

    try {
      const result = await uploadReceiptImage(file, setStatusMessage, setUploadProgress);
      setUploadResult(result);
      setProcessedPreview(result.dataUrl || result.imagePath);
      
      // Auto-trigger OCR extraction using dataUrl (stateless) or imagePath
      await triggerOCR(result.dataUrl || result.imagePath);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.error);
      triggerShake();
    } finally {
      setStatusMessage('');
    }
  }

  /* ── Retry upload with same file ────────────── */
  function retryUpload() {
    if (fileRef.current) {
      handleFile(fileRef.current);
    } else {
      reset();
    }
  }

  /* ── Retry OCR only (image already uploaded) ── */
  function retryOCR() {
    if (uploadResult?.imagePath) {
      triggerOCR(uploadResult.imagePath);
    }
  }

  /* ── Handle Save Receipt to MongoDB ──────────── */
  async function handleSaveReceipt(payload) {
    setIsSaving(true);
    setSaveError(null);
    setSaveWarnings([]);
    setSavedOffline(false);

    try {
      const result = await createReceipt(payload);
      setSavedReceiptResult(result.receipt);
      setSaveWarnings(result.warnings || []);
      setSavedOffline(!!result.offline);
      setStep(STEPS.saved);
    } catch (err) {
      setSaveError(err.message);
      triggerShake();
    } finally {
      setIsSaving(false);
    }
  }

  function triggerShake() {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 600);
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) handleFile(file);
  }

  /* ── Drag & drop ─────────────────────────────── */
  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }
  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  /* ── Reset ───────────────────────────────────── */
  function reset() {
    stopCamera();
    fileRef.current = null;
    setStep(STEPS.idle);
    setUploadResult(null);
    setProcessedPreview(null);
    setOcrResult(null);
    setOcrError(null);
    setSavedReceiptResult(null);
    setSaveWarnings([]);
    setSaveError(null);
    setSavedOffline(false);
    setError(null);
    setStatusMessage('');
    setUploadProgress(0);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function handleRouteSelect(route) {
    setSelectedRoute(route);
    setSelectedDate('');
    setEntriesError('');
    reset();
  }

  function startManualEntry(dateValue = getLocalDateString()) {
    setSelectedDate(dateValue);
    setUploadResult({ imagePath: '', route: selectedRoute, date: dateValue });
    setProcessedPreview(null);
    setOcrResult(null);
    setOcrError(null);
    setSavedReceiptResult(null);
    setSaveWarnings([]);
    setSaveError(null);
    setSavedOffline(false);
    setError(null);
    setStep(STEPS.done);
  }

  /* ── Derived state for active step ───────────── */
  const activeStepIndex =
    step === STEPS.idle ? 0 :
    isOcrRunning ? 2 :
    step === STEPS.processing ? 1 :
    step === STEPS.done ? 3 :
    step === STEPS.saved ? 4 :
    1;

  /* ── Hidden file inputs ──────────────────────── */
  const hiddenInputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelected}
        id="camera-input"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={onFileSelected}
        id="gallery-input"
      />
    </>
  );

  return (
    <div className="min-h-dvh bg-[var(--color-surface)]">
      {/* ── Background gradient ──────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-600/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-emerald-600/3 blur-3xl" />
      </div>

      {/* ── Header ───────────────────────────────── */}
      <header className="safe-top relative z-10 border-b border-white/5 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
              OCR-SUSTEM
            </p>
            <h1 className="text-lg font-bold text-slate-100">Capture & Verify Receipt</h1>
          </div>
          <Link to="/" className="btn-ghost text-xs" id="nav-home">
            <HomeIcon /> Home
          </Link>
        </div>
      </header>

      {/* ── Step indicator bar ───────────────────── */}
      {step !== STEPS.idle && (
        <div className="relative z-10 border-b border-white/5 px-4 py-3">
          <div className="mx-auto max-w-lg">
            <StepIndicator activeIndex={activeStepIndex} />
            <div className="mt-2 flex justify-between px-1 text-[0.6rem] font-medium uppercase tracking-wider text-slate-500">
              {PIPELINE_STAGES.map((s) => (
                <span key={s.key}>{s.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-lg px-4 py-6 safe-bottom">
        {hiddenInputs}

        {/* ═══ IDLE STATE ════════════════════════════ */}
        {step === STEPS.idle && !cameraActive && (
          <section className="animate-slide-up space-y-5">
            <div className="glass rounded-2xl border border-emerald-500/20 p-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-emerald-400/80">
                Choose route first
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-100">Select the ledger route</h2>
              <p className="mt-1 text-sm text-slate-400">
                Pick Malur-Masthi or Nelamangala, then open the day you want to enter.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {['MALUR-MASTHI', 'NELAMANGALA'].map((route) => (
                  <button
                    key={route}
                    type="button"
                    onClick={() => handleRouteSelect(route)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      selectedRoute === route
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-white/10 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40 hover:text-slate-100'
                    }`}
                  >
                    {route === 'MALUR-MASTHI' ? '🚛 MALUR-MASTHI' : '🚚 NELAMANGALA'}
                  </button>
                ))}
              </div>
            </div>

            {selectedRoute && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Daily entries</p>
                    <p className="text-sm text-slate-300">{selectedRoute === 'MALUR-MASTHI' ? 'Malur-Masthi' : 'Nelmangala'} ledger</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRouteSelect('')}
                    className="text-xs font-semibold text-emerald-400"
                  >
                    Change route
                  </button>
                </div>

                {entriesLoading ? (
                  <div className="glass rounded-2xl border border-white/5 p-4 text-sm text-slate-400">
                    Loading daily entries…
                  </div>
                ) : entriesError ? (
                  <div className="glass rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
                    {entriesError}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routeEntries.map((entry) => (
                      <button
                        key={entry.date}
                        type="button"
                        onClick={() => startManualEntry(entry.date)}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{formatEntryDateLabel(entry.date)}</p>
                          <p className="text-xs text-slate-500">{entry.count} entr{entry.count === 1 ? 'y' : 'ies'} saved</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-emerald-400">Open</p>
                          <p className="text-[0.65rem] text-slate-500">{entry.date}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="animate-slide-up rounded-xl border border-red-500/20 bg-red-950/30 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-red-400"><AlertIcon /></span>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ CAMERA ACTIVE ═════════════════════════ */}
        {cameraActive && (
          <section className="animate-scale-in space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/50">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[3/4] w-full object-cover"
                id="camera-viewfinder"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={stopCamera}
                className="btn-ghost w-full border border-white/10"
                id="btn-cancel-camera"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="btn-primary w-full"
                id="btn-capture"
              >
                <CameraIcon /> Capture
              </button>
            </div>
          </section>
        )}

        {/* ═══ PROCESSING / OCR LOADING STATE ════════ */}
        {(step === STEPS.processing || isOcrRunning) && (
          <section className="animate-slide-up space-y-6">
            {localPreview && (
              <div className="overflow-hidden rounded-2xl border border-white/10 shadow-lg">
                <img
                  src={localPreview}
                  alt="Receipt preview"
                  className="max-h-56 w-full object-contain bg-black/50"
                  id="preview-original"
                />
              </div>
            )}

            <div className="glass rounded-2xl p-6 text-center">
              <ProcessingIcon />

              <p className="mt-5 text-sm font-semibold text-emerald-400" id="ocr-status-message">
                {isOcrRunning
                  ? 'Running Gemini Vision OCR Extraction…'
                  : statusMessage || 'Processing image…'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isOcrRunning
                  ? 'Extracting LR No, Consignor, Consignee, Freight & fields with Gemini Vision'
                  : 'Auto-rotating, cropping & optimizing your image…'}
              </p>

              <div className="mt-5">
                <div className="progress-track progress-indeterminate" />
              </div>
            </div>
          </section>
        )}

        {/* ═══ OCR ERROR — Retry OCR only ═════════════ */}
        {ocrError && !isOcrRunning && uploadResult && step !== STEPS.done && step !== STEPS.saved && (
          <section className="animate-slide-up space-y-4">
            {processedPreview && (
              <div className="overflow-hidden rounded-2xl border border-white/10 shadow-lg">
                <img src={processedPreview} alt="Processed preview" className="max-h-48 w-full object-contain bg-black/50" />
              </div>
            )}
            <div className="glass rounded-2xl border-amber-500/20 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-amber-400"><AlertIcon /></span>
                <div>
                  <p className="text-sm font-semibold text-amber-400">OCR Extraction Failed</p>
                  <p className="mt-1 text-sm text-slate-400">{ocrError}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={reset} className="btn-ghost border border-white/10 w-full" id="btn-cancel-ocr">
                Start Over
              </button>
              <button type="button" onClick={retryOCR} className="btn-primary w-full" id="btn-retry-ocr">
                <RefreshIcon /> Retry OCR
              </button>
            </div>
          </section>
        )}

        {/* ═══ DONE STATE (VERIFICATION FORM) ════════ */}
        {step === STEPS.done && uploadResult && (
          <section className="animate-slide-up space-y-5">
            {/* Processed receipt preview thumbnail */}
            {processedPreview && (
              <div className="glass rounded-2xl p-3 flex items-center gap-3">
                <img
                  src={processedPreview}
                  alt="Processed preview"
                  className="h-16 w-16 object-cover rounded-xl border border-white/10 bg-black/50"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    Processed Receipt Image
                  </p>
                  <p className="text-[0.65rem] font-mono text-slate-500 truncate mt-0.5">
                    {uploadResult.imagePath}
                  </p>
                  <span className="inline-block mt-1 text-[0.65rem] font-semibold text-emerald-400">
                    {uploadResult.width}×{uploadResult.height} px • {(uploadResult.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            )}

            {saveError && (
              <div className="glass rounded-2xl border-red-500/30 bg-red-950/30 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5"><AlertIcon /></span>
                  <p className="text-xs text-red-300">{saveError}</p>
                </div>
              </div>
            )}

            {/* Editable Verification Form */}
            <VerificationForm
              ocrData={ocrResult?.extractedData || {}}
              fieldConfidence={ocrResult?.fieldConfidence || {}}
              imagePath={uploadResult.imagePath}
              ocrConfidence={ocrResult?.ocrConfidence || 85}
              initialRoute={uploadResult?.route || selectedRoute}
              initialDate={uploadResult?.date || selectedDate || getLocalDateString()}
              onSave={handleSaveReceipt}
              onRetake={reset}
              isSubmitting={isSaving}
            />
          </section>
        )}

        {/* ═══ SAVED STATE (SUCCESS CONFIRMATION) ════ */}
        {step === STEPS.saved && savedReceiptResult && (
          <section className="animate-slide-up space-y-5" id="saved-confirmation-card">
            <div className={`glass rounded-2xl p-6 text-center ${savedOffline ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border ${
                savedOffline
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              }`}>
                {savedOffline ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <path d="M2 12 7 2h10l5 10-5 10H7z" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                ) : (
                  <CheckIcon />
                )}
              </div>

              <h2 className="mt-4 text-lg font-bold text-slate-100">
                {savedOffline ? 'Receipt Saved Offline' : 'Receipt Saved Successfully!'}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {savedOffline
                  ? 'No internet connection. Receipt will auto-sync when you\'re back online.'
                  : 'Record stored in MongoDB database with verified fields.'}
              </p>

              {/* Offline queue badge */}
              {savedOffline && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-300">Queued for sync</span>
                </div>
              )}

              {/* Inline Duplicate Warning if applicable */}
              {saveWarnings.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-left">
                  <div className="flex items-start gap-2 text-amber-300 text-xs">
                    <span className="mt-0.5"><AlertIcon /></span>
                    <div>
                      <span className="font-semibold block">Duplicate Warning:</span>
                      {saveWarnings.map((w, idx) => (
                        <p key={idx} className="mt-0.5 text-slate-400">{w}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Receipt Summary */}
              <div className="mt-5 rounded-xl bg-slate-900/80 p-4 text-left space-y-2 text-xs border border-white/5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt ID</span>
                  <span className="font-mono text-slate-300">{savedReceiptResult._id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">LR Number</span>
                  <span className="font-mono text-emerald-400 font-bold">{savedReceiptResult.lrNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Consignor</span>
                  <span className="text-slate-200">{savedReceiptResult.consignor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Consignee</span>
                  <span className="text-slate-200">{savedReceiptResult.consignee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination</span>
                  <span className="text-slate-200">{savedReceiptResult.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Freight</span>
                  <span className="text-emerald-400 font-semibold">{savedReceiptResult.freightType}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="btn-primary w-full"
                  id="btn-capture-next"
                >
                  <CameraIcon /> Capture Next
                </button>
                <Link
                  to="/"
                  className="btn-secondary w-full text-center"
                  id="btn-view-all"
                >
                  View Receipts
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ═══ ERROR STATE ═══════════════════════════ */}
        {step === STEPS.error && (
          <section className={`space-y-5 ${shakeError ? 'animate-shake' : 'animate-slide-up'}`}>
            {localPreview && (
              <div className="overflow-hidden rounded-2xl border border-red-500/10 opacity-60">
                <img
                  src={localPreview}
                  alt="Receipt preview"
                  className="max-h-48 w-full object-contain bg-black/50"
                />
              </div>
            )}

            <div className="glass rounded-2xl border-red-500/20 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-red-400"><AlertIcon /></span>
                <div>
                  <p className="text-sm font-semibold text-red-400">Upload Failed</p>
                  <p className="mt-1 text-sm text-slate-400">{error}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={reset}
                className="btn-ghost border border-white/10 w-full"
                id="btn-cancel-retry"
              >
                Start Over
              </button>
              <button
                type="button"
                onClick={retryUpload}
                className="btn-primary w-full"
                id="btn-retry-upload"
              >
                <RefreshIcon /> Retry Upload
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
