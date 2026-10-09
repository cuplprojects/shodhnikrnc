import { useEffect, useState } from 'react';
import { Building2, Plus, Pencil, Check, X } from 'lucide-react';
import {
  listAllDepartments,
  createDepartment,
  updateDepartment,
} from '../api/departmentsApi';

const FIELD_CLASS =
  'px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm';

export default function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsInstituteWide, setNewIsInstituteWide] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingCode, setEditingCode] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingIsInstituteWide, setEditingIsInstituteWide] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    listAllDepartments()
      .then((data) => setDepartments(data ?? []))
      .catch(() => setError('Failed to load departments.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isCreating || !newCode.trim() || !newName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      await createDepartment(newCode.trim(), newName.trim(), newIsInstituteWide);
      setNewCode('');
      setNewName('');
      setNewIsInstituteWide(false);
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (department) => {
    setEditingId(department.id);
    setEditingCode(department.code);
    setEditingName(department.name);
    setEditingIsInstituteWide(department.isInstituteWide);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingCode('');
    setEditingName('');
    setEditingIsInstituteWide(false);
  };

  const saveEditing = async (department) => {
    if (isSaving || !editingCode.trim() || !editingName.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await updateDepartment(
        department.id, editingCode.trim(), editingName.trim(),
        department.headUserId, editingIsInstituteWide, department.isActive);
      cancelEditing();
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (department) => {
    setError(null);
    try {
      await updateDepartment(
        department.id, department.code, department.name,
        department.headUserId, department.isInstituteWide, !department.isActive);
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building2 size={20} className="text-slate-500 dark:text-slate-400" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Manage Departments</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Departments scope who sees what across the portal (HOD queues, department-wide visibility).
        Deactivating one hides it from dropdowns without affecting anyone already assigned to it.
      </p>

      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Code, e.g. CSED"
          className={`${FIELD_CLASS} sm:w-32`}
          aria-label="New department code"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name, e.g. Computer Science & Engineering"
          className={`${FIELD_CLASS} flex-1`}
          aria-label="New department name"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
          <input type="checkbox" checked={newIsInstituteWide}
            onChange={(e) => setNewIsInstituteWide(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
          Institute-wide
        </label>
        <button
          type="submit"
          disabled={isCreating || !newCode.trim() || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg text-sm shrink-0"
        >
          <Plus size={16} /> Add
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : departments.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No departments yet.</p>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
          {departments.map((department) => (
            <div key={department.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900">
              {editingId === department.id ? (
                <>
                  <div className="flex flex-1 flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editingCode}
                      onChange={(e) => setEditingCode(e.target.value)}
                      className={`${FIELD_CLASS} sm:w-28`}
                      aria-label={`Edit code for ${department.name}`}
                    />
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={`${FIELD_CLASS} flex-1`}
                      aria-label={`Edit name for ${department.name}`}
                      autoFocus
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <input type="checkbox" checked={editingIsInstituteWide}
                        onChange={(e) => setEditingIsInstituteWide(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      Institute-wide
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => saveEditing(department)}
                      disabled={isSaving || !editingCode.trim() || !editingName.trim()}
                      aria-label="Save"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg disabled:opacity-50"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      aria-label="Cancel"
                      className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {department.code}
                    </span>
                    <span className={`text-sm font-medium ${department.isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                      {department.name}
                    </span>
                    {department.isInstituteWide && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        Institute-wide
                      </span>
                    )}
                    {!department.isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditing(department)}
                      aria-label={`Edit ${department.name}`}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(department)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {department.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
