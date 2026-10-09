import { useState } from 'react';
import { Check, Gavel, RotateCcw, UserCheck, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import CommitteeMemberPicker, { newPickerValue, pickerToMemberInput, isBlankPickerValue } from './CommitteeMemberPicker';
import { assignScreeningCommitteeMember, selectSelectionCommitteeMember, returnSelectionCommittee } from '../../../api/recruitmentApi';
import toast from 'react-hot-toast';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

/**
 * Dean's side of the Screening Committee formation workflow (Task 7): a
 * single Inside-Institute-only picker (the BRD requires the Dean's Screening
 * nominee to be from inside the institute) plus an Assign button that both
 * nominates the member and approves the workflow in one call --
 * RecruitmentService.AssignScreeningCommitteeMemberAsync.
 */
export function DeanAssignScreeningMember({ recruitmentId, existing = [], onActed }) {
  const [nominee, setNominee] = useState(newPickerValue());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReassign, setShowReassign] = useState(false);

  const alreadyMembers = existing.filter((m) => m.role !== 'NominatedFaculty');
  const deanChosenMember = existing.find((m) => m.role === 'NominatedFaculty');

  const canAssign = !isBlankPickerValue(nominee) && nominee.name.trim() && nominee.department.trim() && !isSubmitting;

  const handleAssign = async () => {
    if (!canAssign) return;
    setIsSubmitting(true);
    try {
      await assignScreeningCommitteeMember(recruitmentId, pickerToMemberInput(nominee));
      setShowReassign(false);
      onActed?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-indigo-900 dark:text-indigo-300 text-xs flex items-center gap-1.5">
          <Gavel size={14} className="text-indigo-600 dark:text-indigo-400" />
          Dean: Assign Screening Committee Member
        </p>
        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded">Dean Action</span>
      </div>

      <p className="text-[11px] text-slate-600 dark:text-slate-400">
        Assign the additional Screening Committee member (must be inside the institute) and approve.
      </p>

      {/* Highlight members who are already part of the committee */}
      {alreadyMembers.length > 0 && (
        <div className="p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <UserCheck size={12} className="text-blue-600 dark:text-blue-400" />
            <span>Members Already in Committee (Standing):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alreadyMembers.map((m, idx) => (
              <span
                key={m.id || idx}
                className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md font-medium"
              >
                <span className="font-bold">
                  {m.role === 'Chairman' || m.role === 'PrincipalInvestigator' ? 'PI / Chair:' : 'Co-PI:'}
                </span>{' '}
                {m.name} ({m.department})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Highlight current member chosen by the Dean (if already assigned) */}
      {deanChosenMember && (
        <div className="p-3 dark:dark:dark:rounded-xl border border-indigo-200 dark:border-indigo-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
              <CheckCircle2 size={13} className="text-indigo-600 dark:text-indigo-400" />
              Member Chosen by Dean:
            </span>
            <span className="text-[10px] font-bold bg-indigo-600 text-white dark:bg-indigo-500 px-2.5 py-0.5 rounded-full shadow-xs">
              Chosen by Dean
            </span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            {deanChosenMember.name} — <span className="font-normal text-slate-600 dark:text-slate-400">{deanChosenMember.department} ({deanChosenMember.position})</span>
          </div>
          <button
            type="button"
            onClick={() => setShowReassign(!showReassign)}
            className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 flex items-center gap-1 pt-1"
          >
            {showReassign ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showReassign ? 'Hide re-assignment form' : 'Change / re-assign nominated member'}
          </button>
        </div>
      )}

      {/* Member picker: shown if no member chosen yet or if re-assign is toggled */}
      {(!deanChosenMember || showReassign) && (
        <div className="space-y-3 pt-1">
          <CommitteeMemberPicker
            label={deanChosenMember ? 'Select new nominee to replace current choice' : 'Screening nominee (Inside Institute)'}
            idPrefix="dean-screening-nominee"
            value={{ ...nominee, scope: 'inside' }}
            onChange={setNominee}
            required
            insideOnly
            existingMembers={existing}
          />

          <button
            type="button"
            onClick={handleAssign}
            disabled={!canAssign}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
          >
            <Check size={14} /> {deanChosenMember ? 'Update & Re-approve' : 'Assign & Approve'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Dean's side of the Selection Committee formation workflow: pick one of the
 * PI-recommended members (Role InternalNominee/ExternalNominee) to finalize
 * the committee, or return the whole submission to the PI with required
 * remarks -- consistent with this codebase's mandatory-remarks-on-Return
 * convention (see AdvertisementChainActions / joining-report return flow).
 */
export function DeanSelectionCommitteeActions({ recruitmentId, recommendedMembers, onActed }) {
  const [selectedId, setSelectedId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async () => {
    if (!selectedId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await selectSelectionCommitteeMember(recruitmentId, selectedId);
      onActed?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (isSubmitting) return;
    if (!remarks.trim()) {
      toast.error('Remarks are required to return the Selection Committee submission to the PI.');
      return;
    }
    setIsSubmitting(true);
    try {
      await returnSelectionCommittee(recruitmentId, remarks);
      setRemarks('');
      onActed?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-indigo-900 dark:text-indigo-300 text-xs">Dean: Select Selection Committee Member</p>
        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded">Dean Action</span>
      </div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">
        Choose one of the recommended members to finalize the committee, or return the submission to the PI for changes.
      </p>

      {recommendedMembers.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No recommended members found on this submission.</p>
      ) : (
        <div className="space-y-1.5">
          {recommendedMembers.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-900/40">
              <input type="radio" name="dean-select-selection-member" value={m.id}
                checked={selectedId === m.id}
                onChange={() => setSelectedId(m.id)}
                className="text-blue-600 focus:ring-blue-500" />
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-slate-500">{m.department} ({m.position}){m.isOutsideInstitute ? ' — Outside Institute' : ''}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={handleSelect} disabled={!selectedId || isSubmitting}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1.5">
          <Gavel size={14} /> Select & Approve
        </button>
      </div>

      <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30 space-y-2">
        <textarea rows="2" value={remarks} onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks (required to return to the PI)"
          className={`${FIELD_CLASS} custom-scrollbar`} />
        <button type="button" onClick={handleReturn} disabled={isSubmitting}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1.5">
          <RotateCcw size={14} /> Return to PI
        </button>
      </div>
    </div>
  );
}
