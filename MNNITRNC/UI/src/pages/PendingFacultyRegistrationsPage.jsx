import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../layout/useTheme';
import {
  listPendingFacultyRegistrations,
  approveFacultyRegistration,
  rejectFacultyRegistration,
} from '../api/facultyRegistrationApi';
import { CheckCircle2, XCircle, Building2, Calendar, Mail } from 'lucide-react';

export default function PendingFacultyRegistrationsPage() {
  useTheme();
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [confirmReject, setConfirmReject] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listPendingFacultyRegistrations();
      setRegistrations(Array.isArray(data) ? data : []);
    } catch {
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleApprove = async (userId) => {
    setActioningId(userId);
    try {
      await approveFacultyRegistration(userId);
      setToastMessage('Registration approved.');
      await loadQueue();
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (userId) => {
    setActioningId(userId);
    try {
      await rejectFacultyRegistration(userId);
      setToastMessage('Registration rejected.');
      setConfirmReject(null);
      await loadQueue();
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Pending Faculty Registrations</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review self-registered PI accounts awaiting approval.
        </p>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {toastMessage}
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      ) : registrations.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">No pending registrations.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800/50 text-left">
              <tr>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Name</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Email</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Department</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Registered</th>
                <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.userId} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">{r.fullName}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><Mail size={14} />{r.email}</span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><Building2 size={14} />{r.department ?? '—'}</span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} />{new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actioningId === r.userId}
                        onClick={() => handleApprove(r.userId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
                      >
                        <CheckCircle2 size={14} />Approve
                      </button>
                      <button
                        type="button"
                        disabled={actioningId === r.userId}
                        onClick={() => setConfirmReject(r.userId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-60"
                      >
                        <XCircle size={14} />Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Reject this registration?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The account will be deactivated and cannot sign in until reactivated.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmReject(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReject(confirmReject)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
