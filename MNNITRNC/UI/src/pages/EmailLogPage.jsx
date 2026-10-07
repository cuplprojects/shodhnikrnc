import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../layout/useTheme';
import { listEmailLog, resendEmail } from '../api/emailLogApi';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

export default function EmailLogPage() {
  useTheme();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'failed' | 'succeeded'
  const [isLoading, setIsLoading] = useState(true);
  const [resendingId, setResendingId] = useState(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const succeeded = filter === 'all' ? undefined : filter === 'succeeded';
      const data = await listEmailLog(succeeded);
      setLogs(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleResend = async (id) => {
    setResendingId(id);
    try {
      await resendEmail(id);
      await loadLogs();
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Email Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Every approval-notification send attempt.</p>
      </div>

      <div className="flex gap-2">
        {['all', 'failed', 'succeeded'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold capitalize ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">No emails logged.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800/50 text-left">
              <tr>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Status</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">To</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Subject</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Template</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Sent</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-3">
                    {l.succeeded ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"><CheckCircle2 size={14} />Sent</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold" title={l.errorMessage}><XCircle size={14} />Failed</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{l.toAddress}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{l.subject}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{l.templateKey}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{new Date(l.sentAt).toLocaleString('en-IN')}</td>
                  <td className="p-3">
                    {!l.succeeded && (
                      <button
                        type="button"
                        disabled={resendingId === l.id}
                        onClick={() => handleResend(l.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60"
                      >
                        <RotateCcw size={14} />{resendingId === l.id ? 'Resending...' : 'Resend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
