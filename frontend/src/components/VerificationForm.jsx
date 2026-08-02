import { useState } from 'react';
import { fetchSuggestions } from '../api/receipts';

const CONFIDENCE_THRESHOLD = 75;

/* Inline Icons */
const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-amber-400">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-400">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

/* Autocomplete Dropdown Component for Consignor, Consignee & Destination */
function AutocompleteInput({ id, field, value, onChange, placeholder, className, error }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleInputChange = async (e) => {
    const val = e.target.value;
    onChange(val);

    if (val.trim().length >= 1) {
      const matches = await fetchSuggestions(field, val);
      setSuggestions(matches);
      setShowDropdown(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (item) => {
    onChange(item);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputChange}
        onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-slate-900 border border-emerald-500/40 shadow-2xl shadow-black">
          {suggestions.map((item, idx) => (
            <li
              key={idx}
              onMouseDown={() => handleSelect(item)}
              className="px-3.5 py-2.5 text-xs text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300 cursor-pointer transition flex items-center justify-between border-b border-white/5 last:border-0"
            >
              <span>{item}</span>
              <span className="text-[0.65rem] text-emerald-400/80 font-mono font-semibold">Suggested</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VerificationForm({
  ocrData = {},
  fieldConfidence = {},
  imagePath = '',
  ocrConfidence = 90,
  onSave,
  onRetake,
  isSubmitting = false,
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    lrNumber: ocrData.lrNumber || '',
    route: ocrData.route || 'MALUR-MASTHI',
    ewayBillNumber: ocrData.ewayBillNumber || '',
    date: ocrData.date || todayStr,
    consignor: ocrData.consignor || '',
    consignee: ocrData.consignee || '',
    destination: ocrData.destination || '',
    articles: ocrData.articles || '',
    description: ocrData.description || '',
    invoiceNumber: ocrData.invoiceNumber || '',
    freightType: ocrData.freightType === 'To Pay' ? 'To Pay' : 'Paid',
    acknowledgementStatus: ocrData.acknowledgementStatus || 'Pending',
    remarks: ocrData.remarks || '',
    enteredBy: 'Dispatcher',
  });

  const [touchedFields, setTouchedFields] = useState({});
  const [formErrors, setFormErrors] = useState({});

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouchedFields((prev) => ({ ...prev, [field]: true }));

    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  }

  function getFieldConfidence(fieldName) {
    return fieldConfidence[fieldName] ?? (formData[fieldName] ? 90 : 50);
  }

  function isLowConfidence(fieldName) {
    const conf = getFieldConfidence(fieldName);
    const isEmpty = !formData[fieldName] || formData[fieldName].trim() === '';
    return (conf < CONFIDENCE_THRESHOLD || isEmpty) && !touchedFields[fieldName];
  }

  function validate() {
    const errors = {};
    if (!formData.lrNumber.trim()) errors.lrNumber = 'LR Number is required';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.consignor.trim()) errors.consignor = 'Consignor (Seller) is required';
    if (!formData.consignee.trim()) errors.consignee = 'Consignee (Buyer) is required';
    if (!formData.destination.trim()) errors.destination = 'Destination is required';

    if (formData.ewayBillNumber && formData.ewayBillNumber.trim() && !/^\d{12}$/.test(formData.ewayBillNumber.trim())) {
      errors.ewayBillNumber = 'E-Way Bill Number must be exactly 12 digits';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...formData,
      imagePath,
      ocrConfidence,
      verificationStatus: 'Verified',
    };

    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up" id="verification-form">
      <div className="glass rounded-2xl p-5 space-y-4 border-emerald-500/20">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-100">Digital LR Entry & Verification</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Type to see auto-suggestions for repeat Sellers & Buyers.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[0.65rem] uppercase font-semibold text-slate-500 block">Overall Score</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{ocrConfidence}%</span>
          </div>
        </div>

        {/* Form fields grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Transport Route Selection */}
          <div className="space-y-1 col-span-1 md:col-span-2">
            <label className="font-semibold text-xs text-slate-300 block">
              Transport Route <span className="text-emerald-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleChange('route', 'MALUR-MASTHI')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  formData.route === 'MALUR-MASTHI'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                🚛 MALUR-MASTHI ROUTE
              </button>
              <button
                type="button"
                onClick={() => handleChange('route', 'NELAMANGALA')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  formData.route === 'NELAMANGALA'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md shadow-blue-950/40'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                🚚 NELAMANGALA ROUTE
              </button>
            </div>
          </div>

          {/* LR Number */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="lrNumber" className="font-semibold text-slate-300">
                LR Number <span className="text-emerald-400">*</span>
              </label>
              {isLowConfidence('lrNumber') ? (
                <span className="flex items-center gap-1 text-[0.65rem] text-amber-400 font-medium">
                  <AlertTriangleIcon /> Needs Review ({getFieldConfidence('lrNumber')}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400">
                  <CheckIcon /> Verified
                </span>
              )}
            </div>
            <input
              id="lrNumber"
              type="text"
              value={formData.lrNumber}
              onChange={(e) => handleChange('lrNumber', e.target.value)}
              placeholder="e.g. LR-100293"
              className={`w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border font-mono transition focus:outline-none ${
                formErrors.lrNumber
                  ? 'border-red-500/80 bg-red-950/20'
                  : isLowConfidence('lrNumber')
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-white/10 focus:border-emerald-500/60'
              }`}
            />
            {formErrors.lrNumber && (
              <p className="text-[0.7rem] text-red-400">{formErrors.lrNumber}</p>
            )}
          </div>

          {/* 12-Digit E-Way Bill Number */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="ewayBillNumber" className="font-semibold text-slate-300">
                E-Way Bill Number (12 Digits)
              </label>
              {formData.ewayBillNumber && /^\d{12}$/.test(formData.ewayBillNumber.trim()) && (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400">
                  <CheckIcon /> 12 Digits
                </span>
              )}
            </div>
            <input
              id="ewayBillNumber"
              type="text"
              maxLength={12}
              value={formData.ewayBillNumber}
              onChange={(e) => handleChange('ewayBillNumber', e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 123456789012"
              className={`w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border font-mono transition focus:outline-none ${
                formErrors.ewayBillNumber
                  ? 'border-red-500/80 bg-red-950/20'
                  : 'border-white/10 focus:border-emerald-500/60'
              }`}
            />
            {formErrors.ewayBillNumber && (
              <p className="text-[0.7rem] text-red-400">{formErrors.ewayBillNumber}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="date" className="font-semibold text-slate-300">
                Date <span className="text-emerald-400">*</span>
              </label>
              {isLowConfidence('date') ? (
                <span className="flex items-center gap-1 text-[0.65rem] text-amber-400 font-medium">
                  <AlertTriangleIcon /> Needs Review ({getFieldConfidence('date')}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400">
                  <CheckIcon /> Verified
                </span>
              )}
            </div>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={`w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border font-mono transition focus:outline-none ${
                formErrors.date
                  ? 'border-red-500/80 bg-red-950/20'
                  : isLowConfidence('date')
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-white/10 focus:border-emerald-500/60'
              }`}
            />
            {formErrors.date && <p className="text-[0.7rem] text-red-400">{formErrors.date}</p>}
          </div>

          {/* Consignor (Seller) with Autocomplete */}
          <div className="space-y-1 col-span-1 md:col-span-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="consignor" className="font-semibold text-slate-300">
                Consignor / Seller <span className="text-emerald-400">*</span>
              </label>
              {isLowConfidence('consignor') ? (
                <span className="flex items-center gap-1 text-[0.65rem] text-amber-400 font-medium">
                  <AlertTriangleIcon /> Needs Review ({getFieldConfidence('consignor')}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400">
                  <CheckIcon /> Verified
                </span>
              )}
            </div>
            <AutocompleteInput
              id="consignor"
              field="consignor"
              value={formData.consignor}
              onChange={(val) => handleChange('consignor', val)}
              placeholder="Type seller name (shows suggestions)..."
              className={`w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border transition focus:outline-none ${
                formErrors.consignor
                  ? 'border-red-500/80 bg-red-950/20'
                  : isLowConfidence('consignor')
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-white/10 focus:border-emerald-500/60'
              }`}
            />
            {formErrors.consignor && (
              <p className="text-[0.7rem] text-red-400">{formErrors.consignor}</p>
            )}
          </div>

          {/* Consignee (Buyer) with Autocomplete */}
          <div className="space-y-1 col-span-1 md:col-span-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="consignee" className="font-semibold text-slate-300">
                Consignee / Buyer <span className="text-emerald-400">*</span>
              </label>
              {isLowConfidence('consignee') ? (
                <span className="flex items-center gap-1 text-[0.65rem] text-amber-400 font-medium">
                  <AlertTriangleIcon /> Needs Review ({getFieldConfidence('consignee')}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400">
                  <CheckIcon /> Verified
                </span>
              )}
            </div>
            <AutocompleteInput
              id="consignee"
              field="consignee"
              value={formData.consignee}
              onChange={(val) => handleChange('consignee', val)}
              placeholder="Type buyer name (shows suggestions)..."
              className={`w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border transition focus:outline-none ${
                formErrors.consignee
                  ? 'border-red-500/80 bg-red-950/20'
                  : isLowConfidence('consignee')
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-white/10 focus:border-emerald-500/60'
              }`}
            />
            {formErrors.consignee && (
              <p className="text-[0.7rem] text-red-400">{formErrors.consignee}</p>
            )}
          </div>

          {/* Destination with Autocomplete */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="destination" className="font-semibold text-slate-300">
                Destination <span className="text-emerald-400">*</span>
              </label>
              {isLowConfidence('destination') ? (
                <span className="flex items-center gap-1 text-[0.65rem] text-amber-400 font-medium">
                  <AlertTriangleIcon /> Needs Review ({getFieldConfidence('destination')}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400">
                  <CheckIcon /> Verified
                </span>
              )}
            </div>
            <AutocompleteInput
              id="destination"
              field="destination"
              value={formData.destination}
              onChange={(val) => handleChange('destination', val)}
              placeholder="Destination city (shows suggestions)..."
              className={`w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border transition focus:outline-none ${
                formErrors.destination
                  ? 'border-red-500/80 bg-red-950/20'
                  : isLowConfidence('destination')
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-white/10 focus:border-emerald-500/60'
              }`}
            />
            {formErrors.destination && (
              <p className="text-[0.7rem] text-red-400">{formErrors.destination}</p>
            )}
          </div>

          {/* Freight Type */}
          <div className="space-y-1">
            <label className="font-semibold text-xs text-slate-300 block">
              Freight Payment <span className="text-emerald-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleChange('freightType', 'Paid')}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  formData.freightType === 'Paid'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => handleChange('freightType', 'To Pay')}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  formData.freightType === 'To Pay'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                To Pay
              </button>
            </div>
          </div>

          {/* Articles */}
          <div className="space-y-1">
            <label htmlFor="articles" className="font-semibold text-xs text-slate-300 block">
              Articles / Package Count
            </label>
            <input
              id="articles"
              type="text"
              value={formData.articles}
              onChange={(e) => handleChange('articles', e.target.value)}
              placeholder="e.g. 20 Boxes / 5 Cartons"
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border border-white/10 transition focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Invoice Number */}
          <div className="space-y-1">
            <label htmlFor="invoiceNumber" className="font-semibold text-xs text-slate-300 block">
              Invoice Number
            </label>
            <input
              id="invoiceNumber"
              type="text"
              value={formData.invoiceNumber}
              onChange={(e) => handleChange('invoiceNumber', e.target.value)}
              placeholder="e.g. INV-9921"
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border border-white/10 font-mono transition focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Description */}
          <div className="space-y-1 col-span-1 md:col-span-2">
            <label htmlFor="description" className="font-semibold text-xs text-slate-300 block">
              Description of Goods
            </label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="e.g. Auto components & electrical parts"
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border border-white/10 transition focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1 col-span-1 md:col-span-2">
            <label htmlFor="remarks" className="font-semibold text-xs text-slate-300 block">
              Remarks / Notes
            </label>
            <input
              id="remarks"
              type="text"
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Additional notes"
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-slate-100 border border-white/10 transition focus:outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={onRetake}
          disabled={isSubmitting}
          className="btn-secondary w-full"
          id="btn-retake-photo"
        >
          <RefreshIcon /> Reset / Change Photo
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full"
          id="btn-save-receipt"
        >
          {isSubmitting ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <SaveIcon /> Save Digital Receipt
            </>
          )}
        </button>
      </div>
    </form>
  );
}
