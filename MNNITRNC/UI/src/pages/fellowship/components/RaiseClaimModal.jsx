import { useEffect, useState } from 'react';
import { X, Info, Calendar } from 'lucide-react';
import { raiseFellowshipClaim, getMyAppointmentId, getMyAppointment } from '../../../api/fellowshipApi';
import { uploadDocument } from '../../../api/documentsApi';
import {
  MONTHS, HRA_RATE, HRA_SLIP_NOTE, LEAVE_REPORTING_NOTE,
} from '../../../constants/fellowshipEnums';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

export default function RaiseClaimModal({ stipend = 0, onClose, onRaised }) {
  const now = new Date();
  const [formData, setFormData] = useState({
    claimYear: now.getFullYear(),
    claimMonth: now.getMonth() + 1,
    leaveDaysTakenThisMonth: 0,
    unauthorisedAbsenceDays: 0,
    remarks: '',
  });
  const [claimPeriod, setClaimPeriod] = useState('21st-20th');
  const [hraClaimed, setHraClaimed] = useState(false);
  const [hraSlipFile, setHraSlipFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const hraPreview = hraClaimed ? stipend * HRA_RATE : 0;
  const totalPreview = stipend + hraPreview;

  // A remark is required to raise a claim (FellowshipService.RaiseClaimAsync
  // throws WorkflowTransitionException when Remarks is null/whitespace) --
  // gate the submit button here too so the user sees why it's blocked
  // instead of a failed request.
  const remarksBlank = !formData.remarks.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (remarksBlank) {
      setError('A remark is required to raise a fellowship claim.');
      return;
    }

    if (hraClaimed) {
      if (!hraSlipFile) {
        setError('HRA slip document attachment is mandatory to claim HRA allowance. Please attach your HRA slip file.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (hraClaimed && !hraSlipFile) {
        throw new Error("Please select an HRA slip document to upload.");
      }

      const claimId = await raiseFellowshipClaim({
        claimYear: Number(formData.claimYear),
        claimMonth: Number(formData.claimMonth),
        claimPeriod,
        hraClaimed,
        leaveDaysTakenThisMonth: Number(formData.leaveDaysTakenThisMonth) || 0,
        unauthorisedAbsenceDays: Number(formData.unauthorisedAbsenceDays) || 0,
        remarks: formData.remarks || null,
      });

      if (hraClaimed && hraSlipFile) {
        const payload = new FormData();
        payload.append('File', hraSlipFile);
        payload.append('OwnerType', 'FellowshipClaim');
        payload.append('OwnerId', claimId);
        payload.append('Kind', 'HraSlip');
        
        await uploadDocument(payload);
      }

      onRaised?.();
      onClose();
    } catch (err) {
      // Error is shown via the global toast notification
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Claim fellowship</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="claim-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            {/* BRD Compliance Banner */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Calendar size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <strong>Submission Rule:</strong> Fellowship claims are raised on the <strong>20th</strong> or <strong>31st</strong> of every month for period <strong>21st–20th</strong> or <strong>1st–31st</strong>. HRA slip attachment is strictly required for claiming HRA.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Month <span className="text-red-500">*</span></label>
                <select required name="claimMonth" value={formData.claimMonth}
                  onChange={handleChange} className={FIELD_CLASS}>
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Year <span className="text-red-500">*</span></label>
                <input required type="number" name="claimYear" min="2000" max="2100"
                  value={formData.claimYear} onChange={handleChange} className={FIELD_CLASS} />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Claim Period Cycle <span className="text-red-500">*</span></label>
                <select required name="claimPeriod" value={claimPeriod}
                  onChange={(e) => setClaimPeriod(e.target.value)} className={FIELD_CLASS}>
                  <option value="21st-20th">21st–20th (Cutoff: 20th)</option>
                  <option value="1st-31st">1st–31st (Cutoff: 31st)</option>
                </select>
              </div>
            </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={hraClaimed}
                    onChange={(e) => {
                      setHraClaimed(e.target.checked);
                      if (!e.target.checked) setHraSlipFile(null);
                    }}
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500 rounded" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                      Claim the HRA component
                    </span>
                    <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {HRA_SLIP_NOTE}
                    </span>
                  </span>
                </label>
                
                {hraClaimed && (
                  <div className="pl-7 space-y-2 border-l-2 border-blue-200 dark:border-blue-800">
                    <label className={LABEL_CLASS}>HRA Slip Document <span className="text-red-500">*</span></label>
                    <input 
                      type="file" 
                      required
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setHraSlipFile(e.target.files[0])}
                      className="block w-full text-sm text-slate-500 dark:text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        dark:file:bg-blue-900/30 dark:file:text-blue-400"
                    />
                  </div>
                )}
              </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-900 dark:text-blue-200">Fellowship</span>
                <span className="font-semibold tabular-nums text-blue-900 dark:text-blue-100">
                  {formatCurrency(stipend)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-900 dark:text-blue-200">HRA</span>
                <span className="font-semibold tabular-nums text-blue-900 dark:text-blue-100">
                  {formatCurrency(hraPreview)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-200 dark:border-blue-800/60 text-sm">
                <span className="font-bold text-blue-900 dark:text-blue-200">Total</span>
                <span className="font-bold tabular-nums text-blue-900 dark:text-blue-100">
                  {formatCurrency(totalPreview)}
                </span>
              </div>
              <p className="text-xs pt-1 text-blue-800 dark:text-blue-300/90">
                Calculated by the server on submission.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>{LEAVE_REPORTING_NOTE}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Leave days taken this month</label>
                  <input type="number" min="0" max="31" name="leaveDaysTakenThisMonth"
                    value={formData.leaveDaysTakenThisMonth} onChange={handleChange}
                    className={FIELD_CLASS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Days of unauthorised absence</label>
                  <input type="number" min="0" max="31" name="unauthorisedAbsenceDays"
                    value={formData.unauthorisedAbsenceDays} onChange={handleChange}
                    className={FIELD_CLASS} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className={LABEL_CLASS}>Remarks <span className="text-red-500">*</span></label>
              <textarea required name="remarks" rows="2" value={formData.remarks}
                onChange={handleChange} placeholder="A remark is required to raise this claim"
                className={`${FIELD_CLASS} custom-scrollbar`} />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button type="button" onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
            Cancel
          </button>
          <button type="submit" form="claim-form" disabled={isSubmitting || remarksBlank}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg">
            {isSubmitting ? 'Submitting…' : 'Submit claim'}
          </button>
        </div>
      </div>
    </div>
  );
}


