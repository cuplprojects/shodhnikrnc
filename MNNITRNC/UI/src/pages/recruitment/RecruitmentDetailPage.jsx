import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Megaphone, Info, Calendar, MapPin, Award,
  CheckCircle, Clock, Lock, Check, FileCheck, XCircle, AlertTriangle, Download, Send, RefreshCw, Mail
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import {
  getRecruitment, listCandidates, listCommittee,
  recordScreeningResult, submitMeritList,
  downloadRecruitmentDocument, RECRUITMENT_DOCUMENTS,
  scheduleInterview, setInterviewMode, approveMeritList,
  approveInterviewMode, issueOffer, releaseOffer, markNoCandidateAccepted, sendNotEligibleNotifications,
  returnJoiningReport, forwardJoiningReport, forwardJoiningReportToHod, approveJoiningReport,
  getJoiningReport
} from '../../api/recruitmentApi';
import { getWorkflowInstance } from '../../api/workflowApi';
import ApprovalTimeline from '../../components/ApprovalTimeline';
import CandidateDocumentSlot from './components/ApplicationWizard/CandidateDocumentSlot';

import {
  RECRUITMENT_STAGES, RECRUITMENT_STAGE_STYLES, DEFAULT_STAGE_STYLE,
  SCREENING_RESULTS, CANDIDATE_OUTCOMES, PAYMENT_GATE_NOTE,
} from '../../constants/recruitmentEnums';
import CommitteeForm from './components/CommitteeForm';
import ScreeningCommitteeRoster from './components/ScreeningCommitteeRoster';
import AdvertisementChainActions from './components/AdvertisementChainActions';
import OfferChainActions from './components/OfferChainActions';
import GenerateAdvertisementModal from '../projects/components/GenerateAdvertisementModal';
import { getProject } from '../../api/projectsApi';
import { documentDownloadPath, getDocumentsByOwner } from '../../api/documentsApi';
import toast from 'react-hot-toast';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

