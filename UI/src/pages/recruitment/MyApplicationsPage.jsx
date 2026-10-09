import { useEffect, useState, useRef } from 'react';
import { FileText, Briefcase, Calendar, PenLine, ClipboardCheck, Eye, Download } from 'lucide-react';
import { listMyApplications, listOpenRecruitments, acceptOffer, declineOffer } from '../../api/recruitmentApi';
import { CANDIDATE_OUTCOMES, SCREENING_RESULTS } from '../../constants/recruitmentEnums';
import ApplicationWizard from './components/ApplicationWizard/ApplicationWizard';
import JoiningReportModal from './components/JoiningReportModal';
import ViewManpowerDocumentModal from '../projects/components/ViewManpowerDocumentModal';
import ViewCandidateApplicationModal from './components/ViewCandidateApplicationModal';

const JOINING_STAGE_LABELS = {
  JoiningSubmitted: 'Sent to PI',
  JoiningPendingHOD: 'Sent to HOD',
  JoiningPendingDean: 'Sent to Dean/DR',
  Joined: 'Joined',
};

const OUTCOME_STYLES = {
  Selected: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  NotSelected: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  Pending: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function screeningLabel(value) {
  if (!value) return 'Not screened';
  return SCREENING_RESULTS.find((r) => r.value === value)?.label ?? value;
}

export default function MyApplicationsPage() {
  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'explore'
  const [applications, setApplications] = useState([]);
  const [openRecruitments, setOpenRecruitments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Application wizard state: which recruitment/candidate it's open for, if any.
  const [wizardTarget, setWizardTarget] = useState(null); // { recruitmentId, recruitmentLabel, existingCandidateId? }

  // Advertisement preview state: which recruitment's advertisement is open, if any.
  const [previewRecruitment, setPreviewRecruitment] = useState(null); // { id, designation } | null

  // Joining report modal state: which application it's open for, if any.
  const [joiningTarget, setJoiningTarget] = useState(null); // application row | null

  // View application modal state: candidate id to view/download
  const [viewApplicationCandidateId, setViewApplicationCandidateId] = useState(null);

  // In-flight state for the candidate's own Accept/Decline action on an
  // issued offer, keyed by candidate id, so only the row being acted on
  // shows a busy state.
  const [respondingCandidateId, setRespondingCandidateId] = useState(null);

  const isFirstLoad = useRef(true);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([listMyApplications(), listOpenRecruitments()])
      .then(([apps, openRounds]) => {
        setApplications(apps ?? []);
        setOpenRecruitments(openRounds ?? []);
        if (apps && apps.length === 0 && isFirstLoad.current) {
          setActiveTab('explore');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load portal recruitment data.');
      })
      .finally(() => {
        setIsLoading(false);
        isFirstLoad.current = false;
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenApply = (rec) => {
    setWizardTarget({
      recruitmentId: rec.id,
      recruitmentLabel: rec.designation,
    });
  };

  const handlePreviewAdvertisement = (rec) => {
    setPreviewRecruitment(rec);
  };

  const handleContinueDraft = (application) => {
    setWizardTarget({
      recruitmentId: application.recruitmentRequestId,
      recruitmentLabel: application.fullName || 'Your application',
      existingCandidateId: application.id,
    });
  };

  const handleWizardClose = () => setWizardTarget(null);

  const handleWizardSubmitted = () => {
    loadData();
    setActiveTab('applications');
  };

  const handleAcceptOffer = async (candidateId) => {
    setRespondingCandidateId(candidateId);
    try {
      await acceptOffer(candidateId);
      loadData();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setRespondingCandidateId(null);
    }
  };

  const handleDeclineOffer = async (candidateId) => {
    if (!window.confirm('Decline this offer? This cannot be undone.')) return;
    setRespondingCandidateId(candidateId);
    try {
      await declineOffer(candidateId);
      loadData();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setRespondingCandidateId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Briefcase size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Candidate Panel</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Apply to research vacancies and manage your active project applications.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit border border-slate-200/50 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'applications'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/10'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
        >
          <FileText size={16} />
          My Applications
          {applications.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
              {applications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('explore')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'explore'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/10'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
        >
          <Briefcase size={16} />
          Explore Opportunities
          {openRecruitments.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
              {openRecruitments.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
          <span className="text-sm font-bold">Loading portal details...</span>
        </div>
      ) : error ? (
        <div className="p-16 text-center text-rose-600 dark:text-rose-400 font-semibold">{error}</div>
      ) : activeTab === 'applications' ? (
        // --- APPLICATIONS TAB ---
        applications.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/20">
            <FileText size={40} className="text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-slate-800 dark:text-slate-200 font-bold mb-1">No active applications</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mb-4">
              Explore opportunities to submit your first application.
            </p>
            <button
              onClick={() => setActiveTab('explore')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95"
            >
              Browse Open Positions
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c111d] shadow-sm">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4.5 w-16 text-center font-extrabold text-slate-500 dark:text-slate-400">S.No</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Applicant Name</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Screening Status</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Interview Mode</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Merit Rank</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Outcome</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Applied On</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Joining</th>
                  <th className="px-6 py-4.5 font-extrabold text-slate-500 dark:text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {applications.map((a, i) => {
                  const isDraft = a.applicationStatus === 'Draft';
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4.5 text-center text-slate-400 font-semibold">{i + 1}</td>
                      <td className="px-6 py-4.5">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{a.fullName || 'Untitled draft'}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5">{a.mobile || 'No contact info'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${isDraft ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                          {isDraft ? 'Draft' : 'Submitted'}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{isDraft ? '—' : screeningLabel(a.screeningResult)}</span>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${a.interviewMode === 'Online' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {a.interviewMode || 'Offline'} Mode
                        </span>
                      </td>
                      <td className="px-6 py-4.5 font-extrabold text-slate-700 dark:text-slate-300">{isDraft ? '—' : (a.meritRank ?? '—')}</td>
                      <td className="px-6 py-4.5">
                        {isDraft ? (
                          <span className="text-slate-400 font-semibold">—</span>
                        ) : (
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${OUTCOME_STYLES[a.outcome] ?? OUTCOME_STYLES.Pending}`}>
                            {CANDIDATE_OUTCOMES[a.outcome] ?? a.outcome}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 font-semibold text-slate-500 dark:text-slate-400">{formatDate(a.appliedAt)}</td>
                      <td className="px-6 py-4.5">
                        {!isDraft && a.outcome === 'Selected' && a.stage === 'OfferIssued' && !a.offerResponse && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAcceptOffer(a.id)}
                              disabled={respondingCandidateId === a.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
                            >
                              <ClipboardCheck size={13} /> Accept Offer
                            </button>
                            <button
                              onClick={() => handleDeclineOffer(a.id)}
                              disabled={respondingCandidateId === a.id}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white disabled:opacity-50 text-rose-700 border border-rose-300 text-xs font-bold rounded-lg transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {!isDraft && a.outcome === 'Selected' && a.stage === 'OfferIssued' && a.offerResponse === 'Accepted' && (
                          <button
                            onClick={() => setJoiningTarget(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
                          >
                            <ClipboardCheck size={13} /> Submit Joining Report
                          </button>
                        )}
                        {!isDraft && a.outcome === 'Selected' && a.stage === 'OfferIssued' && a.offerResponse === 'Declined' && (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800">
                            Offer Declined
                          </span>
                        )}
                        {!isDraft && a.outcome === 'Selected' && JOINING_STAGE_LABELS[a.stage] && (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                            {JOINING_STAGE_LABELS[a.stage]}
                          </span>
                        )}
                        {(isDraft || a.outcome !== 'Selected') && (
                          <span className="text-slate-400 font-semibold">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4.5">
                        {isDraft ? (
                          <button
                            onClick={() => handleContinueDraft(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
                          >
                            <PenLine size={13} /> Continue
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewApplicationCandidateId(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-all active:scale-95"
                            >
                              <Eye size={13} className="text-blue-600 dark:text-blue-400" /> View
                            </button>
                            <button
                              onClick={() => setViewApplicationCandidateId(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-lg transition-all active:scale-95"
                            >
                              <Download size={13} /> Download
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        // --- EXPLORE TAB ---
        openRecruitments.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/20">
            <Briefcase size={40} className="text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-slate-800 dark:text-slate-200 font-bold mb-1">No vacancies advertised</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
              There are currently no open recruitment drives running in the portal.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {openRecruitments.map((rec) => (
              <div key={rec.id} className="p-6 bg-white dark:bg-[#0c111d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div className="space-y-3 w-full ">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full border border-blue-200/20 uppercase">
                      Round {rec.advertisementRound}
                    </span>
                    {rec.closingDate && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <Calendar size={13} />
                        Closes: {formatDate(rec.closingDate)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{rec.designation}</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{rec.projectTitle}</p>
                  </div>
                  {rec.text && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/40">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                        {rec.text}
                      </p>
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col md:flex-row items-center gap-3">
                  <button
                    onClick={() => handlePreviewAdvertisement(rec)}
                    className="w-full md:w-auto px-5 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl shadow-sm transition-colors"
                  >
                    View Advertisement
                  </button>
                  <button
                    onClick={() => handleOpenApply(rec)}
                    className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* --- Application Wizard --- */}
      {wizardTarget && (
        <ApplicationWizard
          recruitmentId={wizardTarget.recruitmentId}
          recruitmentLabel={wizardTarget.recruitmentLabel}
          existingCandidateId={wizardTarget.existingCandidateId ?? null}
          onClose={handleWizardClose}
          onSubmitted={handleWizardSubmitted}
        />
      )}

      <ViewManpowerDocumentModal
        isOpen={!!previewRecruitment}
        onClose={() => setPreviewRecruitment(null)}
        documentTitle="Advertisement"
        documentUrl={previewRecruitment ? `/api/recruitments/${previewRecruitment.id}/documents/Advertisement` : null}
      />

      {joiningTarget && (
        <JoiningReportModal
          application={joiningTarget}
          onClose={() => setJoiningTarget(null)}
          onSubmitted={() => {
            setJoiningTarget(null);
            loadData();
          }}
        />
      )}

      <ViewCandidateApplicationModal
        isOpen={Boolean(viewApplicationCandidateId)}
        candidateId={viewApplicationCandidateId}
        onClose={() => setViewApplicationCandidateId(null)}
      />

    </div>
  );
}
