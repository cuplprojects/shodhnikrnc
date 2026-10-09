import { ACTION_LABELS, ACTION_COLORS } from '../constants/projectEnums';
import { formatActor } from '../utils/formatActor';

function formatAction(action) {
  return ACTION_LABELS[action] ?? action;
}

export default function ApprovalTimeline({ steps }) {
  if (!steps || steps.length === 0) {
    return <p className="text-slate-500 dark:text-slate-400 italic text-sm">No workflow activity yet.</p>;
  }

  return (
    <ol className="relative border-l-2 border-slate-200 dark:border-slate-700 m-0 p-0 list-none ml-2">
      {steps.map((step, index) => {
        const colorClass = ACTION_COLORS[step.action] || "bg-slate-400 dark:bg-slate-500";
        return (
          <li key={`${step.sequenceOrder}-${index}`} className="mb-6 ml-6 last:mb-0">
            <span className={`absolute flex items-center justify-center w-3 h-3 rounded-full -left-[7px] ring-4 ring-white dark:ring-slate-900 ${colorClass}`} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 font-semibold">
                <span className="text-sm text-slate-800 dark:text-slate-100">{step.stepName}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {formatAction(step.action)}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {step.actorUserId != null && (
                  <span>{formatActor(step.actorName, step.actorEmployeeId, step.actorUserId)}</span>
                )}
                {step.timestamp && <span>{new Date(step.timestamp).toLocaleString()}</span>}
              </div>
              {step.remarks && (
                <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  {step.remarks}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
