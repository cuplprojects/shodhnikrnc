
import { useState, useEffect } from 'react';
import { X, History, PlusCircle } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { reappropriateBudget, getReappropriationHistory } from '../../../api/projectsApi';
import { ApiError } from '../../../api/apiClient';
import ReappropriationForm from './ReappropriationForm';
import ReappropriationWorkflowModal from './ReappropriationWorkflowModal';


export default function ReappropriationHistoryModal({ project, isOpen, onClose, onUpdated, reappropriationSummary, budgetLines, isProjectApproved = true }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [error, setError] = useState(null);

  const loadLogs = async () => {
    if (!project?.id) return;
    setIsLoading(true);
    try {
      const data = await getReappropriationHistory(project.id);
      setLogs(data ?? []);
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadLogs();
    }
  }, [isOpen, project?.id]);

  if (!isOpen || !project) return null;

  const budgetHeads = project.budgetHeads ?? [];

  const effectiveReceivedByHeadName = {};
  (budgetLines ?? []).forEach((line) => {
    effectiveReceivedByHeadName[line.headName] =
      (effectiveReceivedByHeadName[line.headName] ?? 0) + (line.grantReceived || 0);
  });
  (reappropriationSummary ?? []).forEach((r) => {
    effectiveReceivedByHeadName[r.headName] =
      (effectiveReceivedByHeadName[r.headName] ?? 0) + (r.netReappropriated || 0);
  });

  const handleSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await reappropriateBudget(project.id, data);
      setShowAddForm(false);
      await loadLogs();
      onUpdated?.();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setError('Reappropriation request failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <History size={22} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Budget Reappropriation
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Raise requests & view history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300 text-sm font-semibold">
              {error}
            </div>
          )}

          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <PlusCircle size={16} />
              {showAddForm ? 'Hide Form' : 'Raise Reappropriation Request'}
            </button>
          </div>

          {showAddForm && (
            <ReappropriationForm
              budgetHeads={budgetHeads}
              effectiveReceivedByHeadName={effectiveReceivedByHeadName}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {!showAddForm && (
            isLoading ? (
              <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading history logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No reappropriation requests recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {logs.map((log) => {
                    const sources = log.sourceLines || log.sources || [];
                    const destinations = log.destinationLines || log.destinations || [];
                    const total = sources.reduce((s, x) => s + x.amount, 0) || 0;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap align-top">
                          {new Date(log.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap align-top">
                          <span className={`px-2 py-1 rounded font-bold ${log.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : log.status === 'Rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium align-top">
                          <div className="flex flex-col gap-1 text-xs">
                            {sources.map((s, i) => (
                              <div key={`s-${i}`} className="text-rose-600 dark:text-rose-400">
                                - {formatCurrency(s.amount)} from {s.headName}
                              </div>
                            ))}
                            {destinations.map((d, i) => (
                              <div key={`d-${i}`} className="text-emerald-600 dark:text-emerald-400">
                                + {formatCurrency(d.amount)} to {d.headName}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap align-top">
                          {formatCurrency(total)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 align-top">
                          {log.reason}
                        </td>
                        <td className="px-4 py-3 text-xs align-top">
                          {log.workflowInstanceId && (
                            <button
                              onClick={() => setSelectedReq({ ...log, sources, destinations })}
                              className="px-3 py-1.5 font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors whitespace-nowrap"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>

      </div>

      <ReappropriationWorkflowModal
        req={selectedReq}
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        onUpdated={() => {
          setSelectedReq(null);
          void loadLogs();
          onUpdated?.();
        }}
      />
    </div>
  );
}
