import { useState } from 'react';
import { Plus, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  updateWorkflowDefinition, validateWorkflowDefinition, validationErrorsOf,
} from '../../../api/workflowDefinitionsApi';
import {
  SEQUENCE_NOTE, NO_ROLES_NOTE, LIVE_INSTANCE_NOTE, CONCLUDE_NOTE,
} from '../../../constants/workflowDefinitionEnums';
import StageRow from './StageRow';

const blankStage = () => ({
  stage: 'Forwarded',
  allowedRoles: [],
  isInitial: false,
  isTerminal: false,
  canApprove: false,
  canReject: false,
  canReturn: false,
});

/**
 * Edits one route's stage list.
 *
 * Sequence numbers are not edited directly: they are assigned from list order
 * on save. The validator requires them contiguous from 1, and letting an
 * operator type them by hand would mean offering a way to produce a route the
 * server will always refuse.
 */
export default function RouteEditor({ definition, onSaved, onCancel }) {
  const [name, setName] = useState(definition.name);
  const [isActive, setIsActive] = useState(definition.isActive);
  const [stages, setStages] = useState(
    definition.stages.map((s) => ({ ...s, allowedRoles: [...s.allowedRoles] })),
  );
  const [errors, setErrors] = useState([]);
  const [validated, setValidated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Any edit invalidates a previous "looks good", which would otherwise linger
  // and read as approval of the current state.
  const mutate = (next) => { setStages(next); setValidated(false); setErrors([]); };

  const changeStage = (index, updated) =>
    mutate(stages.map((s, i) => (i === index ? updated : s)));

  const moveStage = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    mutate(next);
  };

  const removeStage = (index) => mutate(stages.filter((_, i) => i !== index));
  const addStage = () => mutate([...stages, blankStage()]);

  // Sequence comes from position, so reordering and removal cannot leave a gap.
  const payload = () => ({
    name,
    isActive,
    stages: stages.map((s, i) => ({ ...s, sequence: i + 1 })),
  });

  const runValidate = async () => {
    setErrors([]);
    try {
      const result = await validateWorkflowDefinition(definition.id, payload());
      setErrors(result.errors ?? []);
      setValidated(result.isValid);
    } catch (err) {
      setErrors([err.message ?? 'Could not validate this route.']);
      setValidated(false);
    }
  };

  const save = async () => {
    setIsSaving(true);
    setErrors([]);
    try {
      const saved = await updateWorkflowDefinition(definition.id, payload());
      onSaved(saved);
    } catch (err) {
      // A rejected save carries the validator's messages; anything else falls
      // back to the generic error.
      const validation = validationErrorsOf(err);
      setErrors(validation.length > 0 ? validation : [err.message ?? 'Could not save this route.']);
      setValidated(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[16rem]">
          <label htmlFor="route-name" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Route name
          </label>
          <input
            id="route-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setValidated(false); }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => { setIsActive(e.target.checked); setValidated(false); }}
          />
          Active
        </label>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Info size={13} className="mt-0.5 shrink-0" />
        {SEQUENCE_NOTE}
      </p>

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <StageRow
            key={index}
            stage={stage}
            index={index}
            total={stages.length}
            onChange={(updated) => changeStage(index, updated)}
            onMove={moveStage}
            onRemove={removeStage}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addStage}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-400 w-full justify-center"
      >
        <Plus size={15} /> Add a stage
      </button>

      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <p className="flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />{NO_ROLES_NOTE}</p>
        <p className="flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />{CONCLUDE_NOTE}</p>
        <p className="flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />{LIVE_INSTANCE_NOTE}</p>
      </div>

      {errors.length > 0 && (
        <div className="p-4 rounded-xl border border-red-300 bg-red-50 dark:border-red-700/60 dark:bg-red-900/20">
          <p className="flex items-center gap-1.5 text-sm font-bold text-red-800 dark:text-red-300">
            <AlertTriangle size={15} /> This route was not saved
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-red-700 dark:text-red-300">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {validated && errors.length === 0 && (
        <p className="flex items-center gap-1.5 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300">
          <CheckCircle2 size={15} /> This route is valid and can be saved.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
        >
          {isSaving ? 'Saving…' : 'Save route'}
        </button>
        <button
          type="button"
          onClick={runValidate}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Check without saving
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
