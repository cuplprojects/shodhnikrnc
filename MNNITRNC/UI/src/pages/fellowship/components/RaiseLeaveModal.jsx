import { useState } from 'react';
import { X, Info, AlertTriangle, UploadCloud } from 'lucide-react';
import { raiseLeaveRequest } from '../../../api/fellowshipApi';
import { uploadDocument } from '../../../api/documentsApi';
import { LEAVE_TYPES, PENDING_LEAVE_NOTE } from '../../../constants/fellowshipEnums';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

import DatePicker from "react-multi-date-picker";
const MultiDatePicker = DatePicker.default || DatePicker;

export default function RaiseLeaveModal({ balances = [], onClose, onRaised }) {
  const [formData, setFormData] = useState({
    leaveType: 'Annual',
    dates: [],
    outOfStationDates: [],
    purpose: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const requested = formData.dates.length;
  const balance = balances.find((b) => b.leaveType === formData.leaveType);
  const remaining = balance?.remainingDays ?? 0;
  const exceeds = requested > remaining;
  const isSpecial = formData.leaveType === 'Special';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        leaveType: formData.leaveType,
        dates: formData.dates.map(d => d.format?.('YYYY-MM-DD') || d),
        outOfStationDates: formData.outOfStationDates.map(d => d.format?.('YYYY-MM-DD') || d),
        purpose: formData.purpose || null,
      };
      const leaveId = await raiseLeaveRequest(payload);
      
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const form = new FormData();
          form.append("File", file);
          form.append("OwnerType", "LeaveRequest");
          form.append("OwnerId", leaveId);
          form.append("Kind", "SupportingDocument");
          await uploadDocument(form);
        }
      }

      onRaised?.();
      onClose();
    } catch (err) {
      // Error is shown via the global toast notification
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col my-auto mt-10 z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Apply for leave</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <form id="leave-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className={LABEL_CLASS}>Leave type <span className="text-red-500">*</span></label>
              <select required name="leaveType" value={formData.leaveType}
                onChange={handleChange} className={FIELD_CLASS}>
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {balance && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Entitled</span>
                  <span className="tabular-nums">{balance.entitledDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Already approved</span>
                  <span className="tabular-nums">{balance.consumedDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Applied for, not yet approved</span>
                  <span className="tabular-nums">{balance.pendingDays} days</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                  <span>Remaining</span>
                  <span className="tabular-nums">{balance.remainingDays} days</span>
                </div>
                <p className="flex items-start gap-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  {PENDING_LEAVE_NOTE}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className={LABEL_CLASS}>Dates <span className="text-red-500">*</span></label>
              <div className="w-full">
                <MultiDatePicker
                  multiple
                  value={formData.dates}
                  onChange={(dateObjects) => setFormData(prev => ({ ...prev, dates: dateObjects }))}
                  format="DD/MM/YYYY"
                  containerClassName="w-full"
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.5rem" }}
                  inputClass={FIELD_CLASS}
                  placeholder="Select leave dates"
                  required
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>
                Out-of-Station Dates <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative mt-2 z-40">
                <MultiDatePicker
                  multiple
                  value={formData.outOfStationDates}
                  onChange={(dateObjects) => setFormData(prev => ({ ...prev, outOfStationDates: dateObjects }))}
                  format="DD/MM/YYYY"
                  containerClassName="w-full"
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.5rem" }}
                  inputClass={FIELD_CLASS}
                  placeholder="Select out-of-station dates"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                These dates are for information only and do not deduct from your leave balance.
              </p>
            </div>

            {requested > 0 && (
              <div className={`p-3 rounded-xl border text-sm font-semibold ${
                exceeds
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-400'
              }`}>
                {exceeds ? (
                  <span className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    {requested} days requested, but only {remaining} remain. This will be rejected.
                  </span>
                ) : (
                  <>{requested} day(s) requested — {remaining - requested} would remain.</>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className={LABEL_CLASS}>
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea required name="purpose" rows="2" value={formData.purpose}
                onChange={handleChange} className={`${FIELD_CLASS} custom-scrollbar`}
                placeholder="Briefly describe the purpose of your leave" />
              {isSpecial && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Special leave is for conference participation and requires a stated purpose.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={LABEL_CLASS}>
                Supporting Documents <span className="text-slate-400 font-normal">(Optional)</span>
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
                    <li key={i} className="truncate">â€¢ {f.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
            Cancel
          </button>
          <button type="submit" form="leave-form" disabled={isSubmitting || exceeds}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg">
            {isSubmitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  );
}
