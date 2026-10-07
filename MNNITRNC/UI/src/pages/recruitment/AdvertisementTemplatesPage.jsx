import { useEffect, useState } from 'react';
import { FileText, Copy, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import {
  listAdvertisementTemplates,
  cloneAdvertisementTemplate,
  deleteAdvertisementTemplate,
} from '../../api/advertisementTemplatesApi';
import AdvertisementTemplateEditor from './components/AdvertisementTemplateEditor';

/**
 * A PI's reusable advertisement wording: the shared system default plus any
 * templates the PI has cloned/edited of their own. Backed by
 * AdvertisementTemplatesController (Task 3) -- list returns the caller's own
 * templates plus the system default, ordered by the server.
 */
export default function AdvertisementTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setIsLoading(true);
    setError(null);
    listAdvertisementTemplates()
      .then((data) => setTemplates(data ?? []))
      .catch((err) => setError(err.message ?? 'Failed to load advertisement templates.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  // System default first, then the PI's own templates.
  const sorted = [...templates].sort((a, b) => {
    if (a.isSystemDefault !== b.isSystemDefault) return a.isSystemDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const handleClone = async (template) => {
    const newName = window.prompt('Name for the cloned template:', `${template.name} (copy)`);
    if (!newName || !newName.trim()) return;

    setBusyId(template.id);
    try {
      await cloneAdvertisementTemplate(template.id, newName.trim());
      load();
    } catch {
      // Error is shown via the global toast notification
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;

    setBusyId(template.id);
    try {
      await deleteAdvertisementTemplate(template.id);
      load();
    } catch {
      // Error is shown via the global toast notification
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-slate-500 dark:text-slate-400" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Advertisement Templates</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Reusable wording for recruitment advertisements. Clone the institute default (or one of
        your own templates) to create an editable copy, then pick it when generating an
        advertisement for a recruitment.
      </p>

      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {editingTemplate && (
        <AdvertisementTemplateEditor
          template={editingTemplate}
          onSaved={() => { setEditingTemplate(null); load(); }}
          onCancel={() => setEditingTemplate(null)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No templates available.</p>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
          {sorted.map((template) => (
            <div key={template.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 min-w-0">
                {template.isSystemDefault && (
                  <ShieldCheck size={16} className="text-blue-500 shrink-0" title="System default" />
                )}
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {template.name}
                </span>
                {template.isSystemDefault && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                    Institute Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleClone(template)}
                  disabled={busyId === template.id}
                  aria-label={`Clone ${template.name}`}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Copy size={13} /> Clone
                </button>
                {template.isOwnedByCaller && !template.isSystemDefault && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(template)}
                      aria-label={`Edit ${template.name}`}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      disabled={busyId === template.id}
                      aria-label={`Delete ${template.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
