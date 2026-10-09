import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { saveStep5Resume } from '../../../../api/recruitmentApi';
import CandidateDocumentSlot from './CandidateDocumentSlot';
import { FIELD_CLASS, LABEL_CLASS } from './wizardStyles';

/** Step 5: Resume / CV upload and Remarks optional fields. */
export default function Step5Resume({ candidateId, initial, requirements, onNext, onBack }) {
  const [form, setForm] = useState(() => ({
    resumeDocumentId: initial?.resumeDocumentId ?? null,
    remarks: initial?.remarks ?? '',
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const requireResume = requirements?.requireResume ?? true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);

    if (requireResume && !form.resumeDocumentId) {
      setError('Please upload your Resume / CV (PDF) before continuing.');
      return;
    }

    setIsSaving(true);

    const payload = {
      candidateId,
      resumeDocumentId: form.resumeDocumentId || null,
      remarks: form.remarks || null,
    };
    try {
      await saveStep5Resume(payload);
      onNext(payload);
    } catch (err) {
      // Error is shown via global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Resume / Curriculum Vitae (CV)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {requireResume
              ? 'Uploading a Resume / CV (PDF) is mandatory for this recruitment position.'
              : 'Uploading a Resume / CV is optional, but recommended for highlighting your experience and publications.'}
          </p>
        </div>

        <CandidateDocumentSlot
          ownerType="Candidate"
          ownerId={candidateId}
          kind="CandidateResume"
          label={`Resume / CV Document (PDF) ${requireResume ? '*' : ''}`}
          documentId={form.resumeDocumentId}
          onChange={(id) => setForm((prev) => ({ ...prev, resumeDocumentId: id }))}
        />

        <div className="space-y-1.5 pt-2">
          <label className={LABEL_CLASS}>Candidate Remarks (Optional)</label>
          <textarea
            rows={3}
            value={form.remarks}
            onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
            className={FIELD_CLASS}
            placeholder="Any additional remarks or notes for the selection committee..."
          />
        </div>
      </section>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/10 transition-all"
        >
          {isSaving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  );
}
