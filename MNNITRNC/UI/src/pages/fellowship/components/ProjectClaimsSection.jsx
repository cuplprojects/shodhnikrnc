import { useCallback, useEffect, useState } from 'react';
import { Wallet, Download, Info, FileText } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import {
  listClaimsForProject, downloadStipendForm, recommendAmount,
} from '../../../api/fellowshipApi';
import { MONTHS, LEAVE_REPORTING_NOTE } from '../../../constants/fellowshipEnums';
import { WORKFLOW_STAGE_LABELS } from '../../../constants/procurementEnums';
import { formatCurrency } from '../../projects/utils/currency';
import HraOverrideModal from './HraOverrideModal';
import StipendFormModal from './StipendFormModal';
import ProcessClaimModal from './ProcessClaimModal';

const monthLabel = (m) => MONTHS.find((x) => x.value === m)?.label ?? m;

/**
 * The PI's view of fellowship claims on their project.
 *
 * The recommended amount is a free entry, not derived from the leave figures
 * beside it -- the portal reports absence and a human decides what to pay.
 */
export default function ProjectClaimsSection({ projectId, project, userRoles }) {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overriding, setOverriding] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [viewingFormClaimId, setViewingFormClaimId] = useState(null);
  const [recommendingClaim, setRecommendingClaim] = useState(null);
  const [activeStipendClaim, setActiveStipendClaim] = useState(null);
  const [toastMessage, setToastMessage] = useState({ text: "", error: false });

  const showToast = (text, error = false) => {
    setToastMessage({ text, error });
    setTimeout(() => setToastMessage({ text: "", error: false }), 5000);
  };

  const roles = user?.roles ?? userRoles ?? [];
  const canOverride = roles.includes('Dean') || roles.includes('Director');

  const effectiveProjectId = projectId ?? project?.id;

  const load = useCallback(async () => {
    setClaims(await listClaimsForProject(effectiveProjectId) ?? []);
  }, [effectiveProjectId]);

  useEffect(() => {
    let active = true;
    // Flagged by the lint rule because these end in setState, but every
    // write happens in a promise callback after an await -- not
    // synchronously during the effect, which is what causes cascading
    // renders.
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
      .catch(() => { if (active) setError('Failed to load fellowship claims.'); })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
  }, [load]);

  const submitRecommendation = async (claimId) => {
    const value = drafts[claimId];
    if (value === undefined || value === '') return;

    setError(null);
    try {
      await recommendAmount(claimId, {
        recommendedAmount: Number(value),
        remarks: null,
      });
      setDrafts((d) => ({ ...d, [claimId]: undefined }));
      await load();
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading claims…</div>;
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Toast */}
      {toastMessage.text && (
        <div className={`fixed bottom-5 right-5 z-[100000] px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce ${toastMessage.error ? "bg-red-600" : "bg-emerald-600"} text-white`}>
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {claims.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Wallet size={32} className="text-slate-400 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            No fellowship claims raised on this project yet.
          </p>
        </div>
      ) : (
        <>
          <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info size={13} className="mt-0.5 shrink-0" />
            {LEAVE_REPORTING_NOTE}
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Leave / absence</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Recommended</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {monthLabel(c.claimMonth)} {c.claimYear}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(c.totalAmount)}
                      {c.hraIsOverridden && (
                        <span title={c.hraOverrideReason ?? 'Overridden'}
                          className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          HRA overridden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                      {c.leaveDaysTakenThisMonth} / {c.unauthorisedAbsenceDays}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800">
                        {WORKFLOW_STAGE_LABELS[c.currentStage] ?? c.currentStage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.recommendedAmount != null ? (
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(c.recommendedAmount)}
                        </span>
                      ) : c.currentStage === 'PIReview' ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setRecommendingClaim(c)}
                            className="px-3 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50">
                            Recommend Form
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canOverride && (
                        <button type="button" onClick={() => setOverriding(c)}
                          className="px-2 py-1 mr-1 text-xs font-semibold rounded border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                          Override HRA
                        </button>
                      )}
                      <button type="button" onClick={() => setActiveStipendClaim(c)}
                        title="View / Upload Stipend Form"
                        className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded">
                        <FileText size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {overriding && (
        <HraOverrideModal
          claim={overriding}
          onClose={() => setOverriding(null)}
          onSaved={() => { void load(); }}
        />
      )}

      {activeStipendClaim && (
        <StipendFormModal
          claim={activeStipendClaim}
          onClose={() => setActiveStipendClaim(null)}
          canUpload={true} // PI can upload from here
          showToast={showToast}
        />
      )}
      {recommendingClaim && (
        <ProcessClaimModal
          claim={recommendingClaim}
          isHOD={false}
          initialAmount={drafts[recommendingClaim.id] ?? recommendingClaim.totalAmount}
          onClose={() => setRecommendingClaim(null)}
          onProcessed={() => {
            void load();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
