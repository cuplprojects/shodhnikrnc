import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Info, ChevronRight } from 'lucide-react';
import { listWorkflowDefinitions } from '../../api/workflowDefinitionsApi';
import { stageLabel } from '../../constants/workflowDefinitionEnums';
import RouteEditor from './components/RouteEditor';

/**
 * The SuperAdmin view of the approval routes.
 *
 * Editing a route changes who may act on live requests, immediately and without
 * a redeploy — the engine reads these rows on the next request. The page says so
 * rather than leaving it to be discovered.
 */
export default function ManageWorkflowsPage() {
  const [definitions, setDefinitions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setDefinitions(await listWorkflowDefinitions() ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    // Flagged by the lint rule because these end in setState, but every write
    // happens in a promise callback after an await -- not synchronously during
    // the effect, which is what causes cascading renders.
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
      .catch((err) => { if (active) setError(err.message ?? 'Failed to load the workflow routes.'); })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
  }, [load]);

  const onSaved = (saved) => {
    setDefinitions((current) => current.map((d) => (d.id === saved.id ? saved : d)));
    setEditing(null);
  };

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Approval routes</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          The stages each kind of request travels through, and who may act at each.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300/90 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20">
        <Info size={14} className="mt-0.5 shrink-0" />
        Changes take effect immediately, on requests already in flight. There is no
        deployment step.
      </p>

      {editing ? (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
            {editing.requestType} · {editing.phase}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Editing this route.
          </p>
          <RouteEditor
            definition={editing}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : definitions.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <GitBranch size={32} className="text-slate-400 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            No routes are configured. Requests follow the built-in route until one is.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {definitions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setEditing(d)}
              className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {d.requestType} <span className="text-slate-400 font-medium">·</span> {d.phase}
                    {!d.isActive && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        inactive
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {d.stages.map((s) => stageLabel(s.stage)).join(' → ')}
                  </p>
                </div>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
