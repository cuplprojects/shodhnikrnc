import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { getOwnDraft, getRecruitment } from '../../../../api/recruitmentApi';
import PrefillPicker from './PrefillPicker';
import Step1Personal from './Step1Personal';
import Step2Qualifications from './Step2Qualifications';
import Step3Experience from './Step3Experience';
import Step4Publications from './Step4Publications';
import Step5Resume from './Step5Resume';
import Step5Review from './Step5Review';

const STEP_LABELS = ['Personal', 'Qualifications', 'Experience', 'Publications', 'Resume / CV', 'Review & Submit'];

/**
 * The 6-step application wizard's step container.
 *
 * `existingCandidateId` is set when resuming a Draft from MyApplicationsPage's
 * "Continue application" action -- in that case the prefill picker is skipped
 * entirely and the wizard drops straight into Step 1 with the known id.
 * Otherwise (a fresh "Apply Now"), the wizard shows the prefill picker first;
 * once it resolves a candidate id (via prefill or a blank start), the wizard
 * proceeds the same way regardless of which path produced the id.
 *
 * Whenever the draft behind that id may already hold data -- a resumed Draft,
 * or one just populated by prefill -- the wizard loads it once via
 * GET /api/candidates/{id}/draft and hands each step its own slice as
 * `initial`. Without this the steps mount blank and the first "Save & Continue"
 * overwrites the stored values (Steps 2 and 3 save by whole-collection replace,
 * so a blank save would delete the saved education/experience rows outright).
 * Both picker paths ask for that load -- "skip, start blank" runs
 * StartOrResumeDraftAsync, which *resumes* an existing draft for this
 * recruitment rather than creating a fresh one, so it can hand back a populated
 * draft too. On a genuinely new draft the fetch simply returns empty fields.
 */
