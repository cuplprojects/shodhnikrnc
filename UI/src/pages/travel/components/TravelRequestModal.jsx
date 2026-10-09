import { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, ChevronDown, UploadCloud } from 'lucide-react';
import { raiseTravelRequest } from '../../../api/travelApi';
import { uploadDocument } from '../../../api/documentsApi';
import {
  TRAVELER_TYPES,
  TRAVEL_MODES,
  TAXI_OPT_IN_NOTICE,
  computeTravelTotal,
  TRAVEL_BUDGET_HEAD,
} from '../../../constants/travelEnums';
import { formatCurrency } from '../../projects/utils/currency';
import JourneyLegsFieldArray from './JourneyLegsFieldArray';
import { getIndentBudget } from '../../../api/procurementApi';
import { Wallet } from 'lucide-react';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

function MultiSelectDropdown({ options, selectedValues = [], onChange, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const removeOption = (e, val) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== val));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`${FIELD_CLASS} min-h-[42px] cursor-pointer flex flex-wrap items-center gap-1.5 justify-between py-1.5`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedValues.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          ) : (
            selectedValues.map((val) => {
              const opt = options.find((o) => o.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800"
                >
                  {opt?.label || val}
                  <button
                    type="button"
                    onClick={(e) => removeOption(e, val)}
                    className="hover:text-blue-900 dark:hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600"
                />
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultiBudgetAvailabilityBadge({ budgetHeadIds, estimatedCost }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    if (!budgetHeadIds || budgetHeadIds.length === 0) {
      setSnapshot(null);
      return;
    }

    Promise.all(budgetHeadIds.map(id => getIndentBudget(id)))
      .then((data) => {
        if (!active) return;
        const total = data.reduce((acc, curr) => ({
          sanctioned: acc.sanctioned + curr.sanctioned,
          committed: acc.committed + curr.committed,
          paid: acc.paid + curr.paid,
          available: acc.available + curr.available,
        }), { sanctioned: 0, committed: 0, paid: 0, available: 0 });
        setSnapshot(total);
      })
      .catch(() => {
        if (active) setError('Could not load budget availability.');
      });

    return () => {
      active = false;
    };
  }, [budgetHeadIds]);

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        {error}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        Loading budget availability…
      </div>
    );
  }

  const cost = Number(estimatedCost);
  const exceeds = Number.isFinite(cost) && cost > 0 && cost > snapshot.available;

  const shellClass = exceeds
    ? 'border-red-300 bg-red-50 dark:border-red-700/60 dark:bg-red-900/20'
    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20';

  const iconClass = exceeds
    ? 'text-red-600 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`p-4 rounded-xl border ${shellClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {exceeds
          ? <AlertTriangle size={16} className={iconClass} />
          : <Wallet size={16} className={iconClass} />}
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Total Budget Availability ({budgetHeadIds.length} head{budgetHeadIds.length !== 1 && 's'})
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Sanctioned</dt>
          <dd className="mt-0.5 tabular-nums">{formatCurrency(snapshot.sanctioned)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Committed</dt>
          <dd className="mt-0.5 tabular-nums">{formatCurrency(snapshot.committed)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Paid</dt>
          <dd className="mt-0.5 tabular-nums">{formatCurrency(snapshot.paid)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Available</dt>
          <dd className="mt-0.5 tabular-nums font-bold">{formatCurrency(snapshot.available)}</dd>
        </div>
      </dl>

      {exceeds && (
        <p className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300">
          The estimated cost exceeds the total available balance. This request will be rejected.
        </p>
      )}
    </div>
  );
}

/**
 * Raise a travel request against a project's travel budget head.
 *
 * The displayed total is advisory: the server recomputes it from the legs and
 * the two expense fields on every raise, and nothing here is sent as a total.
 */
export default function TravelRequestModal({
  projectId,
  budgetHeads = [],
  manpowerPositions = [],
  isFellow = false,
  onClose,
  onRaised,
}) {
  const [formData, setFormData] = useState({
    budgetHeadIds: budgetHeads.length > 0 ? [budgetHeads.find(h => h.headName === TRAVEL_BUDGET_HEAD)?.id || budgetHeads[0]?.id].filter(Boolean) : [],
    travelerTypes: isFellow ? ['Manpower'] : ['Self'],
    otherTravelerDetails: '',
    manpowerId: '',
    coPiName: '',
    coPiDesignation: '',
    place: '',
    purpose: '',
    onwardDate: '',
    returnDate: '',
    primaryModes: [],
    otherPrimaryModeDetails: '',
    accommodationDetails: '',
    accommodationCost: '',
    otherExpensesDetails: '',
    otherExpensesCost: '',
  });
  const [journeys, setJourneys] = useState([
    { from: '', to: '', date: '', mode: 'Rail', platform: 'IRCTC', amount: '', remarks: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const total = computeTravelTotal(
    journeys, formData.accommodationCost, formData.otherExpensesCost);

  let numberOfDays = 0;
  if (formData.onwardDate && formData.returnDate) {
    const from = new Date(formData.onwardDate);
    const to = new Date(formData.returnDate);
    if (to >= from) {
      numberOfDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.travelerTypes.length === 0) {
      setError('Please select at least one Traveller option.');
      return;
    }

    if (formData.travelerTypes.includes('Other') && !formData.otherTravelerDetails?.trim()) {
      setError('Please specify details for Other traveller.');
      return;
    }

    if (formData.travelerTypes.includes('Manpower') && !isFellow && !formData.manpowerId) {
      setError('Please select a Sanctioned Position for Project Manpower.');
      return;
    }

    if (formData.travelerTypes.includes('CoPi') && (!formData.coPiName?.trim() || !formData.coPiDesignation?.trim())) {
      setError('Please provide Co-PI Name and Designation.');
      return;
    }

    if (formData.primaryModes.length === 0) {
      setError('Please select at least one Primary Mode of Travel.');
      return;
    }

    if (formData.primaryModes.includes('Other') && !formData.otherPrimaryModeDetails?.trim()) {
      setError('Please specify details for Other mode of travel.');
      return;
    }

    if (journeys.length === 0) {
      setError('Add at least one journey leg.');
      return;
    }

    for (let i = 0; i < journeys.length; i++) {
      const leg = journeys[i];
      if (leg.arrivalDate && leg.date && leg.arrivalDate < leg.date) {
        setError(`Leg ${i + 1} Arrival Date (${leg.arrivalDate}) cannot be earlier than Departure Date (${leg.date}).`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    if (formData.budgetHeadIds.length === 0) {
      setError('Please select at least one Budget Head.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      budgetHeadIds: formData.budgetHeadIds,
      travelerType: formData.travelerTypes[0] || 'Self',
      travelerTypes: formData.travelerTypes,
      otherTravelerDetails: formData.travelerTypes.includes('Other') ? formData.otherTravelerDetails : null,
      manpowerId: (formData.travelerTypes.includes('Manpower') && formData.manpowerId) ? formData.manpowerId : null,
      coPiName: formData.travelerTypes.includes('CoPi') ? formData.coPiName : null,
      coPiDesignation: formData.travelerTypes.includes('CoPi') ? formData.coPiDesignation : null,
      place: formData.place,
      purpose: formData.purpose,
      onwardDate: formData.onwardDate,
      returnDate: formData.returnDate,
      primaryMode: formData.primaryModes[0] || 'Rail',
      primaryModes: formData.primaryModes,
      otherPrimaryModeDetails: formData.primaryModes.includes('Other') ? formData.otherPrimaryModeDetails : null,
      taxiReimbursementOptedIn: journeys.some((leg) => leg.mode === 'RoadPrivateTaxi'),
      taxiReason: null,
      accommodationDetails: formData.accommodationDetails || null,
      accommodationCost: Number(formData.accommodationCost) || 0,
      otherExpensesDetails: formData.otherExpensesDetails || null,
      otherExpensesCost: Number(formData.otherExpensesCost) || 0,
      journeys: journeys.map((leg) => ({
        from: leg.from,
        to: leg.to,
        date: leg.date,
        arrivalDate: leg.arrivalDate || null,
        mode: leg.mode,
        platform: leg.platform,
        amount: Number(leg.amount) || 0,
        remarks: leg.remarks || null,
      })),
    };

    try {
      const travelRequestId = await raiseTravelRequest(projectId, payload);

      // Upload documents
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const docFormData = new FormData();
          docFormData.append('File', file);
          docFormData.append('OwnerType', 'TravelRequest');
          docFormData.append('OwnerId', travelRequestId);
          docFormData.append('Kind', 'SupportingDocument');
          
          await uploadDocument(docFormData);
        }
      }

      onRaised?.(travelRequestId);
      onClose();
    } catch (err) {
      // Error is shown via the global toast notification
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Raise Travel Request</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form 
            id="travel-form" 
            onSubmit={handleSubmit} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
                e.preventDefault();
              }
            }}
            className="space-y-6"
          >
            {error && (
              <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className={LABEL_CLASS}>Budget Heads <span className="text-red-500">*</span></label>
              <MultiSelectDropdown
                options={budgetHeads.map(h => ({ value: h.id, label: h.displayName || h.headName }))}
                selectedValues={formData.budgetHeadIds}
                onChange={(ids) => setFormData((prev) => ({ ...prev, budgetHeadIds: ids }))}
                placeholder="Select Budget Head(s)"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Costs will be deducted in the order selected if the first head runs out of funds.</p>
            </div>

            <MultiBudgetAvailabilityBadge
              budgetHeadIds={formData.budgetHeadIds}
              estimatedCost={total}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Traveller <span className="text-red-500">*</span>
                </label>
                {isFellow ? (
                  <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 font-medium">
                    Self (Project Staff / Fellow)
                  </div>
                ) : (
                  <MultiSelectDropdown
                    options={TRAVELER_TYPES}
                    selectedValues={formData.travelerTypes}
                    onChange={(vals) => setFormData(p => ({ ...p, travelerTypes: vals }))}
                    placeholder="Select Traveller(s)"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Primary Mode of Travel <span className="text-red-500">*</span></label>
                <MultiSelectDropdown
                  options={TRAVEL_MODES}
                  selectedValues={formData.primaryModes}
                  onChange={(modes) => setFormData((prev) => ({ ...prev, primaryModes: modes }))}
                  placeholder="Select Mode(s)"
                />
              </div>
            </div>

            {formData.travelerTypes.includes('Other') && (
              <div className="space-y-1 animate-in fade-in slide-in-">
                <label className={LABEL_CLASS}>Specify Other Traveller <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  name="otherTravelerDetails"
                  value={formData.otherTravelerDetails}
                  onChange={handleChange}
                  placeholder="Type details of other traveller(s)"
                  className={FIELD_CLASS}
                />
              </div>
            )}

            {formData.primaryModes.includes('Other') && (
              <div className="space-y-1 animate-in fade-in slide-in-">
                <label className={LABEL_CLASS}>Specify Other Primary Mode of Travel <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  name="otherPrimaryModeDetails"
                  value={formData.otherPrimaryModeDetails}
                  onChange={handleChange}
                  placeholder="Type details of other travel mode"
                  className={FIELD_CLASS}
                />
              </div>
            )}

            {formData.travelerTypes.includes('Manpower') && !isFellow && (
              <div className="space-y-1 animate-in fade-in slide-in-">
                <label className={LABEL_CLASS}>Sanctioned Position <span className="text-red-500">*</span></label>
                <select
                  required
                  name="manpowerId"
                  value={formData.manpowerId}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                >
                  <option value="">Select Position</option>
                  {manpowerPositions.map((p) => (
                    <option key={p.id} value={p.id}>{p.designation}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.travelerTypes.includes('CoPi') && !isFellow && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Co-PI Name <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    name="coPiName"
                    value={formData.coPiName}
                    onChange={handleChange}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Co-PI Designation <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    name="coPiDesignation"
                    value={formData.coPiDesignation}
                    onChange={handleChange}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Place of Visit <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  name="place"
                  value={formData.place}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>From Date <span className="text-red-500">*</span></label>
                <input
                  required
                  type="date"
                  name="onwardDate"
                  value={formData.onwardDate}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>To Date <span className="text-red-500">*</span></label>
                <input
                  required
                  type="date"
                  name="returnDate"
                  min={formData.onwardDate || undefined}
                  value={formData.returnDate}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Number of Days</label>
                <input
                  readOnly
                  type="number"
                  value={numberOfDays}
                  className={`${FIELD_CLASS} bg-slate-100 dark:bg-slate-700 cursor-not-allowed`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={LABEL_CLASS}>Purpose of Visit <span className="text-red-500">*</span></label>
              <textarea
                required
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                rows="2"
                className={`${FIELD_CLASS} custom-scrollbar`}
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <JourneyLegsFieldArray
                items={journeys}
                onChange={setJourneys}
                minDate={formData.onwardDate}
                maxDate={formData.returnDate}
              />
            </div>

            


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Accommodation Details</label>
                <input
                  type="text"
                  name="accommodationDetails"
                  value={formData.accommodationDetails}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Accommodation Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="accommodationCost"
                  value={formData.accommodationCost}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Other Expenses Details</label>
                <input
                  type="text"
                  name="otherExpensesDetails"
                  value={formData.otherExpensesDetails}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Other Expenses Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="otherExpensesCost"
                  value={formData.otherExpensesCost}
                  onChange={handleChange}
                  className={FIELD_CLASS}
                />
              </div>
            </div>
              <div className="space-y-1">
              <label className={LABEL_CLASS}>
                Supporting Documents
              </label>
              <div className="relative">
                <input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Upload supporting documents"
                />
                <div className={`flex items-center gap-2 ${FIELD_CLASS} text-slate-500 dark:text-slate-400 cursor-pointer`}>
                  <UploadCloud size={18} />
                  <span>
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : 'Choose files to upload...'}
                  </span>
                </div>
              </div>
              {selectedFiles.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {selectedFiles.map((f, i) => (
                    <li key={i} className="truncate">• {f.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20">
              <div>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  Total Expected Cost (₹)
                </p>
                <p className="text-xs mt-0.5 text-blue-800 dark:text-blue-300/90">
                  Journeys plus accommodation and other expenses. The server
                  recalculates this on submission.
                </p>
              </div>
              <span className="text-lg font-bold tabular-nums text-blue-900 dark:text-blue-100">
                {formatCurrency(total)}
              </span>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="travel-form"
            disabled={isSubmitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 text-white font-semibold rounded-lg shadow-sm transition-all"
          >
            {isSubmitting ? 'Raising…' : 'Raise Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
