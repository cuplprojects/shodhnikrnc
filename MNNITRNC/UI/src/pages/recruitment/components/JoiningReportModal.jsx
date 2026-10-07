import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { submitMyJoiningReport } from '../../../api/recruitmentApi';
import CandidateDocumentSlot from './ApplicationWizard/CandidateDocumentSlot';

function formatAadharNumber(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join('-');
}

function formatPanNumber(val) {
  if (!val) return '';
  return String(val).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

const FIELD_CLASS =
  'w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 ' +
  'dark:text-white outline-none focus:ring-1 focus:ring-blue-500';

/**
 * The candidate's own joining-report submission, opened from
 * MyApplicationsPage once their offer has been issued (application.stage ===
 * 'OfferIssued'). Same fields SubmitJoiningReportAsync's PI-facing form used
 * to collect on RecruitmentDetailPage -- moved here because the PI no longer
 * fills this in on the candidate's behalf (client request, 2026-09-15).
 * Submitting forwards straight to the PI's own review step, not to HOD
 * directly.
 */
export default function JoiningReportModal({ application, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    aadharNo: '',
    panNo: '',
    bankAccountNo: '',
    ifscCode: '',
    dob: '',
    gender: '',
    joinedOn: '',
    validTill: '',
    recommendedStipend: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Both are required to submit at all -- see SaveJoiningReportAsync's own
  // document-existence gate, which throws JoiningDocumentsMissingException
  // if either is missing. Owned by the Fellow's own Candidate row.
  const [signedOfferLetterId, setSignedOfferLetterId] = useState(null);
  const [contractOfEngagementId, setContractOfEngagementId] = useState(null);

  if (!application) return null;

  const bothDocumentsUploaded = Boolean(signedOfferLetterId) && Boolean(contractOfEngagementId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!bothDocumentsUploaded) {
      setError('Please upload both the signed Offer Letter and the signed Contract of Engagement before submitting.');
      return;
    }

    const stipendVal = parseFloat(form.recommendedStipend || 0);
    if (stipendVal < 0) {
      setError('Recommended stipend cannot be negative.');
      return;
    }
    if (form.aadharNo && !/^\d{4}-\d{4}-\d{4}$/.test(form.aadharNo)) {
      setError('Aadhar number must be 12 digits in 1111-2222-3333 format.');
      return;
    }
    if (form.panNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNo)) {
      setError('PAN number must be 10 characters in AAAAA1234J format.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitMyJoiningReport(application.id, {
        joinedOn: form.joinedOn,
        validTill: form.validTill,
        recommendedStipend: stipendVal,
        aadharNo: form.aadharNo,
        panNo: form.panNo,
        bankAccountNo: form.bankAccountNo,
        ifscCode: form.ifscCode,
        dob: form.dob,
        gender: form.gender,
      });
      onSubmitted?.();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Submit Joining Report</h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{application.fullName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            Provide your joining details, bank credentials, and Aadhar/PAN information. This will be sent to your PI for review before routing to HOD and Dean/DR for approval.
          </div>

          <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Required documents -- both must be uploaded before you can submit
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CandidateDocumentSlot
                ownerType="Candidate"
                ownerId={application.id}
                kind="SignedOfferLetter"
                label="Signed Offer Letter"
                required
                documentId={signedOfferLetterId}
                onChange={setSignedOfferLetterId}
              />
              <CandidateDocumentSlot
                ownerType="Candidate"
                ownerId={application.id}
                kind="ContractOfEngagement"
                label="Signed Contract of Engagement"
                required
                documentId={contractOfEngagementId}
                onChange={setContractOfEngagementId}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Aadhar Number *</label>
              <input
                required
                type="text"
                maxLength={14}
                pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}"
                title="12-digit Aadhar number in 1111-2222-3333 format"
                value={form.aadharNo}
                onChange={(e) => setForm({ ...form, aadharNo: formatAadharNumber(e.target.value) })}
                placeholder="1111-2222-3333"
                className={`${FIELD_CLASS} font-mono`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">PAN Number *</label>
              <input
                required
                type="text"
                maxLength={10}
                pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}"
                title="10-character PAN number in AAAAA1234J format"
                value={form.panNo}
                onChange={(e) => setForm({ ...form, panNo: formatPanNumber(e.target.value) })}
                placeholder="AAAAA1234J"
                className={`${FIELD_CLASS} font-mono uppercase`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bank Account Number *</label>
              <input
                required
                type="text"
                value={form.bankAccountNo}
                onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                placeholder="Account number"
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">IFSC Code *</label>
              <input
                required
                type="text"
                pattern="[a-zA-Z]{4}0[a-zA-Z0-9]{6}"
                title="11-character IFSC"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                placeholder="SBIN0001234"
                className={`${FIELD_CLASS} uppercase`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Recommended Stipend (₹) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.recommendedStipend}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== '' && Number(val) < 0) return;
                  setForm({ ...form, recommendedStipend: val });
                }}
                placeholder="Stipend amount"
                className={`${FIELD_CLASS} font-mono`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Date of Birth *</label>
              <input required type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className={FIELD_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Joined On Date *</label>
              <input required type="date" value={form.joinedOn} onChange={(e) => setForm({ ...form, joinedOn: e.target.value })} className={FIELD_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tenure Valid Till *</label>
              <input required type="date" value={form.validTill} onChange={(e) => setForm({ ...form, validTill: e.target.value })} className={FIELD_CLASS} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gender *</label>
              <select required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={FIELD_CLASS}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !bothDocumentsUploaded}
              title={!bothDocumentsUploaded ? 'Upload both required documents first' : undefined}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Send size={13} /> {isSubmitting ? 'Submitting…' : 'Submit Joining Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
