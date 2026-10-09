import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { WORKFLOW_STAGES, ASSIGNABLE_ROLES } from '../../../constants/workflowDefinitionEnums';

/**
 * One stage of a route: its position, which stage it is, who may act, and
 * whether it can conclude.
 *
 * Reordering is by explicit up/down buttons rather than drag and drop. The
 * sequence is the route, so a mis-drop is a silent change to how requests
 * travel; a button press is deliberate and works by keyboard.
 */
export default function StageRow({
  stage, index, total, onChange, onMove, onRemove,
}) {
  const toggleRole = (role) => {
    const has = stage.allowedRoles.includes(role);
    onChange({
      ...stage,
      allowedRoles: has
        ? stage.allowedRoles.filter((r) => r !== role)
        : [...stage.allowedRoles, role],
    });
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold tabular-nums">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${stage.stage} earlier`}
            className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Move ${stage.stage} later`}
            className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor={`stage-${index}`}>Stage</label>
            <select
              id={`stage-${index}`}
              value={stage.stage}
              onChange={(e) => onChange({ ...stage, stage: e.target.value })}
              className="px-3 py-1.5 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
            >
              {WORKFLOW_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={stage.isInitial}
                onChange={(e) => onChange({ ...stage, isInitial: e.target.checked })}
              />
              Starting stage
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={stage.canApprove}
                onChange={(e) => onChange({ ...stage, canApprove: e.target.checked })}
              />
              Can approve
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={stage.canReject}
                onChange={(e) => onChange({ ...stage, canReject: e.target.checked })}
              />
              Can reject
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={stage.canReturn}
                onChange={(e) => onChange({ ...stage, canReturn: e.target.checked })}
              />
              Can return
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              Roles:
            </span>
            {ASSIGNABLE_ROLES.map((role) => {
              const on = stage.allowedRoles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRole(role)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full border transition-colors ${
                    on
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                  }`}
                >
                  {role}
                </button>
              );
            })}
            {stage.allowedRoles.length === 0 && (
              <span className="ml-1 text-xs italic text-slate-400">
                unrestricted — the raiser
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${stage.stage}`}
          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
