import { useState, useEffect } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { saveStep3Experience } from '../../../../api/recruitmentApi';
import CandidateDocumentSlot from './CandidateDocumentSlot';
import { ROW_FIELD_CLASS } from './wizardStyles';
import { APPOINTMENT_NATURES } from '../../../../constants/recruitmentEnums';

function blankRow(sortOrder) {
  return {
    id: null,
    sortOrder,
    organization: '',
    position: '',
    salaryEmoluments: '',
    natureOfDuties: '',
    natureOfAppointment: '',
    periodYears: '',
    periodMonths: '',
    periodDays: '',
    certificateDocumentId: null,
  };
}

/**
 * Step 3: the work-experience table, an add/remove-row array following the
 * same pattern as Step 2's education table (see its comment for why per-row
 * certificates are owned by the candidate rather than the row).
 */
export default function Step3Experience({ candidateId, initial, requirements, onNext, onBack }) {
  const [rows, setRows] = useState(() =>
    initial?.length
      ? initial.map((x, i) => ({
        id: x.id ?? null,
        sortOrder: x.sortOrder ?? i,
        organization: x.organization ?? '',
        position: x.position ?? '',
        salaryEmoluments: x.salaryEmoluments ?? '',
        natureOfDuties: x.natureOfDuties ?? '',
        natureOfAppointment: x.natureOfAppointment ?? '',
        periodYears: x.periodYears ?? '',
        periodMonths: x.periodMonths ?? '',
        periodDays: x.periodDays ?? '',
        certificateDocumentId: x.certificateDocumentId ?? null,
      }))
      : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const requireExperience = requirements?.requireExperience ?? false;
  const minExperienceMonths = requirements?.minExperienceMonths ?? 0;

  useEffect(() => {
    if (requireExperience) {
      setRows((prev) => (prev.length === 0 ? [blankRow(0)] : prev));
    }
  }, [requireExperience]);

  const updateRow = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, blankRow(prev.length)]);
  const removeRow = (index) =>
    setRows((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, sortOrder: i })));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);

    if (requireExperience) {
      if (rows.length === 0) {
        setError('Work / Research Experience is required for this recruitment position.');
        return;
      }
      const totalMonths = rows.reduce((sum, r) => {
        const yrs = r.periodYears === '' ? 0 : Number(r.periodYears);
        const mths = r.periodMonths === '' ? 0 : Number(r.periodMonths);
        return sum + yrs * 12 + mths;
      }, 0);

      if (minExperienceMonths > 0 && totalMonths < minExperienceMonths) {
        setError(
          `Minimum ${minExperienceMonths} months of experience is required for this position. You have entered ${totalMonths} months.`
        );
        return;
      }
    }

    setIsSaving(true);

    const payload = {
      candidateId,
      experiences: rows.map((r, i) => ({
        id: r.id,
        sortOrder: i,
        organization: r.organization || null,
        position: r.position || null,
        salaryEmoluments: r.salaryEmoluments || null,
        natureOfDuties: r.natureOfDuties || null,
        natureOfAppointment: r.natureOfAppointment || null,
        periodYears: r.periodYears === '' ? 0 : Number(r.periodYears),
        periodMonths: r.periodMonths === '' ? 0 : Number(r.periodMonths),
        periodDays: r.periodDays === '' ? 0 : Number(r.periodDays),
        certificateDocumentId: r.certificateDocumentId || null,
      })),
    };
    try {
      await saveStep3Experience(payload);
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
      {requireExperience && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300">
          <span className="font-bold">Requirement Set by PI: </span>
          <span>Work / Research Experience is mandatory for this position {minExperienceMonths > 0 ? `(Minimum ${minExperienceMonths} months required)` : ''}.</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Work / research experience</h3>
        {rows.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No experience rows added yet. This step is optional — add a row only if applicable.
          </p>
        )}
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Row {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove experience row ${index + 1}`}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <input
                  value={row.organization}
                  placeholder="Organization"
                  onChange={(e) => updateRow(index, 'organization', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} organization`}
                />
                <input
                  value={row.position}
                  placeholder="Position"
                  onChange={(e) => updateRow(index, 'position', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} position`}
                />
                <input
                  value={row.salaryEmoluments}
                  placeholder="Salary / emoluments"
                  onChange={(e) => updateRow(index, 'salaryEmoluments', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} salary`}
                />
                <input
                  value={row.natureOfDuties}
                  placeholder="Nature of duties"
                  onChange={(e) => updateRow(index, 'natureOfDuties', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} nature of duties`}
                />
                <select
                  value={row.natureOfAppointment}
                  onChange={(e) => updateRow(index, 'natureOfAppointment', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} nature of appointment`}
                >
                  <option value="">-- Nature of appointment --</option>
                  {APPOINTMENT_NATURES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols- gap-3">
                <select
                  value={row.periodYears ?? ''}
                  onChange={(e) => updateRow(index, 'periodYears', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} period years`}
                >
                  <option value="">Years</option>
                  {Array.from({ length: 41 }, (_, i) => (
                    <option key={i} value={i}>{i} {i === 1 ? 'Year' : 'Years'}</option>
                  ))}
                </select>
                <select
                  value={row.periodMonths ?? ''}
                  onChange={(e) => updateRow(index, 'periodMonths', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} period months`}
                >
                  <option value="">Months</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{i} {i === 1 ? 'Month' : 'Months'}</option>
                  ))}
                </select>
                <select
                  value={row.periodDays ?? ''}
                  onChange={(e) => updateRow(index, 'periodDays', e.target.value)}
                  className={ROW_FIELD_CLASS}
                  aria-label={`Row ${index + 1} period days`}
                >
                  <option value="">Days</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i} value={i}>{i} {i === 1 ? 'Day' : 'Days'}</option>
                  ))}
                </select>
              </div>
              <CandidateDocumentSlot
                ownerType="Candidate"
                ownerId={candidateId}
                kind="CandidateExperienceCertificate"
                label="Experience certificate"
                documentId={row.certificateDocumentId}
                onChange={(id) => updateRow(index, 'certificateDocumentId', id)}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Plus size={14} /> Add experience row
        </button>
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
