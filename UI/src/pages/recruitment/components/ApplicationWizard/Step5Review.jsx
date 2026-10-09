import { useEffect, useState } from 'react';
import { AlertCircle, Pencil, CheckCircle2, Eye, Download, Printer } from 'lucide-react';
import { getOwnDraft, submitDraft } from '../../../../api/recruitmentApi';
import CandidateDocumentSlot from './CandidateDocumentSlot';
import ViewCandidateApplicationModal from '../ViewCandidateApplicationModal';
import {
  EDUCATION_LEVEL_LABELS,
  CANDIDATE_CATEGORY_LABELS,
  NATIONALITY_LABELS,
  ACADEMIC_DIVISION_LABELS,
  APPOINTMENT_NATURE_LABELS,
  ID_PROOF_TYPE_LABELS,
  sortEducationRows,
} from '../../../../constants/recruitmentEnums';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-right">{value ?? '—'}</span>
    </div>
  );
}

function SectionCard({ title, onEdit, children }) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Step 5: read-only review of the current draft (re-fetched via
 * GET /api/candidates/{id}/draft, added in this task since no endpoint
 * previously exposed a full-draft read), plus the photo & signature upload and
 * declaration checkbox gating Submit. The photograph's and signature's Document ids are carried
 * to the server by the submit call itself.
 */
