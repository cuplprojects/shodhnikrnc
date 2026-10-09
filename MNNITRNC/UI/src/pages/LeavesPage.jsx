import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Info } from 'lucide-react';
import { listMyLeaveRequests, getMyLeaveBalance, withdrawLeaveRequest } from '../api/fellowshipApi';
import { LEAVE_TYPES, ID_CARD_GATE_NOTE, PENDING_LEAVE_NOTE } from '../constants/fellowshipEnums';
import { WORKFLOW_STAGE_LABELS } from '../constants/procurementEnums';
import RaiseLeaveModal from './fellowship/components/RaiseLeaveModal';
import WithdrawLeaveModal from './fellowship/components/WithdrawLeaveModal';
import CancelLeaveModal from './fellowship/components/CancelLeaveModal';
import DocumentUploader from '../components/DocumentUploader';

const STAGE_STYLES = {
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  Rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  Raised: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  PI: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
};

const DEFAULT_STAGE_STYLE =
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

const typeLabel = (v) => LEAVE_TYPES.find((t) => t.value === v)?.label ?? v;

function LeaveDatesDisplay({ dates = [] }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!dates || dates.length === 0) return <span>—</span>;
  
  // Sort dates so they appear chronological
  const sortedDates = [...dates].sort((a, b) => new Date(a) - new Date(b));
  
  const formattedDates = sortedDates.map(d => formatDate(d));
  
  if (formattedDates.length <= 3) {
    return <span>{formattedDates.join(', ')}</span>;
  }
  
  if (expanded) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="whitespace-pre-wrap">{formattedDates.join(', ')}</span>
        <button 
          onClick={() => setExpanded(false)}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          View less
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-start gap-1">
      <span>{formattedDates.slice(0, 3).join(', ')}...</span>
      <button 
        onClick={() => setExpanded(true)}
        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
      >
        +{formattedDates.length - 3} more
      </button>
    </div>
  );
}

export default function LeavesPage() {
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [withdrawRequestId, setWithdrawRequestId] = useState(null);
  const [cancelRequest, setCancelRequest] = useState(null);

  const load = useCallback(async () => {
    const [rows, bal] = await Promise.all([listMyLeaveRequests(), getMyLeaveBalance()]);
    setRequests(rows ?? []);
    setBalances(bal ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    // Flagged by the lint rule because these end in setState, but every
    // write happens in a promise callback after an await -- not
    // synchronously during the effect, which is what causes cascading
    // renders.
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
      .catch((err) => { if (active) setError(err.message ?? 'Failed to load your leave.'); })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
  }, [load]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-2xl">
            <CalendarDays size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Leave</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Your leave requests and remaining balance.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/20"
        >
          Apply for leave
        </button>
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
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {balances.map((b) => (
              <div key={b.leaveType}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {typeLabel(b.leaveType)}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {b.remainingDays}
                  <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    of {b.entitledDays} days left
                  </span>
                </p>
                <dl className="mt-3 grid grid-cols-1 md:grid-cols- gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Approved</dt>
                    <dd className="font-semibold tabular-nums">{b.consumedDays}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Awaiting approval</dt>
                    <dd className="font-semibold tabular-nums">{b.pendingDays}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info size={13} className="mt-0.5 shrink-0" />
            {PENDING_LEAVE_NOTE}
          </p>

          {requests.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <CalendarDays size={32} className="text-slate-400 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                You have not applied for any leave yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-4">Type</th>
                      <th className="px-5 py-4">Leave Dates</th>
                      <th className="px-5 py-4">Out-of-Station Dates</th>
                      <th className="px-5 py-4 text-center">Days</th>
                    <th className="px-5 py-4">Purpose</th>
                    <th className="px-5 py-4">Documents</th>
                    <th className="px-5 py-4">Stage</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-100 flex flex-col gap-1">
                        <span>
                          {r.leaveType === 'Special' || r.leaveType === 1 ? 'Special Leave (conference)' : 'Casual Leave'}
                        </span>
                        {r.isCancellation && (
                          <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded w-fit uppercase font-bold tracking-wider">
                            Cancellation
                          </span>
                        )}
                      </td>
                        <td className="px-5 py-4 min-w-[200px]">
                          <LeaveDatesDisplay dates={r.dates} />
                        </td>
                        <td className="px-5 py-4 min-w-[200px]">
                          {r.outOfStationDates && r.outOfStationDates.length > 0 ? (
                            <LeaveDatesDisplay dates={r.outOfStationDates} />
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center tabular-nums">{r.dayCount}</td>
                      <td className="px-5 py-4">{r.purpose ?? '—'}</td>
                      <td className="px-5 py-4 min-w-[200px]">
                        <DocumentUploader
                          ownerType="LeaveRequest"
                          ownerId={r.id}
                          requestType="LeaveRequest"
                          phase="Indent"
                          readOnly={true}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${
                          STAGE_STYLES[r.currentStage] ?? DEFAULT_STAGE_STYLE}`}>
                          {WORKFLOW_STAGE_LABELS[r.currentStage] ?? r.currentStage}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {r.currentStage !== 'Approved' && r.currentStage !== 'Rejected' && r.currentStage !== 'Cancelled' && !r.isCancellation && (
                          <button
                            onClick={() => setWithdrawRequestId(r.id)}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Withdraw
                          </button>
                        )}
                        {r.currentStage === 'Approved' && r.dates && r.dates.length > 0 && !r.hasPendingCancellation && !r.isCancellation && (
                          <button
                            onClick={() => setCancelRequest(r)}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                          >
                            Cancel Leave
                          </button>
                        )}
                        {r.hasPendingCancellation && (
                          <span className="text-[11px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                            Cancellation Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <RaiseLeaveModal
          balances={balances}
          onClose={() => setIsModalOpen(false)}
          onRaised={() => { void load(); }}
        />
      )}

      {withdrawRequestId && (
        <WithdrawLeaveModal
          requestId={withdrawRequestId}
          onClose={() => setWithdrawRequestId(null)}
          onWithdrawn={() => {
            setWithdrawRequestId(null);
            void load();
          }}
        />
      )}

      {cancelRequest && (
        <CancelLeaveModal
          request={cancelRequest}
          onClose={() => setCancelRequest(null)}
          onCancelled={() => {
            setCancelRequest(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
