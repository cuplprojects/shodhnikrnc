import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, Plus, Lock, Trash2, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  listRoles, createRole, deleteRole, getRoleAccess, updateRoleAccess,
} from '../../api/adminAccessApi';
import { useAccess } from '../../access/useAccess';
import PermissionTree from './components/PermissionTree';
import UserGrantPanel from './components/UserGrantPanel';

/**
 * Roles, what each may open, and per-person exceptions.
 *
 * Changes take effect on the next request -- the engine reads these rows rather
 * than a compiled-in role list -- so the page says so rather than leaving it to
 * be discovered.
 */
export default function ManageRolesPage() {
  const { reload: reloadMyAccess } = useAccess();

  const [roles, setRoles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [access, setAccess] = useState(null);
  const [granted, setGranted] = useState({});
  const [newRoleName, setNewRoleName] = useState('');
  const [tab, setTab] = useState('roles');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoles = useCallback(async () => {
    setRoles(await listRoles() ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    loadRoles()
      .catch(() => { if (active) setError('Failed to load roles.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [loadRoles]);

  const loadAccess = useCallback(async (roleId) => {
    const result = await getRoleAccess(roleId);
    setAccess(result);
    setGranted(Object.fromEntries(
      result.modules.flatMap((m) => m.pages)
        .filter((p) => p.isGranted)
        .map((p) => [p.key, p.scope]),
    ));
  }, []);

  const select = async (roleId) => {
    setSelectedId(roleId);
    setSaved(false);
    setError(null);
    try {
      await loadAccess(roleId);
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  // Scope travels with the grant, so toggling a page on has to give it one.
  const toggle = (pageKey, on) => {
    setSaved(false);
    setGranted((g) => {
      const next = { ...g };
      if (on) next[pageKey] = next[pageKey] ?? 'Own';
      else delete next[pageKey];
      return next;
    });
  };

  const toggleModule = (moduleKey, on) => {
    const module = access.modules.find((m) => m.key === moduleKey);
    setSaved(false);
    setGranted((g) => {
      const next = { ...g };
      for (const page of module.pages) {
        if (on) next[page.key] = next[page.key] ?? page.scope ?? 'Own';
        else delete next[page.key];
      }
      return next;
    });
  };

  const setScope = (pageKey, scope) => {
    setSaved(false);
    setGranted((g) => ({ ...g, [pageKey]: scope }));
  };

  const save = async () => {
    setError(null);
    try {
      await updateRoleAccess(selectedId, Object.entries(granted).map(([pageKey, scope]) => ({ pageKey, scope })));
      setSaved(true);
      await loadAccess(selectedId);
      // The signed-in admin may have just changed their own access.
      reloadMyAccess();
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  const addRole = async () => {
    setError(null);
    try {
      await createRole(newRoleName.trim());
      setNewRoleName('');
      await loadRoles();
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  const removeRole = async (role) => {
    setError(null);
    try {
      await deleteRole(role.id);
      if (selectedId === role.id) {
        setSelectedId(null);
        setAccess(null);
      }
      await loadRoles();
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  // Marked on each page for the tree, which needs the current scope per page.
  const modulesWithScope = useMemo(
    () => access?.modules.map((m) => ({
      ...m,
      pages: m.pages.map((p) => ({ ...p, scope: granted[p.key] ?? p.scope })),
    })) ?? [],
    [access, granted],
  );

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Roles &amp; Access</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Which pages each role may open, and who may see whose data.
        </p>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300/90 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20">
        <Info size={14} className="mt-0.5 shrink-0" />
        Changes take effect on the next request. There is no deployment step.
      </p>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[['roles', 'Role permissions'], ['users', 'Per-person exceptions']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {tab === 'users' ? (
        <UserGrantPanel modules={access?.modules ?? modulesWithScope} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6">
          <div className="space-y-3">
            <div className="space-y-1">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className={`flex items-center gap-2 rounded-lg border transition-colors ${
                    selectedId === role.id
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => select(role.id)}
                    className="flex-1 text-left px-3 py-2.5"
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                      {role.name}
                      {role.isProtected && (
                        <Lock size={12} className="text-slate-400" title="Built in — cannot be renamed or deleted" />
                      )}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {role.userCount} {role.userCount === 1 ? 'person' : 'people'}
                    </span>
                  </button>
                  {!role.isProtected && (
                    <button
                      type="button"
                      onClick={() => removeRole(role)}
                      aria-label={`Delete ${role.name}`}
                      className="p-2 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-1.5">
              <input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="New role name"
                aria-label="New role name"
                className="flex-1 min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
              />
              <button
                type="button"
                onClick={addRole}
                disabled={newRoleName.trim().length < 2}
                aria-label="Create role"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg"
              >
                <Plus size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Built-in roles cannot be renamed or deleted: approval routes refer to them
              by name, so a rename would silently break every stage that grants them.
            </p>
          </div>

          <div>
            {access ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {access.roleName}
                  </h2>
                  <div className="flex items-center gap-2">
                    {saved && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={15} /> Saved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={save}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                    >
                      Save permissions
                    </button>
                  </div>
                </div>

                <PermissionTree
                  modules={modulesWithScope}
                  granted={granted}
                  onToggle={toggle}
                  onToggleModule={toggleModule}
                  onScope={setScope}
                />
              </div>
            ) : (
              <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <Shield size={32} className="text-slate-400 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Select a role to see and change what it may open.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