export default function Step5Review({ candidateId, requirements, onBack, onEditStep, onSubmitted }) {
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [photoDocumentId, setPhotoDocumentId] = useState(null);
  const [signatureDocumentId, setSignatureDocumentId] = useState(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const missingReqs = (() => {
    if (!draft || !requirements) return [];
    const missing = [];
    const reqQualList = requirements.requiredQualifications
      ? requirements.requiredQualifications.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const allowDiplomaFor12th = requirements.allowDiplomaFor12th ?? true;

    if (reqQualList.length > 0) {
      if (reqQualList.includes('GATE/NET') && !draft.gateNetGpatQualified) {
        missing.push({ label: 'GATE / CSIR-NET / GPAT qualification', step: 2 });
      }
      if (reqQualList.includes('10th')) {
        const has10th = draft.education?.some((e) => e.level === 'Tenth' && e.boardInstituteUniv && e.year);
        if (!has10th) missing.push({ label: '10th Standard qualification details', step: 2 });
      }
      if (reqQualList.includes('12th')) {
        const has12th = draft.education?.some((e) => e.level === 'Twelfth' && e.boardInstituteUniv && e.year);
        const hasDiploma = allowDiplomaFor12th && draft.education?.some((e) => e.level === 'Diploma' && e.boardInstituteUniv && e.year);
        if (!has12th && !hasDiploma) {
          missing.push({
            label: allowDiplomaFor12th ? '12th Standard (or Diploma) qualification details' : '12th Standard qualification details',
            step: 2,
          });
        }
      }
      if (reqQualList.includes('UG')) {
        const hasUg = draft.education?.some((e) => e.level === 'Undergraduate' && e.boardInstituteUniv && e.year);
        if (!hasUg) missing.push({ label: 'Undergraduate (UG) qualification details', step: 2 });
      }
      if (reqQualList.includes('PG')) {
        const hasPg = draft.education?.some((e) => e.level === 'Postgraduate' && e.boardInstituteUniv && e.year);
        if (!hasPg) missing.push({ label: 'Postgraduate (PG) qualification details', step: 2 });
      }
      if (reqQualList.includes('PhD')) {
        const hasPhd = draft.education?.some((e) => e.level === 'Doctorate' && e.boardInstituteUniv && e.year);
        if (!hasPhd) missing.push({ label: 'Ph.D. qualification details', step: 2 });
      }
    }

    // Timeline validation checks
    const year10thRow = draft.education?.find((e) => e.level === 'Tenth' && e.year);
    const year12thRow = draft.education?.find((e) => e.level === 'Twelfth' && e.year);
    const yearDiplomaRow = draft.education?.find((e) => e.level === 'Diploma' && e.year);
    const yearUgRow = draft.education?.find((e) => e.level === 'Undergraduate' && e.year);
    const yearPgRow = draft.education?.find((e) => e.level === 'Postgraduate' && e.year);
    const yearPhdRow = draft.education?.find((e) => e.level === 'Doctorate' && e.year);

    const y10 = year10thRow ? Number(year10thRow.year) : null;
    const y12 = year12thRow ? Number(year12thRow.year) : null;
    const yDip = yearDiplomaRow ? Number(yearDiplomaRow.year) : null;
    const yUg = yearUgRow ? Number(yearUgRow.year) : null;
    const yPg = yearPgRow ? Number(yearPgRow.year) : null;
    const yPhd = yearPhdRow ? Number(yearPhdRow.year) : null;

    if (y10 && y12 && y12 < y10 + 2) {
      missing.push({ label: `Invalid passing year timeline: 12th (${y12}) must be at least 2 years after 10th (${y10})`, step: 2 });
    }
    if (y10 && yDip && yDip < y10 + 2) {
      missing.push({ label: `Invalid passing year timeline: Diploma (${yDip}) must be at least 2 years after 10th (${y10})`, step: 2 });
    }
    if (y12 && yUg && yUg < y12 + 3) {
      missing.push({ label: `Invalid passing year timeline: UG (${yUg}) must be at least 3 years after 12th (${y12})`, step: 2 });
    }
    if (yDip && yUg && !y12 && yUg < yDip + 2) {
      missing.push({ label: `Invalid passing year timeline: UG (${yUg}) must be at least 2 years after Diploma (${yDip})`, step: 2 });
    }
    if (yUg && yPg && yPg < yUg + 1) {
      missing.push({ label: `Invalid passing year timeline: PG (${yPg}) must be after UG (${yUg})`, step: 2 });
    }
    if (yPg && yPhd && yPhd < yPg + 1) {
      missing.push({ label: `Invalid passing year timeline: Ph.D. (${yPhd}) must be after PG (${yPg})`, step: 2 });
    }

    if (requirements.requireExperience) {
      if (!draft.experiences?.length) {
        missing.push({ label: 'Work / Research Experience details', step: 3 });
      } else if (requirements.minExperienceMonths > 0) {
        const totalMonths = draft.experiences.reduce((sum, x) => sum + (x.periodYears || 0) * 12 + (x.periodMonths || 0), 0);
        if (totalMonths < requirements.minExperienceMonths) {
          missing.push({
            label: `Minimum ${requirements.minExperienceMonths} months experience (provided: ${totalMonths} months)`,
            step: 3,
          });
        }
      }
    }

    if (requirements.requirePublications) {
      const totalPubs =
        (draft.sciJournalCount || 0) +
        (draft.scopusJournalCount || 0) +
        (draft.nonSciJournalCount || 0) +
        (draft.internationalConfCount || 0) +
        (draft.nationalConfCount || 0);
      if (totalPubs === 0 && !draft.publicationName && !draft.publicationsDocumentId) {
        missing.push({ label: 'Research publications record or document upload', step: 4 });
      }
    }

    if (requirements.requireResume && !draft.resumeDocumentId) {
      missing.push({ label: 'Resume / CV PDF document upload', step: 5 });
    }

    return missing;
  })();

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    getOwnDraft(candidateId)
      .then((data) => {
        setDraft(data);
        setPhotoDocumentId(data.photoDocumentId ?? null);
        setSignatureDocumentId(data.signatureDocumentId ?? null);
        setDeclarationAccepted(Boolean(data.declarationAcceptedAt));
        if (data.applicationStatus === 'Submitted') {
          setIsSubmittedSuccess(true);
        }
      })
      .catch((err) => setLoadError(err.message ?? 'Failed to load your application.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [candidateId]);

  const handleSubmit = async () => {
    if (isSubmitting || !declarationAccepted || missingReqs.length > 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitDraft(candidateId, photoDocumentId, signatureDocumentId);
      setIsSubmittedSuccess(true);
    } catch (err) {
      setSubmitError(err.message ?? 'Failed to submit the application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmittedSuccess) {
    return (
      <div className="py-10 px-4 text-center space-y-6 w-full animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Application Submitted!</h2>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2">
            Your application form has been successfully submitted to MNNIT Allahabad.
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Application Actions</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsViewModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-300 dark:border-slate-700"
            >
              <Eye size={16} className="text-blue-600 dark:text-blue-400" /> View Application
            </button>
            <button
              type="button"
              onClick={() => setIsViewModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 hover:hover:text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Download size={16} /> Download / Print PDF
            </button>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={() => onSubmitted?.()}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
          >
            Finish & Return to Applications
          </button>
        </div>

        <ViewCandidateApplicationModal
          isOpen={isViewModalOpen}
          candidateId={candidateId}
          onClose={() => setIsViewModalOpen(false)}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500" />
        <span className="text-sm font-semibold">Loading your application…</span>
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{loadError ?? 'Could not load your application.'}</span>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {missingReqs.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800 dark:text-rose-300">
            <AlertCircle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>Missing Mandatory Position Requirements ({missingReqs.length}):</span>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            The Principal Investigator requires the following details for this recruitment. Please complete them before submitting:
          </p>
          <ul className="space-y-1.5 pt-1">
            {missingReqs.map((m, idx) => (
              <li key={idx} className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-100/60 dark:bg-rose-900/40 px-3 py-1.5 rounded-lg border border-rose-200/50 dark:border-rose-800/40">
                <span>• {m.label}</span>
                <button
                  type="button"
                  onClick={() => onEditStep(m.step)}
                  className="px-2.5 py-0.5 bg-rose-600 text-white hover:bg-rose-700 rounded font-bold transition-all text-[11px]"
                >
                  Edit Step {m.step}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <SectionCard title="Personal details" onEdit={() => onEditStep(1)}>
        <SummaryRow label="Full name" value={draft.fullName} />
        <SummaryRow label="Mobile" value={draft.mobile} />
        <SummaryRow label="Sex" value={draft.gender} />
        <SummaryRow label="Marital status" value={draft.isMarried == null ? '—' : draft.isMarried ? 'Married' : 'Unmarried'} />
        <SummaryRow label="Date of birth" value={formatDate(draft.dateOfBirth)} />
        <SummaryRow label="Father's / Husband's name" value={draft.fatherOrHusbandName} />
        <SummaryRow label="Present address" value={draft.presentAddress} />
        <SummaryRow label="Permanent address" value={draft.permanentAddress} />
        <SummaryRow label="Email" value={draft.email} />
        <SummaryRow label="Nationality" value={NATIONALITY_LABELS[draft.nationality] ?? draft.nationality} />
        <SummaryRow label="Category" value={CANDIDATE_CATEGORY_LABELS[draft.category] ?? draft.category} />
        <SummaryRow label="ID Proof Type" value={ID_PROOF_TYPE_LABELS[draft.idProofType] ?? draft.idProofType ?? '—'} />
        <SummaryRow label="ID Proof Number" value={draft.idProofNumber} />
        <SummaryRow label="ID Proof File" value={draft.idProofDocumentId ? 'Uploaded' : 'Not uploaded'} />
      </SectionCard>

      <SectionCard title="Qualifications" onEdit={() => onEditStep(2)}>
        <SummaryRow
          label="GATE/NET/GPAT"
          value={
            draft.gateNetGpatQualified
              ? `Qualified (${draft.gateNetGpatRollNo || '—'}, ${draft.gateNetGpatYear || '—'}, score ${draft.gateNetGpatScore || '—'})`
              : 'Not qualified'
          }
        />
        {draft.gateNetGpatQualified && (
          <SummaryRow
            label="GATE/NET Certificate"
            value={draft.gateNetGpatCertificateDocumentId ? 'Uploaded' : 'Not uploaded'}
          />
        )}
        {draft.education?.length ? (
          <div className="mt-2 space-y-1.5">
            {sortEducationRows(draft.education).map((e, i) => (
              <div key={e.id ?? i} className="text-sm text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-2">
                <span className="font-bold">
                  {e.level === 'Other' && e.otherLevelName ? `Other (${e.otherLevelName})` : EDUCATION_LEVEL_LABELS[e.level] ?? e.level}:
                </span>
                <span>{e.boardInstituteUniv || '—'}</span>
                <span>({e.year || '—'})</span>
                <span>{e.marksOrCgpa || ''}</span>
                {e.division && (
                  <span className="text-slate-500">• {ACADEMIC_DIVISION_LABELS[e.division] ?? e.division}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No education rows added.</p>
        )}
      </SectionCard>

      <SectionCard title="Experience" onEdit={() => onEditStep(3)}>
        {draft.experiences?.length ? (
          <div className="space-y-1.5">
            {draft.experiences.map((x, i) => (
              <div key={x.id ?? i} className="text-sm text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-2">
                <span className="font-bold">{x.organization || '—'}</span>
                <span>{x.position || ''}</span>
                <span>
                  ({x.periodYears || 0}y {x.periodMonths || 0}m {x.periodDays || 0}d)
                </span>
                {x.natureOfAppointment && (
                  <span className="text-slate-500">• {APPOINTMENT_NATURE_LABELS[x.natureOfAppointment] ?? x.natureOfAppointment}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No experience rows added.</p>
        )}
      </SectionCard>

      <SectionCard title="Publications" onEdit={() => onEditStep(4)}>
        <SummaryRow label="Publication Name / Title / Link" value={draft.publicationName} />
        <SummaryRow label="SCI journal papers" value={draft.sciJournalCount} />
        <SummaryRow label="Scopus journal papers" value={draft.scopusJournalCount} />
        <SummaryRow label="Non-SCI journal papers" value={draft.nonSciJournalCount} />
        <SummaryRow label="International conference papers" value={draft.internationalConfCount} />
        <SummaryRow label="National conference papers" value={draft.nationalConfCount} />
        <SummaryRow label="Publications Document" value={draft.publicationsDocumentId ? 'Uploaded' : 'Not uploaded'} />
        <SummaryRow label="Other information" value={draft.otherInformation} />
        <SummaryRow
          label="Higher degree registration"
          value={draft.wantsHigherDegreeRegistration ? 'Yes' : 'No'}
        />
      </SectionCard>

      <SectionCard title="Resume / CV & Remarks" onEdit={() => onEditStep(5)}>
        <SummaryRow label="Resume / CV Document" value={draft.resumeDocumentId ? 'Uploaded' : 'Not uploaded'} />
        <SummaryRow label="Remarks" value={draft.remarks} />
      </SectionCard>

      <SectionCard title="Photograph & Signature">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CandidateDocumentSlot
            ownerType="Candidate"
            ownerId={candidateId}
            kind="CandidatePhoto"
            label="Passport-size photograph"
            documentId={photoDocumentId}
            onChange={setPhotoDocumentId}
            required
          />
          <CandidateDocumentSlot
            ownerType="Candidate"
            ownerId={candidateId}
            kind="CandidateSignature"
            label="Candidate Signature"
            documentId={signatureDocumentId}
            onChange={setSignatureDocumentId}
            required
          />
        </div>
      </SectionCard>

      <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10">
        <label className="flex items-start gap-2.5 text-sm font-semibold text-amber-900 dark:text-amber-300">
          <input
            type="checkbox"
            checked={declarationAccepted}
            onChange={(e) => setDeclarationAccepted(e.target.checked)}
            className="h-4 w-4 mt-0.5"
          />
          <span>
            I declare that the information given above is true to the best of my
            knowledge and belief. I understand that any false information may lead
            to cancellation of my candidature.
          </span>
        </label>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!declarationAccepted || !signatureDocumentId || isSubmitting || missingReqs.length > 0}
          className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/10 transition-all"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}
