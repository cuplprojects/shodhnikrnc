import { useState } from 'react';
import { Plus, Trash2, UserCheck } from 'lucide-react';
import CommitteeMemberPicker, { newPickerValue, pickerToMemberInput, isBlankPickerValue } from './CommitteeMemberPicker';
import { submitSelectionCommitteeForApproval } from '../../../api/recruitmentApi';

const MIN_RECOMMENDED = 3;
const MAX_RECOMMENDED = 5;

/**
 * The PI's side of the Selection Committee formation workflow (Task 7): the
 * PI and HOD are auserver-side (SubmitSelectionCommitteeForApprovalAsync)
 * so they are shown here read-only for context, not picked. The PI offers one
 * optional member (skippable) and 3-5 recommended members for the Dean to
 * choose one of. Submitting forwards the request to the Dean -- see
 * RecruitmentService.SubmitSelectionCommitteeForApprovalAsync.
 */
export default function SelectionCommitteeRecommendationForm({
  recruitmentId, piName, hodName, piDepartmentId = null, onSubmitted,
}) {
  const [includeOptional, setIncludeOptional] = useState(false);
  const [optionalMember, setOptionalMember] = useState(newPickerValue());
  const [recommended, setRecommended] = useState([newPickerValue(), newPickerValue(), newPickerValue()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateRecommended = (index, next) =>
    setRecommended((prev) => prev.map((v, i) => (i === index ? next : v)));

  const addRecommended = () => {
    if (recommended.length >= MAX_RECOMMENDED) return;
    setRecommended((prev) => [...prev, newPickerValue()]);
  };

  const removeRecommended = (index) => {
    if (recommended.length <= MIN_RECOMMENDED) return;
    setRecommended((prev) => prev.filter((_, i) => i !== index));
  };

  // Client-side mirror of the server's 3-5 recommended-member rule (same
  // pattern as this codebase's other mandatory-field checks) -- filled means
  // every slot has at least a name, so an accidentally-added blank row still
  // blocks Submit rather than silently being dropped.
  const filledRecommendedCount = recommended.filter((v) => !isBlankPickerValue(v)).length;
  const recommendedCountValid =
    recommended.length >= MIN_RECOMMENDED &&
    recommended.length <= MAX_RECOMMENDED &&
    filledRecommendedCount === recommended.length;

  const canSubmit = recommendedCountValid && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const optional = includeOptional && !isBlankPickerValue(optionalMember)
        ? pickerToMemberInput(optionalMember)
        : null;
      await submitSelectionCommitteeForApproval(
        recruitmentId,
        optional,
        recommended.map(pickerToMemberInput),
      );
      onSubmitted?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <UserCheck size={14} className="mt-0.5 shrink-0" />
        <p>
          The PI and HOD are added automatically as Chairman/Member. Recommend {MIN_RECOMMENDED}-{MAX_RECOMMENDED} faculty
          members for the Dean to choose one of, and optionally one additional member of your own choosing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-500 dark:text-slate-500 text-xs block">Member — Principal Investigator</span>
          {piName || <span className="italic">Current user</span>}
        </div>
        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-500 dark:text-slate-500 text-xs block">Chairman — Head of Department</span>
          {hodName || <span className="italic">Resolved from your department</span>}
        </div>
      </div>

      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={includeOptional}
            onChange={(e) => setIncludeOptional(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
          Add an optional member (skippable)
        </label>
        {includeOptional && (
          <CommitteeMemberPicker
            label="Optional member"
            idPrefix="optional"
            value={optionalMember}
            onChange={setOptionalMember}
            required={false}
            defaultDepartmentId={piDepartmentId}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Recommended members ({filledRecommendedCount}/{recommended.length})
          </span>
          <button type="button" onClick={addRecommended} disabled={recommended.length >= MAX_RECOMMENDED}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={16} /> Add recommended member
          </button>
        </div>

        {recommended.map((v, index) => (
          <div key={index} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recommended member {index + 1}
              </span>
              <button type="button" onClick={() => removeRecommended(index)}
                disabled={recommended.length <= MIN_RECOMMENDED}
                aria-label={`Remove recommended member ${index + 1}`}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed">
                <Trash2 size={16} />
              </button>
            </div>
            <CommitteeMemberPicker
              label={`Recommended member ${index + 1}`}
              idPrefix={`recommended-${index}`}
              value={v}
              onChange={(next) => updateRecommended(index, next)}
              required
              defaultDepartmentId={piDepartmentId}
            />
          </div>
        ))}

        {!recommendedCountValid && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Exactly {MIN_RECOMMENDED} to {MAX_RECOMMENDED} recommended members must be fully filled in before you can submit.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={!canSubmit}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg">
          {isSubmitting ? 'Submitting…' : 'Submit for Dean approval'}
        </button>
      </div>
    </form>
  );
}
