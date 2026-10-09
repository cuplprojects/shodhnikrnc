import { useState, useEffect } from 'react';
import { X, UserCog } from 'lucide-react';
import { assignProjectDa, getDaAssignmentHistory } from '../../../api/projectsApi';
import { listDealingAssistantOptions } from '../../../api/proposalsApi';

/**
 * Assign or reassign a project's permanent Dealing Assistant
 * (RegularStaff-role user). Superintendent/Dean only for the write action;
 * anyone who can already see the project can view the read-only history.
 */
export default function DaAssignmentModal({ project, isOpen, onClose, onUpdated, canAssign }) {
  const [options, setOptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = async () => {
    if (!project?.id) return;
    try {
      const data = await getDaAssignmentHistory(project.id);
      setHistory(data ?? []);
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadHistory();
    if (canAssign) {
      listDealingAssistantOptions().then(setOptions).catch(() => setOptions([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, project?.id, canAssign]);

  if (!isOpen || !project) return null;

  const currentDaName = history[0]?.toUserName ?? 'Not yet assigned';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !reason.trim()) {
      setError('Please select a Dealing Assistant and provide a reason.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await assignProjectDa(project.id, { newDaUserId: selectedUserId, reason: reason.trim() });
      setSelectedUserId('');
      setReason('');
      await loadHistory();
      onUpdated?.();
    } catch (err) {
      setError(err?.message || 'Failed to assign Dealing Assistant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog size={18} /> Dealing Assistant
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            Current DA: <span className="font-bold">{currentDaName}</span>
          </div>

          {canAssign && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Assign / Reassign to *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Select a Dealing Assistant...</option>
                  {options.map((o) => (
                    <option key={o.userId} value={o.userId}>{o.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white"
                  placeholder="e.g. Original DA on leave"
                />
              </div>
              {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                {isSubmitting ? 'Saving…' : 'Save Assignment'}
              </button>
            </form>
          )}

          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">History</p>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No assignments yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {h.fromUserName ?? '(none)'} → {h.toUserName}
                      </span>
                      <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">{h.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