export default function ApplicationWizard({
  recruitmentId,
  recruitmentLabel,
  existingCandidateId = null,
  onClose,
  onSubmitted,
}) {
  const [candidateId, setCandidateId] = useState(existingCandidateId);
  const [currentStep, setCurrentStep] = useState(existingCandidateId ? 1 : 0);
  // null until a draft has been fetched; stays null for a blank start.
  const [draft, setDraft] = useState(null);
  // Starts true only when there is already an id to load on mount (the resume
  // path); the picker paths flip it on themselves the moment they hand one over.
  const [isLoadingDraft, setIsLoadingDraft] = useState(Boolean(existingCandidateId));
  const [draftError, setDraftError] = useState(null);
  const [requirements, setRequirements] = useState(null);

  useEffect(() => {
    if (recruitmentId) {
      getRecruitment(recruitmentId)
        .then(setRequirements)
        .catch((err) => console.error('Failed to load recruitment requirements', err));
    }
  }, [recruitmentId]);

  /** The fetch itself; every setState happens in a promise callback. */
  const fetchDraft = (id) =>
    getOwnDraft(id)
      .then((data) => setDraft(data ?? null))
      .catch((err) => setDraftError(err.message ?? 'Failed to load your saved application.'))
      .finally(() => setIsLoadingDraft(false));

  const loadDraft = (id) => {
    setIsLoadingDraft(true);
    setDraftError(null);
    return fetchDraft(id);
  };

  // The resume path arrives with an id already known, so there is no picker
  // callback to hang the initial load off. isLoadingDraft/draftError are
  // already in their loading state from useState, so this only kicks off the
  // request -- nothing is set synchronously here.
  useEffect(() => {
    if (existingCandidateId) fetchDraft(existingCandidateId);
    // Mount-only: the id is a prop fixed for the lifetime of this modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 0 is the prefill picker, shown only for a brand-new application.
  // `prefilled` says the resolved draft may already hold data worth loading.
  const handlePrefillReady = (newCandidateId, { prefilled = false } = {}) => {
    setCandidateId(newCandidateId);
    setCurrentStep(1);
    if (prefilled) loadDraft(newCandidateId);
  };

  const reloadDraft = () => loadDraft(candidateId);

  const goToStep = (step) => setCurrentStep(step);

  /**
   * Each step hands back exactly what it just saved, which is folded into the
   * cached draft. Without this, stepping Back to an already-saved step would
   * re-seed it from the pre-edit snapshot and re-save the stale values.
   */
  const handleNext = (savedSlice) => {
    if (savedSlice) setDraft((prev) => ({ ...(prev ?? {}), ...savedSlice }));
    setCurrentStep((s) => Math.min(s + 1, 6));
  };
  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const step1Initial = draft && {
    fullName: draft.fullName ?? '',
    mobile: draft.mobile ?? '',
    gender: draft.gender ?? '',
    // The <select> is string-valued; the API sends a nullable bool.
    isMarried: draft.isMarried == null ? '' : String(draft.isMarried),
    dateOfBirth: draft.dateOfBirth ?? '',
    fatherOrHusbandName: draft.fatherOrHusbandName ?? '',
    presentAddress: draft.presentAddress ?? '',
    permanentAddress: draft.permanentAddress ?? '',
    email: draft.email ?? '',
    nationality: draft.nationality ?? '',
    category: draft.category ?? '',
    categoryCertificateDocumentId: draft.categoryCertificateDocumentId ?? null,
    idProofType: draft.idProofType ?? '',
    idProofNumber: draft.idProofNumber ?? '',
    idProofDocumentId: draft.idProofDocumentId ?? null,
  };

  const step2Initial = draft && {
    gateNetGpatQualified: draft.gateNetGpatQualified ?? false,
    gateNetGpatRollNo: draft.gateNetGpatRollNo ?? '',
    gateNetGpatYear: draft.gateNetGpatYear ?? '',
    gateNetGpatScore: draft.gateNetGpatScore ?? '',
    gateNetGpatCertificateDocumentId: draft.gateNetGpatCertificateDocumentId ?? null,
    education: draft.education ?? [],
  };

  const step3Initial = draft?.experiences ?? null;

  const step4Initial = draft && {
    publicationName: draft.publicationName ?? '',
    sciJournalCount: draft.sciJournalCount ?? 0,
    scopusJournalCount: draft.scopusJournalCount ?? 0,
    nonSciJournalCount: draft.nonSciJournalCount ?? 0,
    internationalConfCount: draft.internationalConfCount ?? 0,
    nationalConfCount: draft.nationalConfCount ?? 0,
    otherInformation: draft.otherInformation ?? '',
    wantsHigherDegreeRegistration: draft.wantsHigherDegreeRegistration ?? false,
    publicationsDocumentId: draft.publicationsDocumentId ?? null,
  };

  const step5Initial = draft && {
    resumeDocumentId: draft.resumeDocumentId ?? null,
    remarks: draft.remarks ?? '',
  };

  const handleSubmitted = () => {
    onSubmitted?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Application Form</h2>
            {recruitmentLabel && (
              <p className="text-xs font-semibold text-slate-500 mt-0.5">{recruitmentLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        {candidateId && (
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {STEP_LABELS.map((label, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === currentStep;
                const isDone = stepNum < currentStep;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <span>{stepNum}</span>
                      <span>{label}</span>
                    </div>
                    {stepNum < STEP_LABELS.length && (
                      <div className="w-4 h-px bg-slate-300 dark:bg-slate-700" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!candidateId ? (
            <PrefillPicker recruitmentId={recruitmentId} onReady={handlePrefillReady} />
          ) : isLoadingDraft ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500" />
              <span className="text-sm font-semibold">Loading your saved application…</span>
            </div>
          ) : draftError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{draftError}</span>
              </div>
              <button
                type="button"
                onClick={reloadDraft}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          ) : currentStep === 1 ? (
            <Step1Personal candidateId={candidateId} initial={step1Initial} onNext={handleNext} />
          ) : currentStep === 2 ? (
            <Step2Qualifications
              candidateId={candidateId}
              initial={step2Initial}
              requirements={requirements}
              onNext={handleNext}
              onBack={handleBack}
            />
          ) : currentStep === 3 ? (
            <Step3Experience
              candidateId={candidateId}
              initial={step3Initial}
              requirements={requirements}
              onNext={handleNext}
              onBack={handleBack}
            />
          ) : currentStep === 4 ? (
            <Step4Publications
              candidateId={candidateId}
              initial={step4Initial}
              requirements={requirements}
              onNext={handleNext}
              onBack={handleBack}
            />
          ) : currentStep === 5 ? (
            <Step5Resume
              candidateId={candidateId}
              initial={step5Initial}
              requirements={requirements}
              onNext={handleNext}
              onBack={handleBack}
            />
          ) : currentStep === 6 ? (
            <Step5Review
              candidateId={candidateId}
              requirements={requirements}
              onBack={handleBack}
              onEditStep={goToStep}
              onSubmitted={handleSubmitted}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
