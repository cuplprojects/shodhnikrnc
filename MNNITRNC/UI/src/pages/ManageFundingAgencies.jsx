import { useEffect, useState } from 'react';
import { Landmark, Plus, Pencil, Check, X } from 'lucide-react';
import {
  listAllFundingAgencies,
  createFundingAgency,
  updateFundingAgency,
} from '../api/fundingAgenciesApi';

const FIELD_CLASS =
  'px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm';

export default function ManageFundingAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setIsLoading(true);
    listAllFundingAgencies()
      .then((data) => setAgencies(data ?? []))
      .catch(() => setError('Failed to load funding agencies.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isCreating || !newName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      await createFundingAgency(newName.trim());
      setNewName('');
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (agency) => {
    setEditingId(agency.id);
    setEditingName(agency.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = async (agency) => {
    if (isSaving || !editingName.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await updateFundingAgency(agency.id, editingName.trim(), agency.isActive);
      cancelEditing();
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (agency) => {
    setError(null);
    try {
      await updateFundingAgency(agency.id, agency.name, !agency.isActive);
      load();
    } catch (err) {
      // Error is shown via the global toast notification
    }
  };

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Landmark size={20} className="text-slate-500 dark:text-slate-400" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Manage Funding Agencies</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This list backs the Funding Agency dropdown on the New Proposal form. Deactivating an
        agency removes it from that dropdown without affecting proposals that already used it.
      </p>

      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. DST, SERB, AICTE"
          className={`${FIELD_CLASS} flex-1`}
          aria-label="New funding agency name"
        />
        <button
          type="submit"
          disabled={isCreating || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg text-sm"
        >
          <Plus size={16} /> Add
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : agencies.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No funding agencies yet.</p>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
          {agencies.map((agency) => (
            <div key={agency.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900">
              {editingId === agency.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className={`${FIELD_CLASS} flex-1`}
                    aria-label={`Edit name for ${agency.name}`}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => saveEditing(agency)}
                      disabled={isSaving || !editingName.trim()}
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
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${agency.isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                      {agency.name}
                    </span>
                    {!agency.isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(agency)}
                      aria-label={`Edit ${agency.name}`}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(agency)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {agency.isActive ? 'Deactivate' : 'Activate'}
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
