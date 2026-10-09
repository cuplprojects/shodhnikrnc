import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { listUsers, setEmployeeId } from '../../api/adminUsersApi';

/**
 * Every account, with its Employee ID -- the identifier the approval
 * timeline displays alongside a user's name (see formatActor.js). Minimal by
 * design: a flat list with one inline-editable field, not a full user-admin
 * surface.
 */
export default function ManageUsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data ?? []);
    } catch {
      setError('Failed to load users.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    load()
      .catch(() => { if (active) setError('Failed to load users.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [load]);

  const startEdit = (user) => {
    setError(null);
    setEditingId(user.id);
    setEditValue(user.employeeId ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (userId) => {
    setError(null);
    try {
      await setEmployeeId(userId, editValue.trim() || null);
      setEditingId(null);
      await load();
    } catch {
      setError('Failed to save Employee ID.');
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">User Management</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          View every account and set its Employee ID.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
              <th className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
              <th className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-300">Email</th>
              <th className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-300">Employee ID</th>
              <th className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-300">Active</th>
              <th className="py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{u.fullName}</td>
                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                <td className="py-2 px-3">
                  {editingId === u.id ? (
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      aria-label={`Employee ID for ${u.fullName}`}
                      className="w-32 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  ) : (
                    u.employeeId || <span className="text-slate-400 dark:text-slate-500 italic">not set</span>
                  )}
                </td>
                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{u.isActive ? 'Yes' : 'No'}</td>
                <td className="py-2 px-3 text-right">
                  {editingId === u.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(u.id)}
                        aria-label={`Save Employee ID for ${u.fullName}`}
                        className="p-1.5 text-emerald-600 hover:text-emerald-700"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                        className="p-1.5 text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      aria-label={`Edit Employee ID for ${u.fullName}`}
                      className="p-1.5 text-blue-600 hover:text-blue-700"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
