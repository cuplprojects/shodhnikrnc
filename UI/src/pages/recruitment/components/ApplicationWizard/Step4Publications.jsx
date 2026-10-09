import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { saveStep4Publications } from '../../../../api/recruitmentApi';
import CandidateDocumentSlot from './CandidateDocumentSlot';
import { FIELD_CLASS, LABEL_CLASS } from './wizardStyles';

/** Step 4: SaveStep4PublicationsRequestBody's fields. */
export default function Step4Publications({ candidateId, initial, requirements, onNext, onBack }) {
  const [form, setForm] = useState(() => ({
    sciJournalCount: initial?.sciJournalCount ?? 0,
    scopusJournalCount: initial?.scopusJournalCount ?? 0,
    nonSciJournalCount: initial?.nonSciJournalCount ?? 0,
    internationalConfCount: initial?.internationalConfCount ?? 0,
    nationalConfCount: initial?.nationalConfCount ?? 0,
    publicationName: initial?.publicationName ?? '',
    otherInformation: initial?.otherInformation ?? '',
    wantsHigherDegreeRegistration: initial?.wantsHigherDegreeRegistration ?? false,
    publicationsDocumentId: initial?.publicationsDocumentId ?? null,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const requirePublications = requirements?.requirePublications ?? false;

  const handleNumberChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);

    if (requirePublications) {
      const totalPubs =
        (Number(form.sciJournalCount) || 0) +
        (Number(form.scopusJournalCount) || 0) +
        (Number(form.nonSciJournalCount) || 0) +
        (Number(form.internationalConfCount) || 0) +
        (Number(form.nationalConfCount) || 0);

      if (totalPubs === 0 && !form.publicationName && !form.publicationsDocumentId) {
        setError('Research publications record or document upload is required for this position.');
        return;
      }
    }

    setIsSaving(true);

    const payload = {
      candidateId,
      sciJournalCount: Number(form.sciJournalCount) || 0,
      scopusJournalCount: Number(form.scopusJournalCount) || 0,
      nonSciJournalCount: Number(form.nonSciJournalCount) || 0,
      internationalConfCount: Number(form.internationalConfCount) || 0,
      nationalConfCount: Number(form.nationalConfCount) || 0,
      publicationName: form.publicationName || null,
      otherInformation: form.otherInformation || null,
      wantsHigherDegreeRegistration: form.wantsHigherDegreeRegistration,
      publicationsDocumentId: form.publicationsDocumentId || null,
    };
    try {
      await saveStep4Publications(payload);
      // See Step1Personal: keeps the wizard's cached draft in step with what
      // was actually saved, so a Back navigation re-seeds correctly.
      onNext(payload);
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {requirePublications && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300">
          <span className="font-bold">Requirement Set by PI: </span>
          <span>Research publications record or document upload is mandatory for this position.</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Publications</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>SCI journal papers</label>
            <input
              type="number"
              min="0"
              value={form.sciJournalCount}
              onChange={handleNumberChange('sciJournalCount')}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>Scopus journal papers</label>
            <input
              type="number"
              min="0"
              value={form.scopusJournalCount}
              onChange={handleNumberChange('scopusJournalCount')}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>Non-SCI journal papers</label>
            <input
              type="number"
              min="0"
              value={form.nonSciJournalCount}
              onChange={handleNumberChange('nonSciJournalCount')}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>International conference papers</label>
            <input
              type="number"
              min="0"
              value={form.internationalConfCount}
              onChange={handleNumberChange('internationalConfCount')}
              className={FIELD_CLASS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>National conference papers</label>
            <input
              type="number"
              min="0"
              value={form.nationalConfCount}
              onChange={handleNumberChange('nationalConfCount')}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <label className={LABEL_CLASS}>Name / Title / Link of Publication (Optional)</label>
          <input
            type="text"
            value={form.publicationName}
            onChange={(e) => setForm((prev) => ({ ...prev, publicationName: e.target.value }))}
            className={FIELD_CLASS}
            placeholder="Enter key publication title, details, or URL link"
          />
        </div>

        <div className="pt-2">
          <CandidateDocumentSlot
            ownerType="Candidate"
            ownerId={candidateId}
            kind="CandidatePublicationsDocument"
            label="Publications Document / List of Publications (PDF)"
            documentId={form.publicationsDocumentId}
            onChange={(id) => setForm((prev) => ({ ...prev, publicationsDocumentId: id }))}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>Other information</label>
          <textarea
            rows={3}
            value={form.otherInformation}
            onChange={(e) => setForm((prev) => ({ ...prev, otherInformation: e.target.value }))}
            className={FIELD_CLASS}
            placeholder="Any other relevant information (awards, skills, patents, etc.)"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.wantsHigherDegreeRegistration}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, wantsHigherDegreeRegistration: e.target.checked }))
            }
            className="h-4 w-4"
          />
          I wish to register for a higher degree Ph.D along side this position
        </label>
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
