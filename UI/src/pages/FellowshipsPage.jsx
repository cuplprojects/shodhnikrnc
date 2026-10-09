import { useCallback, useEffect, useState } from 'react';
import { Wallet, Download, Info, Edit2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { listMyClaims, downloadStipendForm, editRejectedClaim } from '../api/fellowshipApi';
import { MONTHS, ID_CARD_GATE_NOTE } from '../constants/fellowshipEnums';
import { WORKFLOW_STAGE_LABELS } from '../constants/procurementEnums';
import { formatCurrency } from './projects/utils/currency';
import RaiseClaimFormUI from './fellowship/components/RaiseClaimFormUI';
import EditClaimModal from './fellowship/components/EditClaimModal';
import StipendFormModal from './fellowship/components/StipendFormModal';

const STAGE_STYLES = {
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  Rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  Raised: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  WithPIFellowship: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  WithHODFellowship: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
  WithDAFellowship: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 dark:border-fuchsia-800',
  WithSuperintendentFellowship: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  WithDRFellowship: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800',
  WithDeanFellowship: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
  ReturnedByHODToPI: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  ReturnedByDAToPI: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  ReturnedBySuperintendentToPI: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  ReturnedByDRToPI: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  ReturnedByDeanToPI: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
};

const DEFAULT_STAGE_STYLE =
  'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

const monthLabel = (m) => MONTHS.find((x) => x.value === m)?.label ?? m;

export default function FellowshipsPage() {
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArrearsModalOpen, setIsArrearsModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);
  const [activeStipendClaim, setActiveStipendClaim] = useState(null);
  const [toastMessage, setToastMessage] = useState({ text: "", error: false });

  const showToast = (text, error = false) => {
    setToastMessage({ text, error });
    setTimeout(() => setToastMessage({ text: "", error: false }), 5000);
  };

  const load = useCallback(async () => {
    setClaims(await listMyClaims() ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    // Flagged by the lint rule because these end in setState, but every
    // write happens in a promise callback after an await -- not
    // synchronously during the effect, which is what causes cascading
    // renders.
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
      .catch((err) => {
        if (active) {
          // The ID card gate returns 403 with an explanatory message; showing it
          // is more useful than a generic failure.
          setError(err.message ?? 'Failed to load your fellowship claims.');
        }
      })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
  }, [load]);

  const stipend = claims[0]?.fellowshipAmount ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Toast */}
      {toastMessage.text && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce ${toastMessage.error ? "bg-red-600" : "bg-emerald-600"} text-white`}>
          {toastMessage.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Fellowship</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Your monthly fellowship claims.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsArrearsModalOpen(true)}
            className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
          >
            Raise Arrears
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/20"
          >
            Claim this month
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{error}</p>
          <p className="flex items-start gap-1.5 mt-2 text-xs text-amber-800 dark:text-amber-300/90">
            <Info size={13} className="mt-0.5 shrink-0" />
            {ID_CARD_GATE_NOTE}
          </p>
        </div>
      ) : isLoading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Wallet size={32} className="text-slate-400 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            You have not claimed any fellowship yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-5 py-4">Period</th>
                <th className="px-5 py-4 text-right">Fellowship</th>
                <th className="px-5 py-4 text-right">HRA</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-5 py-4 text-center">Leave / absence</th>
                <th className="px-5 py-4">Stage</th>
                <th className="px-5 py-4">Claims</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">
                    <div>{monthLabel(c.claimMonth)} {c.claimYear}</div>
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums">{formatCurrency(c.fellowshipAmount)}</td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {formatCurrency(c.hraAmount)}
                    {c.hraIsOverridden && (
                      <span title={c.hraOverrideReason ?? 'Overridden'}
                        className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        overridden
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(c.totalAmount)}
                  </td>
                  <td className="px-5 py-4 text-center text-slate-500 dark:text-slate-400">
                    {c.leaveDaysTakenThisMonth} / {c.unauthorisedAbsenceDays}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${
                      STAGE_STYLES[c.currentStage] ?? DEFAULT_STAGE_STYLE}`}>
                      {WORKFLOW_STAGE_LABELS[c.currentStage] ?? c.currentStage}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs border ${
                      c.claimType === 'Raise Arrears'
                        ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                    }`}>
                      {c.claimType || 'Claim for Month'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                    {c.currentStage === 'Rejected' ? (
                      <button
                        type="button"
                        onClick={() => setEditingClaim(c)}
                        title="Edit and resubmit this rejected claim"
                        className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Edit2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveStipendClaim(c)}
                        title="View / Upload Stipend Form"
                        className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg transition-colors"
                      >
                        <FileText size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <RaiseClaimFormUI
          onClose={() => setIsModalOpen(false)}
          onRaised={() => { void load(); }}
          showToast={showToast}
        />
      )}

      {isArrearsModalOpen && (
        <RaiseClaimFormUI
          isArrears={true}
          onClose={() => setIsArrearsModalOpen(false)}
          onRaised={() => { void load(); }}
          showToast={showToast}
        />
      )}

      {editingClaim && (
        <RaiseClaimFormUI
          claimToEdit={editingClaim}
          onClose={() => setEditingClaim(null)}
          onRaised={() => { void load(); }}
          showToast={showToast}
        />
      )}

      {activeStipendClaim && (
        <StipendFormModal
          claim={activeStipendClaim}
          onClose={() => setActiveStipendClaim(null)}
          canUpload={true} // Fellow can always upload to their own claims here
          showToast={showToast}
        />
      )}
    </div>
  );
}
