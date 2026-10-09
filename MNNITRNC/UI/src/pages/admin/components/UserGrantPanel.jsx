import { useCallback, useEffect, useState } from 'react';
import { Trash2, Info, AlertTriangle } from 'lucide-react';
import {
  listUsers, listUserGrants, createUserGrant, deleteUserGrant,
} from '../../../api/adminAccessApi';

/**
 * Exceptions for one person, on top of what their roles give them.
 *
 * Deny beats grant beats role, so a deny here removes a page the user's role
 * grants -- which is the point: revoking one person's access should not mean
 * editing a role and taking it from everyone else who holds it.
 */
export default function UserGrantPanel({ modules }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [grants, setGrants] = useState([]);
  const [pageKey, setPageKey] = useState('');
  const [effect, setEffect] = useState('Grant');
  const [scope, setScope] = useState('Own');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const allPages = modules.flatMap((m) => m.pages.map((p) => ({ ...p, moduleName: m.name })));

  useEffect(() => {
    let active = true;
    listUsers()
      .then((rows) => { if (active) setUsers(rows ?? []); })
      .catch(() => { if (active) setError('Failed to load users.'); });
    return () => { active = false; };
  }, []);

  const loadGrants = useCallback(async (id) => {
    if (!id) {
      setGrants([]);
      return;
    }
    setGrants(await listUserGrants(id) ?? []);
  }, []);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void loadGrants(userId);
  }, [userId, loadGrants]);

  const add = async () => {
    setError(null);
    try {
      await createUserGrant(userId, { pageKey, effect, scope, reason });
      setReason('');
      setPageKey('');
      await loadGrants(userId);
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  const remove = async (key) => {
    setError(null);
    try {
      await deleteUserGrant(userId, key);
      await loadGrants(userId);
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  // The server requires a reason; disabling here explains why rather than
  // letting the save fail.
  const canAdd = userId && pageKey && reason.trim().length >= 3;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Info size={13} className="mt-0.5 shrink-0" />
        Exceptions apply to one person only. A deny overrides what their roles give
        them; a grant adds a page no role of theirs has.
      </p>

      <div>
        <label htmlFor="grant-user" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          Person
        </label>
        <select
          id="grant-user"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
        >
          <option value="">Select a person…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.userName} — {u.fullName}</option>
          ))}
        </select>
      </div>

      {userId && (
        <>
          {grants.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Page</th>
                    <th className="px-4 py-3">Effect</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Set</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grants.map((g) => (
                    <tr key={g.pageKey}>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{g.pageName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          g.effect === 'Deny'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {g.effect}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{g.effect === 'Deny' ? '—' : g.scope}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{g.reason}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(g.grantedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(g.pageKey)}
                          aria-label={`Remove the exception on ${g.pageName}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No exceptions — this person sees exactly what their roles give them.
            </p>
          )}

          <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 space-y-3">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Add an exception</p>

            <div className="flex flex-wrap gap-3">
              <select
                value={pageKey}
                onChange={(e) => setPageKey(e.target.value)}
                aria-label="Page"
                className="flex-1 min-w-[16rem] px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
              >
                <option value="">Select a page…</option>
                {allPages.map((p) => (
                  <option key={p.key} value={p.key}>{p.moduleName} › {p.name}</option>
                ))}
              </select>

              <select
                value={effect}
                onChange={(e) => setEffect(e.target.value)}
                aria-label="Effect"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
              >
                <option value="Grant">Grant</option>
                <option value="Deny">Deny</option>
              </select>

              {effect === 'Grant' && (
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  aria-label="Scope"
                  className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                >
                  <option value="Own">Own</option>
                  <option value="Department">Department</option>
                  <option value="Institute">Institute</option>
                </select>
              )}
            </div>

            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this exception exist? (required)"
              aria-label="Reason"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Required. Exceptions outlive the situation that caused them, and a year
              from now the reason is the only thing that says whether this still applies.
            </p>

            <button
              type="button"
              onClick={add}
              disabled={!canAdd}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold"
            >
              Add exception
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="flex items-center gap-1.5 p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={15} /> {error}
        </p>
      )}
    </div>
  );
}
