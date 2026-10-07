import { useEffect, useRef } from 'react';
import { Info } from 'lucide-react';

const SCOPES = [
  { value: 'Own', label: 'Own', hint: 'Only rows this user owns' },
  { value: 'Department', label: 'Department', hint: "Their department's rows" },
  { value: 'Institute', label: 'Institute', hint: 'Every row' },
];

/**
 * A checkbox that can show a third state: some of its pages are on, not all.
 *
 * `indeterminate` is a DOM property with no HTML attribute, so it has to be set
 * imperatively -- React will not render it from props.
 */
function TriStateCheckbox({ checked, indeterminate, onChange, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} {...rest} />;
}

/**
 * The module and page permissions for one role.
 *
 * Permissions are stored per page; the module checkbox is a convenience that
 * ticks all of them. Storing module-level grants as well would mean "why can
 * this role see X" had two possible answers, and "all of Projects except the
 * edit page" could not be expressed at all.
 */
export default function PermissionTree({ modules, granted, onToggle, onToggleModule, onScope }) {
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Info size={13} className="mt-0.5 shrink-0" />
        Ticking a module ticks every page under it. Untick individual pages to make
        exceptions — the module box then shows a dash.
      </p>

      {modules.map((module) => {
        const keys = module.pages.map((p) => p.key);
        const on = keys.filter((k) => granted[k]);
        const allOn = on.length === keys.length && keys.length > 0;
        const someOn = on.length > 0 && !allOn;

        return (
          <div key={module.key} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <label className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <TriStateCheckbox
                checked={allOn}
                indeterminate={someOn}
                onChange={() => onToggleModule(module.key, !allOn)}
                aria-label={`All pages in ${module.name}`}
              />
              <span className="font-bold text-slate-800 dark:text-slate-200">{module.name}</span>
              <span className="text-xs text-slate-400">{module.group}</span>
              <span className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {on.length}/{keys.length}
              </span>
            </label>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {module.pages.map((page) => {
                const isOn = Boolean(granted[page.key]);
                return (
                  <div key={page.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 pl-10">
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-[14rem]">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => onToggle(page.key, !isOn)}
                        aria-label={page.name}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{page.name}</span>
                      {!page.isNavigable && (
                        <span
                          title="Reached from inside the app rather than the sidebar"
                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-500"
                        >
                          no menu link
                        </span>
                      )}
                    </label>

                    <code className="text-xs text-slate-400 font-mono">{page.route}</code>

                    {isOn && (
                      <select
                        value={page.scope}
                        onChange={(e) => onScope(page.key, e.target.value)}
                        aria-label={`Data scope for ${page.name}`}
                        className="ml-auto px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                      >
                        {SCOPES.map((s) => (
                          <option key={s.value} value={s.value} title={s.hint}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