export default function RecruitmentDetailPage() {
  const { recruitmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recruitment, setRecruitment] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [screening, setScreening] = useState([]);
  const [selection, setSelection] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Advertisement approval-chain workflow instance (PI -> RnC office ->
  // Computer Centre) -- only present once the PI has generated an ad at least
  // once. Drives both the chain-actions panel and the timeline.
  const [adWorkflow, setAdWorkflow] = useState(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adProject, setAdProject] = useState(null);

  // Offer approval-chain workflow instance (the generic 7-stage
  // RequestType.ManpowerDocument office-escalation route, the same one
  // merit-list approval raises) -- only present once the PI has proposed an
  // offer at least once (IssueOfferLetterAsync). Drives the OfferChainActions
  // panel; ReleaseOfferLetterAsync hard-gates on this instance reaching
  // WorkflowStage.Approved.
  const [offerWorkflow, setOfferWorkflow] = useState(null);

  // Offer Letter Form states
  const [offerStipend, setOfferStipend] = useState('');
  const [offerJoiningDate, setOfferJoiningDate] = useState('');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [hasReceipt, setHasReceipt] = useState(false);

  // Local "uploaded this session" tracking for the 5 new DocumentKind
  // uploads (ScreeningCommitteeProceedings, SelectionCommitteeDocuments,
  // MinutesOfSelectionScanned, SignedMeritList, AttendanceSheet). There is no
  // GET-by-owner/kind endpoint for these, so this only reflects what this
  // browser session itself has uploaded -- the server's own gate on
  // ApproveMeritListAsync (surfaced via MeritListDocumentsMissingException,
  // see the merit-list approval handler below) is the actual source of
  // truth for whether the 3 required documents are all present.
  const [uploadedDocumentKinds, setUploadedDocumentKinds] = useState({});
  const markUploaded = (kind, documentId) => setUploadedDocumentKinds((prev) => ({ ...prev, [kind]: documentId }));

  const [selectionWorkflow, setSelectionWorkflow] = useState(null);
  const [screeningWorkflow, setScreeningWorkflow] = useState(null);

  // Mandatory remark for marking a candidate Not Eligible (server-enforced,
  // this is just a client-side mirror -- see RecordScreeningRequestBody.Remarks).
  const [ineligibleRemarkDraft, setIneligibleRemarkDraft] = useState({});
  const [candidatePendingRemark, setCandidatePendingRemark] = useState(null);

  // Bulk "Send Not Eligible Emails" confirmation + in-flight state.
  const [showNotEligibleConfirm, setShowNotEligibleConfirm] = useState(false);
  const [isSendingNotEligibleEmails, setIsSendingNotEligibleEmails] = useState(false);

  // Merit-list approval failure message -- surfaced directly from the
  // server's MeritListDocumentsMissingException (via ApiError.message) so
  // the missing-documents list is never independently reconstructed
  // client-side.
  const [meritListApprovalError, setMeritListApprovalError] = useState(null);

  // Release-offer attempt state (RegularStaff/DA-role action once the offer's
  // approval chain reaches Approved) -- mirrors meritListApprovalError above.
  const [releaseOfferError, setReleaseOfferError] = useState(null);
  const [isReleasingOffer, setIsReleasingOffer] = useState(false);

  // Joining-report approval failure message -- see handleApproveJoining.
  const [joiningApprovalError, setJoiningApprovalError] = useState(null);

  // Joining details: joiningData is the backend's own ManpowerSelection row
  // for the selected candidate (via getJoiningReport), null before the PI has
  // submitted one. The panel's stage-driven state (was previously kept in
  // localStorage under joiningState -- invisible to any user/machine other
  // than whoever's browser last wrote it, which is why HOD/Dean saw no
  // action even when the backend really was at JoiningPendingHOD/Dean) is
  // now derived directly from recruitment.stage below.
  const [joiningData, setJoiningData] = useState(null);

  const load = useCallback(async () => {
    const [r, c, sc, sel, docs] = await Promise.all([
      getRecruitment(recruitmentId),
      listCandidates(recruitmentId).catch(() => []),
      listCommittee(recruitmentId, 'Screening').catch(() => []),
      listCommittee(recruitmentId, 'Selection').catch(() => []),
      getDocumentsByOwner('RecruitmentRequest', recruitmentId).catch(() => ({})),
    ]);
    setRecruitment(r);
    setCandidates(c ?? []);
    setScreening(sc ?? []);
    setSelection(sel ?? []);
    setUploadedDocumentKinds(docs ?? {});

    if (r?.advertisementWorkflowInstanceId) {
      setAdWorkflow(await getWorkflowInstance(r.advertisementWorkflowInstanceId).catch(() => null));
    } else {
      setAdWorkflow(null);
    }
    if (r?.offerWorkflowInstanceId) {
      setOfferWorkflow(await getWorkflowInstance(r.offerWorkflowInstanceId).catch(() => null));
    } else {
      setOfferWorkflow(null);
    }
    if (r?.selectionCommitteeWorkflowInstanceId) {
      setSelectionWorkflow(await getWorkflowInstance(r.selectionCommitteeWorkflowInstanceId).catch(() => null));
    } else {
      setSelectionWorkflow(null);
    }
    if (r?.screeningCommitteeWorkflowInstanceId) {
      setScreeningWorkflow(await getWorkflowInstance(r.screeningCommitteeWorkflowInstanceId).catch(() => null));
    } else {
      setScreeningWorkflow(null);
    }
    if (r?.projectId) {
      setAdProject(await getProject(r.projectId).catch(() => null));
    }

    // Payment gate is enforced server-side on issueOffer.
    // Always allow the PI to fill the form; the backend returns a clear error if payment isn't confirmed.
    setHasReceipt(true);

    // The joining report, if the candidate has already submitted one -- real
    // backend data (see IRecruitmentService.GetJoiningReportAsync), visible
    // to whichever role/machine loads this page, not just the PI's own.
    // ManpowerSelection exists from JoiningSubmitted onward (the candidate's
    // own submission), through HOD/Dean review, to Joined.
    const joiningStages = ['JoiningSubmitted', 'JoiningPendingHOD', 'JoiningPendingDean', 'Joined'];
    const selected = (c ?? []).find((cand) => cand.outcome === 'Selected' || cand.meritRank === 1);
    if (selected && joiningStages.includes(r?.stage)) {
      setJoiningData(await getJoiningReport(selected.id).catch(() => null));
    } else {
      setJoiningData(null);
    }
  }, [recruitmentId]);

  useEffect(() => {
    let active = true;
    load()
      .catch(() => { if (active) setError('Failed to load the recruitment.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [load]);

  // The panel's own state, derived from the real backend stage -- OfferIssued
  // covers both "nothing submitted yet" and "returned to PI" (ReturnJoiningReportAsync
  // has no separate stage for the latter, mirroring how a returned proposal
  // simply goes back to its own entry stage rather than a dedicated one).
  const joiningState = !recruitment ? null : ({
    OfferIssued: 'PI_Draft',
    JoiningSubmitted: 'PendingPIForward',
    JoiningPendingHOD: 'SentToHod',
    JoiningPendingDean: 'SentToDean',
    Joined: 'Approved',
  })[recruitment.stage] ?? null;

  const run = async (action) => {
    try {
      await action();
      await load();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    }
  };

  const download = async (kind) => {
    try {
      await downloadRecruitmentDocument(recruitmentId, kind);
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    }
  };

  // Roles verification
  const isPI = user?.roles?.includes('Faculty');
  const isHOD = user?.roles?.includes('HOD');
  const isDean = user?.roles?.includes('Dean') || user?.roles?.includes('SuperAdmin');
  const isDeanOrOffice = user?.roles?.includes('Dean') || user?.roles?.includes('DeputyRegistrar') || user?.roles?.includes('SuperAdmin');

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-sans flex flex-col items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
        <span className="font-semibold text-sm">Loading recruitment details…</span>
      </div>
    );
  }

  if (error || !recruitment) {
    return (
      <div className="p-12 text-center font-sans">
        <p className="text-red-500 font-semibold">{error ?? 'Recruitment not found.'}</p>
      </div>
    );
  }

  const stageStyle = RECRUITMENT_STAGE_STYLES[recruitment.stage] ?? DEFAULT_STAGE_STYLE;

  // Stepper calculations
  const hasScreeningCommittee = screening && screening.length > 0;
  const allScreened = candidates.length > 0 && candidates.every(c => c.screeningResult);
  const eligibleCandidates = candidates.filter(c => c.screeningResult === 'Eligible');
  const hasEligibleCandidates = eligibleCandidates.length > 0;
  const hasSelectionCommittee = selection && selection.length > 0;
  const hasApprovedSelectionCommittee = hasSelectionCommittee && selection.some(m => m.isSelectedByDean);
  const hasScheduledInterview = recruitment.interviewDate && recruitment.interviewVenue;
  const meritListSubmitted = ['MeritListPrepared', 'Approved', 'OfferPendingApproval', 'OfferIssued', 'Joined'].includes(recruitment.stage);
  const meritListApproved = ['Approved', 'OfferPendingApproval', 'OfferIssued', 'Joined'].includes(recruitment.stage);
  // The offer has been proposed (IssueOfferLetterAsync) and is awaiting the
  // approval-chain workflow instance reaching Approved -- ReleaseOfferLetterAsync
  // is what actually issues it. No action is available to the PI at this
  // stage beyond waiting; only a RegularStaff/DA-role user can release it.
  const offerPendingApproval = recruitment.stage === 'OfferPendingApproval';
  const offerIssued = ['OfferIssued', 'JoiningSubmitted', 'JoiningPendingHOD', 'JoiningPendingDean', 'Joined'].includes(recruitment.stage);
  const isJoined = recruitment.stage === 'Joined';

  const selectedCandidate = candidates.find(c => c.outcome === 'Selected' || c.meritRank === 1);

  // At OfferPendingApproval, Outcome isn't Selected yet (that's only set once
  // ReleaseOfferLetterAsync actually releases the offer), so selectedCandidate
  // above would silently fall back to meritRank === 1 -- wrong whenever the PI
  // proposed the offer to a non-rank-1 candidate, or blank on a re-offer round.
  // recruitment.pendingOfferCandidateId (IssueOfferLetterAsync's own explicit
  // CandidateId) is the real source of truth while an offer is pending.
  const pendingOfferCandidate = recruitment.pendingOfferCandidateId
    ? candidates.find(c => c.id === recruitment.pendingOfferCandidateId)
    : null;

  // Submit Offer Letter Details
  const handleIssueOfferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) {
      toast.error("No candidate selected for offer.");
      return;
    }
    const stipendVal = parseFloat(offerStipend || recruitment.recommendedStipend || 0);
    if (stipendVal < 0) {
      toast.error("Recommended stipend cannot be negative.");
      return;
    }
    setIsSubmittingOffer(true);
    try {
      await issueOffer(recruitmentId, {
        candidateId: selectedCandidate.id,
        recommendedStipend: stipendVal,
        joiningDate: offerJoiningDate
      });
      await load();
      toast.success("Offer letter successfully released!");
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  // PI forwards the candidate's own submission on to HOD -- the step that
  // replaced the PI filling the joining report in themselves.
  const handleForwardJoiningToHod = (rem) => run(async () => {
    if (!selectedCandidate) return;
    await forwardJoiningReportToHod(selectedCandidate.id, rem);
  });

  const handleForwardToDean = (rem) => run(async () => {
    if (!selectedCandidate) return;
    await forwardJoiningReport(selectedCandidate.id, rem);
  });

  const handleReturnToPi = (rem) => run(async () => {
    if (!selectedCandidate) return;
    await returnJoiningReport(selectedCandidate.id, rem);
  });

  // On failure (most commonly JoiningDocumentsMissingException -- the
  // Contract of Engagement not yet uploaded against this recruitment), the
  // server's own message is captured and shown inline, mirroring
  // handleApproveMeritList's pattern above.
  const handleApproveJoining = async (rem) => {
    if (!selectedCandidate) return;
    setJoiningApprovalError(null);
    try {
      await approveJoiningReport(selectedCandidate.id, typeof rem === 'string' ? rem : 'Approved by Dean');
      await load();
    } catch (err) {
      setJoiningApprovalError(err.message ?? 'The joining report could not be approved.');
    }
  };

  // Dean's merit-list approval attempt. On failure (most commonly
  // MeritListDocumentsMissingException -- one or more of SignedMeritList /
  // AttendanceSheet / MinutesOfSelectionScanned not yet uploaded), the
  // server's own message names exactly which documents are missing; that
  // message is captured and shown inline rather than independently
  // recomputed from upload state client-side.
  const handleApproveMeritList = async () => {
    setMeritListApprovalError(null);
    try {
      await approveMeritList(recruitmentId);
      await load();
    } catch (err) {
      setMeritListApprovalError(err.message ?? 'The merit list could not be approved.');
    }
  };

  // RegularStaff/DA-role attempt to release an offer once its approval-chain
  // workflow instance has reached Approved. On failure (most commonly
  // OfferNotApprovedException, if the chain hasn't reached Approved yet),
  // the server's own message is shown inline rather than the page trying to
  // independently track the workflow instance's stage.
  const handleReleaseOffer = async () => {
    setReleaseOfferError(null);
    setIsReleasingOffer(true);
    try {
      await releaseOffer(recruitmentId);
      await load();
    } catch (err) {
      setReleaseOfferError(err.message ?? 'The offer could not be released.');
    } finally {
      setIsReleasingOffer(false);
    }
  };

  // PI/Dean manual escape hatch once every ranked-eligible candidate has
  // declined -- the backend gate (MarkNoCandidateAcceptedAsync) is the real
  // enforcement; this button is just always available at Approved as a UX
  // nicety.
  const handleMarkNoCandidateAccepted = () => run(() => markNoCandidateAccepted(recruitmentId));

  // Candidate ids already marked Ineligible during screening -- the
  // confirmation list for the bulk-send button. The endpoint itself is
  // idempotent (Task 4) and silently skips candidates already notified, so
  // this simply lists every current Ineligible candidate rather than trying
  // to filter out already-notified ones (no notEligibleEmailSentAt-equivalent
  // field is exposed on CandidateSummary yet).
  const ineligibleCandidates = candidates.filter((c) => c.screeningResult === 'Ineligible');

  const handleSendNotEligibleEmails = () => run(async () => {
    setIsSendingNotEligibleEmails(true);
    try {
      await sendNotEligibleNotifications(recruitmentId);
      setShowNotEligibleConfirm(false);
    } finally {
      setIsSendingNotEligibleEmails(false);
    }
  });

  const handleDownloadJoiningDoc = async () => {
    try {
      await downloadRecruitmentDocument(recruitmentId, 'joining-letter');
    } catch (e) {
      const textContent = `MINISTRY OF EDUCATION / MNNIT ALLAHABAD\nOFFICE OF RESEARCH & CONSULTANCY\n\nJOINING REPORT & APPOINTMENT LETTER\nCandidate Name: ${selectedCandidate?.fullName || 'Selected Candidate'}\nRecruitment ID: ${recruitmentId}\nStipend: ₹${joiningData?.recommendedStipend || recruitment?.recommendedStipend || 0}\nJoined On: ${joiningData?.joinedOn || new Date().toISOString().substring(0, 10)}\nValid Till: ${joiningData?.validTill || 'One Year'}\n\nStatus: APPROVED BY DEAN (R&C)\n`;
      const blob = new Blob([textContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Joining_Letter_${selectedCandidate?.fullName ? selectedCandidate.fullName.replace(/\s+/g, '_') : recruitmentId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">

      {/* Header */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to List
      </button>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={20} className="text-slate-400" />
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Recruitment Details</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            Round {recruitment.advertisementRound}
            {recruitment.advertisementRound > 1 && ' (Re-advertised)'}
            {' · '}{recruitment.designation || 'Research Position'}
            {' · '}{recruitment.projectTitle || 'Research Project'}
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500 mt-2">
            <span>Created: {formatDate(recruitment.createdAt)}</span>
            {recruitment.interviewDate && (
              <>
                <span className="flex items-center gap-1"><Calendar size={14} /> Interview Date: {formatDate(recruitment.interviewDate)}{recruitment.interviewTime ? ` at ${recruitment.interviewTime.substring(0, 5)}` : ''}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> Venue: {recruitment.interviewVenue}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-bold border shadow-sm ${stageStyle}`}>
            {RECRUITMENT_STAGES[recruitment.stage] ?? recruitment.stage}
          </span>
          <button
            onClick={() => download('Advertisement')}
            className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <Download size={12} /> Download Advertisement
          </button>
          {/* The flat request/publish-advertisement mechanism was retired in
              favor of the chain-action approval workflow
              (Approve/Reject/Return via IRecruitmentService's
              *AdvertisementAsync methods). Editing/resubmitting only makes
              sense while the workflow instance is still with the PI (freshly
              raised, about to au, or returned for correction) --
              once RnC office or Computer Centre have it, or it has concluded,
              reopening this form would be confusing or wrong. A recruitment
              with no advertisement workflow instance yet (adWorkflow is null)
              is also PI-actionable: that is the "generate for the first time"
              case. */}
          {(!adWorkflow || ['WithPIAdvertisement', 'ReturnedToPIAdvertisement'].includes(adWorkflow.currentStage)) && (
            <button
              onClick={() => setIsAdModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 rounded-lg text-xs font-bold shadow-sm transition-all"
            >
              <Megaphone size={12} /> {adWorkflow ? 'Edit & Resubmit Advertisement' : 'Generate Advertisement'}
            </button>
          )}
        </div>
      </div>

      {adWorkflow && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Megaphone size={18} className="text-slate-400" />
            Advertisement Approval
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Available Actions</h3>
              <AdvertisementChainActions
                recruitmentRequestId={recruitmentId}
                workflowInstance={adWorkflow}
                onActed={() => { void load(); }}
              />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Timeline</h3>
              <ApprovalTimeline steps={adWorkflow.steps ?? []} />
            </div>
          </div>
        </section>
      )}


      {/* PI/Dean Alert message if payment received state is checked */}
      {recruitment.stage === 'Approved' && !hasReceipt && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-300 flex items-start gap-2.5 shadow-sm leading-normal">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Sanction Payment Gate Locked</p>
            <p className="mt-0.5">{PAYMENT_GATE_NOTE}</p>
          </div>
        </div>
      )}

      {/* --- APPLICANTS TABLE (ALWAYS FIRST) --- */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-slate-400" />
            Applicants ({candidates.length})
          </h2>
          <button
            type="button"
            onClick={() => navigate(`/recruitments/${recruitmentId}/applications`)}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5"
          >
            View All Applications
          </button>
        </div>

        {/* Offer Letter & Selection Action */}
        {recruitment.stage === 'Approved' && (
          <div className="p-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Award className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400">Issue Offer Letter & Finalize Selection</h3>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
                  The Dean has approved the merit list. Click below to issue the formal offer letter to the selected rank #1 candidate.
                </p>
              </div>
            </div>
            {candidates.filter((c) => (c.meritRank === 1 || c.screeningResult === 'Eligible')).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => run(() => issueOffer(recruitmentId, {
                  candidateId: c.id,
                  recommendedStipend: recruitment?.recommendedStipend || 0,
                  joiningDate: new Date().toISOString().substring(0, 10)
                }))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow transition-all hover:scale-[1.01]"
              >
                Issue Offer Letter to {c.fullName} (Rank #{c.meritRank || 1})
              </button>
            ))}

            {/* Manual escape hatch: once every ranked-eligible candidate has
                 declined (or at the PI/Dean's own discretion), close out the
                 recruitment instead of re-offering. MarkNoCandidateAcceptedAsync
                 is the real, server-side enforcement of when this is valid --
                 this frontend condition is a UX tightening only (the backend
                 gate on Stage == Approved is unchanged): it hides the
                 one-click, unconfirmed-by-anything-else, irreversible button
                 until at least one candidate has actually declined an offer,
                 so it can't be fired immediately after merit-list approval,
                 before any offer has ever been made. */}
            {(isPI || isDeanOrOffice) && candidates.some(c => c.offerResponse === 'Declined') && (
              <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Mark this recruitment as having no candidate accepted? This closes out the offer process.')) {
                      handleMarkNoCandidateAccepted();
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Mark No Candidate Accepted
                </button>
              </div>
            )}
          </div>
        )}

        {candidates.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/30 dark:bg-slate-900/30">
            <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">No applications received yet for this position.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5 font-bold text-slate-500">Name</th>
                  <th className="px-4 py-3.5 font-bold text-slate-500">Qualification</th>
                  <th className="px-4 py-3.5 font-bold text-slate-500">Contact</th>
                  <th className="px-4 py-3.5 font-bold text-slate-500">Interview Mode</th>
                  <th className="px-4 py-3.5 font-bold text-slate-500">Merit</th>
                  <th className="px-4 py-3.5 font-bold text-slate-500">Outcome</th>
                  <th className="px-4 py-3.5 font-bold text-slate-500 text-right">Screening</th>
                  <th className="px-4 py-3">Joining Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">{c.fullName}</td>
                    <td className="px-4 py-3.5 font-medium">{c.qualification ?? '—'}</td>
                    <td className="px-4 py-3.5 font-semibold text-xs text-slate-500">{c.mobile || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.screeningResult === 'Eligible' && ['ScreeningInProgress', 'SelectionScheduled'].includes(recruitment.stage) && isPI ? (
                          <select
                            value={c.interviewMode || 'Offline'}
                            onChange={(e) => run(() => setInterviewMode(recruitmentId, { candidateId: c.id, mode: e.target.value, deanApprovalUserId: null }))}
                            className="px-2 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Offline">Offline</option>
                            <option value="Online">Online</option>
                          </select>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                            {c.interviewMode || 'Offline'}
                          </span>
                        )}
                        {user?.roles?.includes('Dean') && c.interviewMode === 'Online' && (
                          <button
                            type="button"
                            onClick={() => run(() => approveInterviewMode(c.id, 'Online'))}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded"
                          >
                            Approve Online
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-extrabold text-slate-700 dark:text-slate-300">{c.meritRank ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${c.outcome === 'Selected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800' :
                        c.outcome === 'NotSelected' ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-850 dark:text-slate-400' :
                          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400'
                        }`}>
                        {CANDIDATE_OUTCOMES[c.outcome] ?? c.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {c.screeningResult ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${c.screeningResult === 'Eligible' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                          }`}>
                          {c.screeningResult}
                        </span>
                      ) : (
                        hasScreeningCommittee && isPI ? (
                          candidatePendingRemark === c.id ? (
                            <div className="flex flex-col items-end gap-1.5 w-56 ml-auto">
                              <textarea
                                autoFocus
                                rows={2}
                                value={ineligibleRemarkDraft[c.id] ?? ''}
                                onChange={(e) => setIneligibleRemarkDraft((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                placeholder="Remark required for Not Eligible…"
                                className="w-full px-2 py-1.5 text-xs border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-rose-500"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setCandidatePendingRemark(null)}
                                  className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!(ineligibleRemarkDraft[c.id] ?? '').trim()}
                                  onClick={async () => {
                                    const remark = (ineligibleRemarkDraft[c.id] ?? '').trim();
                                    if (!remark) return;
                                    try {
                                      await recordScreeningResult(recruitmentId, {
                                        candidateId: c.id, result: 'Ineligible', remarks: remark,
                                      });
                                      setCandidatePendingRemark(null);
                                      await load();
                                    } catch {
                                      // Global toast (via apiClient) shows the error automatically;
                                      // the remark box stays open so the PI can retry.
                                    }
                                  }}
                                  className="px-2 py-1 text-xs font-bold rounded-lg border bg-rose-50 border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 dark:border-rose-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-50 disabled:hover:text-rose-700"
                                >
                                  Confirm Not eligible
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              {SCREENING_RESULTS.map((r) => (
                                <button
                                  key={r.value}
                                  type="button"
                                  onClick={() => {
                                    if (r.value === 'Ineligible') {
                                      setCandidatePendingRemark(c.id);
                                      return;
                                    }
                                    run(() => recordScreeningResult(recruitmentId, { candidateId: c.id, result: r.value }));
                                  }}
                                  className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all active:scale-95 ${r.value === 'Eligible'
                                    ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:border-emerald-700'
                                    : 'bg-rose-50 border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 dark:border-rose-700'
                                    }`}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold italic">Awaiting Screening Committee</span>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {c.outcome === 'Selected' && !['Approved', 'OfferPendingApproval', 'OfferIssued', 'JoiningPendingHOD', 'JoiningPendingDean', 'Joined'].includes(recruitment.stage) && (
                        <button
                          type="button"
                          onClick={() => run(() => issueOffer(recruitmentId, {
                            candidateId: c.id,
                            recommendedStipend: recruitment?.recommendedStipend || 0,
                            joiningDate: new Date().toISOString().substring(0, 10)
                          }))}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded shadow-sm inline-flex items-center gap-1"
                        >
                          <Send size={12} /> Issue Offer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- PROGRESSIVE WORKFLOW STEP CARDS --- */}
      <div className="space-y-6">

        {/* STEP 1: Screening Committee Setup */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!hasScreeningCommittee ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${hasScreeningCommittee ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {hasScreeningCommittee ? <Check size={14} /> : '1'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Screening Committee</h3>
            </div>
            {hasScreeningCommittee && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                screening.some((m) => m.role === 'NominatedFaculty')
                  ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}>
                {screening.some((m) => m.role === 'NominatedFaculty') ? (
                  <><CheckCircle size={12} /> Configured & Approved</>
                ) : (
                  <><Clock size={12} /> Pending Dean Nominee</>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* Highlighted Screening Committee Roster:
                  Distinctly highlights members who are already a member (PI/Co-PI)
                  and the member chosen by the Dean (Nominated Faculty). */}
              {screening.length > 0 && (
                <ScreeningCommitteeRoster screening={screening} />
              )}

              {(isPI || isDean) && !allScreened && (
                <div className={screening.length > 0 ? 'mt-4' : ''}>
                  <CommitteeForm
                    recruitmentId={recruitmentId}
                    kind="Screening"
                    existing={screening}
                    workflow={screeningWorkflow}
                    onSaved={() => void load()}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-slate-700 dark:text-slate-300">Documentation & Regulations</p>
                <p className="text-slate-500 dark:text-slate-400">The screening committee determines eligible/ineligible candidates and signs the screening sheet proforma.</p>
              </div>
              {hasScreeningCommittee ? (
                <button
                  onClick={() => download('ScreeningProforma')}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold shadow-sm transition-all"
                >
                  <Download size={14} /> Screening Proforma
                </button>
              ) : (
                <p className="text-[10px] text-amber-600 font-bold mt-4 flex items-center gap-1"><Lock size={10} strokeWidth={3} /> Proforma locked until committee is saved</p>
              )}
              {hasScreeningCommittee && (isPI || isDean) && (
                <div className="mt-4">
                  <CandidateDocumentSlot
                    ownerType="RecruitmentRequest"
                    ownerId={recruitmentId}
                    kind="ScreeningCommitteeProceedings"
                    label="Screening Committee Proceedings"
                    documentId={uploadedDocumentKinds.ScreeningCommitteeProceedings || null}
                    onChange={(id) => markUploaded('ScreeningCommitteeProceedings', id)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 2: Screening Decision (Eligible / Ineligible Candidates) */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!hasScreeningCommittee ? 'opacity-50 pointer-events-none' :
          !allScreened ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${allScreened ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {allScreened ? <Check size={14} /> : '2'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Applicant Eligibility Screening</h3>
            </div>
            {allScreened && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={12} /> Screening Completed
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-normal mb-3">
            Review applicant qualifications and decide their eligibility. Mark candidates as **Eligible** or **Not eligible** using the buttons in the Applicants list above.
          </p>

          {!allScreened && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs font-semibold text-amber-800 dark:text-amber-300 rounded-lg flex items-center gap-2">
              <Clock size={14} />
              <span>Awaiting screening results. Screen all candidates to unlock the Selection Committee setup.</span>
            </div>
          )}

          {isPI && ineligibleCandidates.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                {ineligibleCandidates.length} candidate{ineligibleCandidates.length === 1 ? '' : 's'} marked Not Eligible.
              </p>
              <button
                type="button"
                onClick={() => setShowNotEligibleConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                <Mail size={13} /> Send Not Eligible Emails
              </button>
            </div>
          )}

          {showNotEligibleConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isSendingNotEligibleEmails && setShowNotEligibleConfirm(false)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Mail size={16} className="text-rose-600" /> Send Not Eligible Emails
                </h4>
                <p className="text-xs text-slate-500">
                  This will email the following {ineligibleCandidates.length} candidate{ineligibleCandidates.length === 1 ? '' : 's'} that they were not found eligible.
                  Candidates already notified are skipped automatically.
                </p>
                <ul className="max-h-40 overflow-y-auto text-xs font-semibold text-slate-700 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                  {ineligibleCandidates.map((c) => (
                    <li key={c.id}>{c.fullName}</li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSendingNotEligibleEmails}
                    onClick={() => setShowNotEligibleConfirm(false)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSendingNotEligibleEmails}
                    onClick={handleSendNotEligibleEmails}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                  >
                    {isSendingNotEligibleEmails ? 'Sending…' : 'Confirm & Send'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3: Selection Committee Setup */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!allScreened ? 'opacity-50 pointer-events-none' :
          !hasSelectionCommittee ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${hasSelectionCommittee ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {hasSelectionCommittee ? <Check size={14} /> : '3'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Selection Committee Setup</h3>
            </div>
            {hasSelectionCommittee && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={12} /> Configured
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* Same fix as the Screening step above: show the existing
                  roster alongside the action panel rather than instead of
                  it, so the Dean can see the PI/HOD/recommended members
                  already on record (final whole-branch review finding 3a). */}
              {selection.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs space-y-2">
                  <p className="font-bold text-slate-700">Roster Summary:</p>
                  {selection.map((m, idx) => (
                    <div key={m.id || idx} className="flex justify-between font-medium">
                      <span>{m.role}: {m.name}</span>
                      <span>{m.department} ({m.position}) {m.isExternal && '(External)'}</span>
                    </div>
                  ))}
                </div>
              )}

              {(isPI || isDean) && !hasScheduledInterview && (
                <div className={selection.length > 0 ? 'mt-4' : ''}>
                  <CommitteeForm
                    recruitmentId={recruitmentId}
                    kind="Selection"
                    existing={selection}
                    workflow={selectionWorkflow}
                    onSaved={() => void load()}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-slate-700">Requirements & Structure</p>
                <p className="text-slate-500">Requires exactly 1 HOD (Chairman), 1 PI, and 2 nominated faculty members (at least 1 must be external Associate/Professor).</p>
              </div>
              {hasSelectionCommittee ? (
                <button
                  onClick={() => download('SelectionProforma')}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold shadow-sm transition-all"
                >
                  <Download size={14} /> Selection Proforma
                </button>
              ) : (
                <p className="text-[10px] text-amber-600 font-bold mt-4 flex items-center gap-1"><Lock size={10} strokeWidth={3} /> Proforma locked until committee is saved</p>
              )}
              {hasSelectionCommittee && (isPI || isDean) && (
                <div className="mt-4">
                  <CandidateDocumentSlot
                    ownerType="RecruitmentRequest"
                    ownerId={recruitmentId}
                    kind="SelectionCommitteeDocuments"
                    label="Selection Committee Documents"
                    documentId={uploadedDocumentKinds.SelectionCommitteeDocuments || null}
                    onChange={(id) => markUploaded('SelectionCommitteeDocuments', id)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 4: Interview Mode & Scheduling */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!hasApprovedSelectionCommittee ? 'opacity-50 pointer-events-none' :
          !hasScheduledInterview ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${hasScheduledInterview ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {hasScheduledInterview ? <Check size={14} /> : '4'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Schedule Selection Committee & Interview</h3>
            </div>
            {hasScheduledInterview && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={12} /> Scheduled
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {isPI && !meritListSubmitted ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const date = formData.get('interviewDate');
                  const time = formData.get('interviewTime');
                  const formattedTime = time.length === 5 ? `${time}:00` : time;
                  const venue = formData.get('interviewVenue');
                  run(() => scheduleInterview(recruitmentId, { interviewDate: date, interviewTime: formattedTime, interviewVenue: venue }));
                }} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interview Date *</label>
                      <input required type="date" name="interviewDate" defaultValue={recruitment.interviewDate ? recruitment.interviewDate.substring(0, 10) : ''} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interview Time *</label>
                      <input required type="time" name="interviewTime" defaultValue={recruitment.interviewTime ? recruitment.interviewTime.substring(0, 5) : ''} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interview Venue *</label>
                      <input required type="text" name="interviewVenue" defaultValue={recruitment.interviewVenue || ''} placeholder="e.g. CSED Seminar Room" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                    {recruitment.interviewDate ? 'Update Interview Schedule' : 'Schedule Interview'}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs space-y-1.5">
                  <p className="font-semibold text-slate-700">Interview details scheduled by PI:</p>
                  <p><strong>Date:</strong> {formatDate(recruitment.interviewDate)}</p>
                  {recruitment.interviewTime && <p><strong>Time:</strong> {recruitment.interviewTime.substring(0, 5)}</p>}
                  <p><strong>Venue:</strong> {recruitment.interviewVenue}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-end p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
              {hasScheduledInterview ? (
                <button
                  onClick={() => download('MinutesOfSelection')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold shadow-sm transition-all"
                >
                  <Download size={14} /> Minutes of Selection
                </button>
              ) : (
                <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1"><Lock size={10} strokeWidth={3} /> Minutes locked until scheduled</p>
              )}
            </div>
          </div>
        </div>

        {/* STEP 5: Post-Interview & Merit List */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!hasScheduledInterview ? 'opacity-50 pointer-events-none' :
          !meritListApproved ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${meritListApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {meritListApproved ? <Check size={14} /> : '5'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Post-Interview Ranks & Merit Signature</h3>
            </div>
            {meritListApproved && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={12} /> Merit List Approved
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* PI Merit List Submission */}
            {hasEligibleCandidates && !meritListSubmitted && isPI && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Define the ranks of the eligible candidates and submit the final merit list order to the selection committee members.
                </p>
                <button
                  type="button"
                  onClick={() => run(() => submitMeritList(
                    recruitmentId,
                    candidates
                      .filter((c) => c.screeningResult === 'Eligible')
                      .map((c, i) => ({ candidateId: c.id, rank: i + 1 }))))}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Send size={12} /> Submit merit list in this order
                </button>
              </div>
            )}

            {/* Committee Roster (informational -- signing is no longer a
                per-member digital action; see the 3-document upload gate
                below, which is what ApproveMeritListAsync actually checks). */}
            {selection.length > 0 && meritListSubmitted && (
              <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-500" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Selection Committee
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selection.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-semibold border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-700 dark:text-slate-350">{m.role}: {m.name}</span>
                    </div>
                  ))}
                </div>

                {/* The Dean's approval gate: SignedMeritList, AttendanceSheet
                    and MinutesOfSelectionScanned must all be uploaded before
                    ApproveMeritListAsync will succeed (enforced server-side;
                    see the Approve button's error handling below for what
                    happens when one is missing). */}
                <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Documents required before Dean approval</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <CandidateDocumentSlot
                      ownerType="RecruitmentRequest"
                      ownerId={recruitmentId}
                      kind="SignedMeritList"
                      label="Signed Merit List"
                      required
                      documentId={uploadedDocumentKinds.SignedMeritList || null}
                      onChange={(id) => markUploaded('SignedMeritList', id)}
                    />
                    <CandidateDocumentSlot
                      ownerType="RecruitmentRequest"
                      ownerId={recruitmentId}
                      kind="AttendanceSheet"
                      label="Attendance Sheet"
                      required
                      documentId={uploadedDocumentKinds.AttendanceSheet || null}
                      onChange={(id) => markUploaded('AttendanceSheet', id)}
                    />
                    <CandidateDocumentSlot
                      ownerType="RecruitmentRequest"
                      ownerId={recruitmentId}
                      kind="MinutesOfSelectionScanned"
                      label="Minutes of Selection (scanned)"
                      required
                      documentId={uploadedDocumentKinds.MinutesOfSelectionScanned || null}
                      onChange={(id) => markUploaded('MinutesOfSelectionScanned', id)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit step for PI when all documents are uploaded */}
            {meritListSubmitted && recruitment.stage === 'MeritListPrepared' && !isDeanOrOffice && 
              uploadedDocumentKinds.SignedMeritList && 
              uploadedDocumentKinds.AttendanceSheet && 
              uploadedDocumentKinds.MinutesOfSelectionScanned && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                {!window.sessionStorage.getItem(`meritDocsSubmitted_${recruitmentId}`) ? (
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div>
                      <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400">Ready to Submit</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">All required documents are uploaded. Submit them to forward the merit list for Dean (R&C) approval.</p>
                    </div>
                    <button
                      onClick={() => {
                        window.sessionStorage.setItem(`meritDocsSubmitted_${recruitmentId}`, 'true');
                        // Trigger a re-render to show the success banner
                        setRecruitment({...recruitment});
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all hover:scale-[1.02]"
                    >
                      <Send size={16} />
                      Submit to Dean
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                    <CheckCircle className="text-emerald-600 shrink-0" size={20} />
                    <div>
                      <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Successfully Submitted</h3>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                        The documents have been saved and forwarded to the Dean (R&C). No further action is required on your part.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dean Approval block (Merit List) */}
            {isDeanOrOffice && recruitment.stage === 'MeritListPrepared' && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <Award className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Dean (R&C) Approval Required</h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                      Review the merit list and click below to give final institute approval. All 3 required documents above must be uploaded first.
                    </p>
                  </div>
                </div>
                {meritListApprovalError && (
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-2.5 flex items-start gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {meritListApprovalError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleApproveMeritList}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition-all hover:scale-[1.01]"
                >
                  Approve Merit List & Release Position
                </button>
              </div>
            )}

            {/* Document Downloads (uploads for this section now live in the
                "Documents required before Dean approval" panel above, using
                the real /api/documents/upload endpoint -- this used to be a
                pair of file inputs that only called toast.error() and uploaded
                nothing). */}
            {meritListSubmitted && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => download('MeritList')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all"
                  >
                    <Download size={14} /> Download Merit List
                  </button>
                  <button
                    onClick={() => download('MinutesOfSelection')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all"
                  >
                    <Download size={14} /> Download Minutes of Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 6: Offer Letter Release */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!meritListApproved ? 'opacity-50 pointer-events-none' :
          !offerIssued ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${offerIssued ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {offerIssued ? <Check size={14} /> : '6'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Offer Letter Release</h3>
            </div>
            {offerIssued && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={12} /> Offer Released
              </span>
            )}
            {offerPendingApproval && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock size={12} /> Awaiting Approval
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Offer proposed, awaiting the approval-chain workflow instance
                 to reach Approved -- IssueOfferLetterAsync moved the
                 recruitment here instead of issuing directly; only
                 ReleaseOfferLetterAsync (RegularStaff) actually emails the
                 candidate and moves to OfferIssued. */}
            {offerPendingApproval ? (
              <div className="space-y-3">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 leading-normal">
                  <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Offer Awaiting Approval</p>
                    <p className="mt-0.5">
                      The offer for <strong>{pendingOfferCandidate?.fullName}</strong> has been proposed and is working through
                      its approval chain. It will be released to the candidate once approved.
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Approval Chain</h4>
                  <OfferChainActions
                    recruitmentRequestId={recruitmentId}
                    workflowInstance={offerWorkflow}
                    onActed={() => { void load(); }}
                  />
                  {offerWorkflow && (
                    <div className="mt-3">
                      <ApprovalTimeline steps={offerWorkflow.steps ?? []} />
                    </div>
                  )}
                </div>
                {user?.roles?.includes('RegularStaff') && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleReleaseOffer}
                      disabled={isReleasingOffer}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01]"
                    >
                      {isReleasingOffer ? 'Releasing…' : 'Release Offer'}
                    </button>
                    {releaseOfferError && (
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{releaseOfferError}</p>
                    )}
                  </div>
                )}
              </div>
            ) : !offerIssued ? (
              <div className="space-y-4">
                {/* Check receipt payment */}
                {!hasReceipt ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 leading-normal">
                    <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Sanction Payment Gate Blocked</p>
                      <p className="mt-0.5">{PAYMENT_GATE_NOTE}</p>
                    </div>
                  </div>
                ) : (
                  isPI ? (
                    <form onSubmit={handleIssueOfferSubmit} className="space-y-4 max-w-xl">
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 rounded-xl text-xs text-blue-700">
                        Payment verified. Enter recommended stipend and joining deadline to issue the position offer letter.
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joining Date Deadline *</label>
                          <input
                            required
                            type="date"
                            value={offerJoiningDate}
                            onChange={(e) => setOfferJoiningDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recommended Stipend (₹/month) *</label>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 31000"
                            value={offerStipend}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== '' && Number(val) < 0) return;
                              setOfferStipend(val);
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingOffer}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01]"
                      >
                        {isSubmittingOffer ? 'Releasing Offer...' : 'Release Offer Letter'}
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Waiting for PI to fill details and issue offer letter.</p>
                  )
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100">
                <div className="text-xs space-y-1">
                  <p className="font-bold text-slate-700">Offer released to: <span className="text-slate-900 font-extrabold">{selectedCandidate?.fullName}</span></p>
                  <p className="text-slate-500">The candidate has been notified to submit joining details.</p>
                </div>
                <button
                  onClick={() => download('OfferLetter')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <Download size={14} /> Download Offer Letter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* STEP 7: Selection Update & Joining Letter Routing Workflow */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all ${!offerIssued ? 'opacity-50 pointer-events-none' :
          joiningState !== 'Approved' ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800'
          }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${joiningState === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {joiningState === 'Approved' ? <Check size={14} /> : '7'}
              </span>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Joining Letter & Approval Routing Workflow</h3>
            </div>
            {joiningState && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${joiningState === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-250'
                }`}>
                <Clock size={12} />
                {joiningState === 'PI_Draft' && 'Pending Candidate Submit'}
                {joiningState === 'PendingPIForward' && 'Pending PI Forward'}
                {joiningState === 'SentToHod' && 'Sent to HOD'}
                {joiningState === 'SentToDean' && 'Sent to Dean/DR'}
                {joiningState === 'Approved' && 'Joined & Approved'}
              </span>
            )}
          </div>

          <div className="space-y-5">
            {/* 1. Awaiting-candidate notice -- shown at OfferIssued, which covers
                 both "nothing submitted yet" and "HOD/Dean returned it"
                 (ReturnJoiningReportAsync sends the recruitment back to this
                 same stage). The candidate now submits their own joining
                 report from their portal (My Applications), not the PI here --
                 this panel is read-only status, not a form. */}
            {(!joiningState || joiningState === 'PI_Draft') && (
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                Waiting for <strong>{selectedCandidate?.fullName || 'the selected candidate'}</strong> to submit their joining report from their own Candidate Panel (bank details, Aadhar/PAN, joining date). It will appear here and route to HOD once submitted.
              </div>
            )}

            {/* 2. Read-only summary, document download & routing buttons --
                 only once a joining report actually exists (HOD/Dean stages),
                 not while the PI's own form above is what's showing. */}
            {joiningData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Read-only Data */}
                  <div className="lg:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="sm:col-span-2 border-b pb-2 mb-1 flex justify-between items-center">
                      <span className="font-bold text-slate-800">Recruit Joining Credentials:</span>
                      <span className="text-[10px] text-slate-400 italic">Candidate: {selectedCandidate?.fullName}</span>
                    </div>
                    <div><strong>Aadhar Number:</strong> {joiningData?.aadharNo}</div>
                    <div><strong>PAN Number:</strong> {joiningData?.panNo}</div>
                    <div><strong>Bank Account No:</strong> {joiningData?.bankAccountNo}</div>
                    <div><strong>IFSC Code:</strong> {joiningData?.ifscCode}</div>
                    <div><strong>Stipend:</strong> ₹{joiningData?.recommendedStipend}</div>
                    <div><strong>Joined On:</strong> {joiningData?.joinedOn}</div>
                    <div><strong>Valid Till:</strong> {joiningData?.validTill}</div>
                    <div><strong>Gender:</strong> {joiningData?.gender}</div>
                  </div>

                  {/* Actions & Routing Status */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 rounded-xl flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Approval Routing Track</h4>

                      {/* Flow Track stepper */}
                      <div className="space-y-3.5 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-250 dark:before:bg-slate-800 text-[11px] font-semibold">

                        {/* Candidate step */}
                        <div className="flex items-center gap-2.5 relative pl-5">
                          <span className={`absolute left-0 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${joiningState === 'PI_Draft' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                            {joiningState === 'PI_Draft' ? <Clock size={8} /> : <Check size={8} />}
                          </span>
                          <span className={joiningState === 'PI_Draft' ? 'text-blue-700' : 'text-slate-500'}>Candidate Submit</span>
                        </div>

                        {/* PI forward step */}
                        <div className="flex items-center gap-2.5 relative pl-5">
                          <span className={`absolute left-0 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${joiningState === 'PendingPIForward' ? 'bg-blue-100 text-blue-800' :
                            ['SentToHod', 'SentToDean', 'Approved'].includes(joiningState) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                            {joiningState === 'PendingPIForward' ? <Clock size={8} /> :
                              ['SentToHod', 'SentToDean', 'Approved'].includes(joiningState) ? <Check size={8} /> : <Lock size={8} />}
                          </span>
                          <span className={joiningState === 'PendingPIForward' ? 'text-blue-700' : 'text-slate-400'}>PI Forward</span>
                        </div>

                        {/* HOD step */}
                        <div className="flex items-center gap-2.5 relative pl-5">
                          <span className={`absolute left-0 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${joiningState === 'SentToHod' ? 'bg-blue-100 text-blue-800' :
                            ['SentToDean', 'Approved'].includes(joiningState) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                            {joiningState === 'SentToHod' ? <Clock size={8} /> :
                              ['SentToDean', 'Approved'].includes(joiningState) ? <Check size={8} /> : <Lock size={8} />}
                          </span>
                          <span className={joiningState === 'SentToHod' ? 'text-blue-700' : 'text-slate-400'}>HOD Verification</span>
                        </div>

                        {/* Dean step */}
                        <div className="flex items-center gap-2.5 relative pl-5">
                          <span className={`absolute left-0 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${joiningState === 'SentToDean' ? 'bg-blue-100 text-blue-800' :
                            joiningState === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                            {joiningState === 'SentToDean' ? <Clock size={8} /> :
                              joiningState === 'Approved' ? <Check size={8} /> : <Lock size={8} />}
                          </span>
                          <span className={joiningState === 'SentToDean' ? 'text-blue-700' : 'text-slate-400'}>Dean/DR Approval</span>
                        </div>

                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      {joiningState === 'Approved' ? (
                        <button
                          onClick={handleDownloadJoiningDoc}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                        >
                          <Download size={14} /> Download Joining Letter
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => toast.success("Joining Letter can only be downloaded after Dean/DR Approval.")}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 border border-slate-300 rounded-lg text-xs font-semibold cursor-not-allowed opacity-75"
                            title="Requires Dean Approval"
                          >
                            <Lock size={13} /> Download Joining Letter (Locked)
                          </button>
                          <span className="text-[10px] text-amber-600 text-center font-medium">
                            Pending Dean/DR Approval
                          </span>
                        </div>
                      )}
                    </div>


                  </div>
                </div>

                {/* Workflow Interactive Buttons based on Role */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">

                  {/* PI actions -- review what the candidate submitted, then forward to HOD or send it back */}
                  {joiningState === 'PendingPIForward' && (
                    isPI ? (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">PI Review Action Panel:</p>
                        <textarea
                          placeholder="Provide optional remarks (mandatory if returning to candidate)..."
                          id="piJoiningRemarks"
                          className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const rem = document.getElementById('piJoiningRemarks').value;
                              if (!rem.trim()) {
                                toast.error("Remarks are required to return the report to the candidate.");
                                return;
                              }
                              handleReturnToPi(rem);
                            }}
                            className="px-3 py-2 bg-rose-50 border border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            Return to Candidate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const rem = document.getElementById('piJoiningRemarks').value;
                              handleForwardJoiningToHod(rem);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1"
                          >
                            <Check size={12} strokeWidth={3} /> Verify & Forward to HOD
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic flex items-center gap-1"><Clock size={12} /> Candidate has submitted their joining report. Awaiting PI review.</p>
                    )
                  )}

                  {/* HOD actions */}
                  {joiningState === 'SentToHod' && (
                    isHOD ? (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">HOD Approval Action Panel:</p>
                        <textarea
                          placeholder="Provide optional remarks (mandatory if returning to PI)..."
                          id="hodRemarks"
                          className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const rem = document.getElementById('hodRemarks').value;
                              if (!rem.trim()) {
                                toast.error("Remarks are required to return report.");
                                return;
                              }
                              handleReturnToPi(rem);
                            }}
                            className="px-3 py-2 bg-rose-50 border border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            Return to PI
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const rem = document.getElementById('hodRemarks').value;
                              handleForwardToDean(rem);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1"
                          >
                            <Check size={12} strokeWidth={3} /> Verify & Forward to Dean
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic flex items-center gap-1"><Clock size={12} /> Forwarded to HOD. Awaiting HOD verification.</p>
                    )
                  )}

                  {/* The Fellow's own signed Offer Letter + Contract of
                       Engagement -- uploaded at joining-report submission
                       time (SaveJoiningReportAsync requires both, throwing
                       JoiningDocumentsMissingException otherwise), owned by
                       their own Candidate row. Read-only here: this is a
                       review/verification view for PI/HOD/Dean, not an
                       upload point -- the Fellow already had to provide both
                       to submit at all. Visible throughout the review chain
                       (from JoiningSubmitted, whenever joiningData is
                       loaded) so anyone reviewing can verify them. */}
                  {joiningData && (joiningData.signedOfferLetterDocumentId || joiningData.contractOfEngagementDocumentId) && (
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 mb-4">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Documents uploaded by the Fellow</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        {joiningData.signedOfferLetterDocumentId ? (
                          <a
                            href={documentDownloadPath(joiningData.signedOfferLetterDocumentId)}
                            target="_blank" rel="noopener noreferrer" download
                            className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <Download size={13} /> Signed Offer Letter
                          </a>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">Signed Offer Letter -- missing</span>
                        )}
                        {joiningData.contractOfEngagementDocumentId ? (
                          <a
                            href={documentDownloadPath(joiningData.contractOfEngagementDocumentId)}
                            target="_blank" rel="noopener noreferrer" download
                            className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <Download size={13} /> Signed Contract of Engagement
                          </a>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">Contract of Engagement -- missing</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dean/DR actions */}
                  {joiningState === 'SentToDean' && (
                    isDeanOrOffice ? (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">Dean (R&C) Approval Actions:</p>
                        <textarea
                          placeholder="Provide optional remarks..."
                          id="deanRemarks"
                          className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const rem = document.getElementById('deanRemarks')?.value || '';
                              if (!rem.trim()) {
                                toast.error("Remarks are required to return report.");
                                return;
                              }
                              handleReturnToPi(rem);
                            }}
                            className="px-3 py-2 bg-rose-50 border border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            Return to PI
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveJoining(document.getElementById('deanRemarks')?.value || '')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1"
                          >
                            <Check size={12} strokeWidth={3} /> Approve Joining Report
                          </button>
                        </div>
                        {joiningApprovalError && (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-right">{joiningApprovalError}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic flex items-center gap-1"><Clock size={12} /> Forwarded to Dean/DR. Awaiting final Dean approval.</p>
                    )
                  )}

                  {/* Approved Success Block */}
                  {joiningState === 'Approved' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs leading-normal flex items-start gap-2.5">
                      <FileCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-bold">Joining Approved & Active</p>
                        <p className="mt-0.5">The candidate is officially active and joined as a fellow. HOD, PI, Dean, and candidate can all access the approved joining letter.</p>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 p-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>{PAYMENT_GATE_NOTE}</p>
      </div>

      <GenerateAdvertisementModal
        isOpen={isAdModalOpen}
        onClose={() => setIsAdModalOpen(false)}
        project={adProject}
        manpower={adProject?.sanctionedManpowerPositions?.find(
          (p) => p.id === recruitment.sanctionedManpowerPositionId,
        )}
        onGenerateComplete={() => { void load(); }}
      />
    </div>
  );
}
