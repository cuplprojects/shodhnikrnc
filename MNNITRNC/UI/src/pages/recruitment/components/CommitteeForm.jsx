import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Info, UserCheck, Gavel, CheckCircle2, Clock } from 'lucide-react';
import {
  SCREENING_ROLES,
  SELECTION_ROLES,
  SCREENING_COMPOSITION_NOTE,
  SELECTION_COMPOSITION_NOTE,
} from '../../../constants/recruitmentEnums';
import {
  submitScreeningCommittee, submitSelectionCommittee, listFacultyDirectory,
  submitScreeningCommitteeForApproval,
} from '../../../api/recruitmentApi';
import { useAuth } from '../../../auth/useAuth';
import CommitteeMemberPicker from './CommitteeMemberPicker';
import SelectionCommitteeRecommendationForm from './SelectionCommitteeRecommendationForm';
import { DeanAssignScreeningMember, DeanSelectionCommitteeActions } from './CommitteeDeanActions';

const FIELD_CLASS =
  'px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm';

// Member 3 (Screening) / Members 3-4 (Selection) -- SubmitCommitteeAsync
// doesn't require these, so a row for one is allowed to stay blank and is
// dropped before submission rather than blocking Member 1/2 from saving.
const OPTIONAL_ROLES = new Set(['NominatedFaculty', 'InternalNominee', 'ExternalNominee']);

function isBlankMember(m) {
  return !m.name.trim() && !m.applicationUserId && !m.consentDocumentId;
}

function newMember(role) {
  return {
    role,
    scope: 'inside', // 'inside' (Inside Institute) | 'outside' (Outside Institute)
    departmentId: '',
    name: '', department: '', position: '', email: '',
    applicationUserId: null,
    isExternal: false,
    isOutsideInstitute: false,
    consentDocumentId: null,
    consentFileName: '',
  };
}

/**
 * Screening or selection committee roster.
 *
 * Each member is picked from a real faculty account, scoped Inside Institute
 * (department, then a faculty name within it) or -- for someone with no
 * MNNIT account at all -- entered freeform as Outside Institute, with their
 * own uploaded signed consent. Position/Department/Email are read-only,
 * filled in from whichever account was picked.
 *
 * The composition rules are stated up front and checked before submitting, but
 * the server validates them independently -- this only saves a round trip and
 * explains what is required.
 *
 * Task 7 (2026-09-22) adds the tracked PI-to-Dean formation workflow on top
 * of this manual roster editor: for Selection, the PI's primary path is now
 * SelectionCommitteeRecommendationForm (submit 3-5 recommended members for
 * Dean approval) rather than typing the full roster directly; for Screening,
 * the PI submits for approval and the Dean assigns the last member via
 * DeanAssignScreeningMember. The manual roster editor below is kept
 * available (e.g. for HOD/PI direct edits and for the Dean's own screening
 * nomination roles already in the roster) since the server-side manual
 * SubmitCommitteeAsync endpoints are unchanged.
 */
export default function CommitteeForm({ recruitmentId, kind, existing = [], workflow = null, piDepartmentId = null, onSaved }) {
  const { user } = useAuth();
  const isScreening = kind === 'Screening';
  const roles = isScreening ? SCREENING_ROLES : SELECTION_ROLES;
  const note = isScreening ? SCREENING_COMPOSITION_NOTE : SELECTION_COMPOSITION_NOTE;
  const isDean = user?.roles?.includes('Dean') || user?.roles?.includes('SuperAdmin');
  const isPI = user?.roles?.includes('Faculty');

  // Resolved once and passed down to every CommitteeMemberPicker as the
  // default Inside-Institute department (each picker fetches its own
  // faculty list per department -- see CommitteeMemberPicker).
  const [resolvedPiDeptId, setResolvedPiDeptId] = useState(piDepartmentId);

  // If the PI's own department wasn't passed in, resolve it from the
  // unscoped faculty directory by matching the logged-in user's own id.
  useEffect(() => {
    if (piDepartmentId || !user?.userId) return;
    listFacultyDirectory()
      .then((data) => {
        const self = (data ?? []).find((f) => f.id === user.userId);
        if (self?.departmentId) setResolvedPiDeptId(self.departmentId);
      })
      .catch((err) => console.error('Failed to resolve the PI\'s own department', err));
  }, [piDepartmentId, user?.userId]);

  const [members, setMembers] = useState(
    existing.length > 0
      ? existing.map((m) => ({
          role: m.role,
          scope: m.isOutsideInstitute ? 'outside' : 'inside',
          departmentId: '',
          name: m.name, department: m.department, position: m.position,
          email: m.email ?? '',
          applicationUserId: m.applicationUserId ?? null,
          isExternal: m.isExternal,
          isOutsideInstitute: m.isOutsideInstitute ?? false,
          consentDocumentId: m.consentDocumentId ?? null,
          consentFileName: m.consentDocumentId ? 'Consent on file' : '',
        }))
      : roles.map((r) => newMember(r.value))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (index, field, value) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));

  const add = () => setMembers([...members, newMember(roles[0].value)]);
  const remove = (index) => setMembers(members.filter((_, i) => i !== index));

  const toWireMember = (m) => ({
    role: m.role,
    name: m.name,
    department: m.department,
    position: m.position || m.department, // Position falls back to Department only if a picked account has no designation on file yet; the field stays editable below in that case.
    isExternal: m.isExternal,
    applicationUserId: m.applicationUserId,
    email: m.email,
    isOutsideInstitute: m.scope === 'outside',
    consentDocumentId: m.consentDocumentId,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const submit = isScreening ? submitScreeningCommittee : submitSelectionCommittee;
      const toSubmit = members.filter((m) => !(OPTIONAL_ROLES.has(m.role) && isBlankMember(m)));
      await submit(recruitmentId, toSubmit.map(toWireMember));
      onSaved?.();
    } catch {
      // The global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  // Task 7: the recommended-members submitted for Dean selection (Selection
  // Committee only) -- InternalNominee/ExternalNominee rows on the existing
  // roster, whether this submission is fresh or came back after a return.
  const recommendedForDean = !isScreening
    ? existing.filter((m) => m.role === 'InternalNominee' || m.role === 'ExternalNominee')
    : [];
  const isSelectionPendingDean = !isScreening && workflow?.currentStage === 'WithDeanSelectionCommittee';
  const isSelectionApproved = !isScreening && workflow?.currentStage === 'SelectionCommitteeApproved';
  const isSelectionReturned = !isScreening && workflow?.currentStage === 'ReturnedToPISelectionCommittee';
  const selectionDeanNominee = !isScreening ? existing.find(m => m.isSelectedByDean) : null;

  const hasSubmittedForApproval = !isScreening && existing.some((m) => m.role === 'PrincipalInvestigator' || m.role === 'Chairman');

  const hasScreeningChair = isScreening && existing.some((m) => m.role === 'Chairman' || m.role === 'PrincipalInvestigator');
  const hasDeanNominee = isScreening && existing.some((m) => m.role === 'NominatedFaculty');
  const deanNomineeMember = isScreening ? existing.find((m) => m.role === 'NominatedFaculty') : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-slate-500 dark:text-slate-400" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {isScreening ? 'Screening Committee' : 'Selection Committee'}
        </span>
      </div>

      {/* --- PI-facing: submit-with-recommendations / submit-for-approval flow --- */}
      {isPI && isScreening && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
          {hasScreeningChair ? (
            hasDeanNominee ? (
              <div className="flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Screening Committee Fully Formed & Approved</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Your standing members (Chairman & Co-PI) and the member chosen by the Dean ({deanNomineeMember?.name}) are confirmed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Submitted for Dean Approval</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Your standing members (Chairman & Co-PI) have been saved. Waiting for the Dean to choose and assign the additional nominee.
                  </p>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submitting adds you (Chairman) and your Co-PI automatically, then forwards the request to the Dean
              to nominate the additional member.
            </p>
          )}

          {!hasDeanNominee && (
            <button type="button" disabled={isSubmitting}
              onClick={async () => {
                if (isSubmitting) return;
                setIsSubmitting(true);
                try {
                  await submitScreeningCommitteeForApproval(recruitmentId);
                  onSaved?.();
                } catch {
                  // Global toast (via apiClient) shows the error automatically.
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg text-sm shadow-xs transition-all">
              {isSubmitting ? 'Submitting…' : hasScreeningChair ? 'Re-submit for Dean approval' : 'Submit for Dean approval'}
            </button>
          )}
        </div>
      )}

      {isPI && !isScreening && (
        <div className="space-y-3">
          {isSelectionApproved ? (
            <div className="flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Selection Committee Fully Formed & Approved</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Your standing members (Chairman & PI) and the member chosen by the Dean ({selectionDeanNominee?.name}) are confirmed.
                </p>
              </div>
            </div>
          ) : isSelectionPendingDean || (hasSubmittedForApproval && !isSelectionReturned) ? (
            <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Submitted for Dean Approval</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Your recommendations have been saved. Waiting for the Dean to choose and assign one of the nominees.
                </p>
              </div>
            </div>
          ) : (
            <>
              {isSelectionReturned && (
                <div className="flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800 mb-3">
                  <div className="space-y-0.5">
                    <p className="font-bold">Returned by Dean</p>
                    <p className="text-[11px] text-red-700 dark:text-red-400">
                      The Dean has requested revisions to your recommended members. Please update your recommendations and resubmit.
                    </p>
                  </div>
                </div>
              )}
              <SelectionCommitteeRecommendationForm
                recruitmentId={recruitmentId}
                piName={user?.fullName ?? ''}
                piDepartmentId={resolvedPiDeptId}
                onSubmitted={() => onSaved?.()}
              />
            </>
          )}
        </div>
      )}

      {/* --- Dean-facing: assign / select / return --- */}
      {isDean && isScreening && (
        <DeanAssignScreeningMember recruitmentId={recruitmentId} existing={existing} onActed={() => onSaved?.()} />
      )}
      {isDean && !isScreening && hasSubmittedForApproval && !selectionDeanNominee && (
        <DeanSelectionCommitteeActions
          recruitmentId={recruitmentId}
          recommendedMembers={recommendedForDean}
          onActed={() => onSaved?.()}
        />
      )}

      {/* --- Manual roster editor (direct submit, unchanged server-side) ---
          PI-only: this bypasses the tracked PI-to-Dean workflow entirely
          (it calls the old SubmitCommitteeAsync endpoints directly), so it
          stays scoped to the PI exactly as it always was. Dean's reachable
          actions on this form are only the ones above (assign/select/return). */}
      {isPI && (
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
          Manual roster editor (advanced)
        </summary>
        <form onSubmit={handleSubmit} className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Info size={14} className="mt-0.5 shrink-0" />
              <p>{note}</p>
            </div>
            <button type="button" onClick={add}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 shrink-0">
              <Plus size={16} /> Add member
            </button>
          </div>

          <div className="space-y-2">
            {members.map((m, index) => {
              const isOptional = OPTIONAL_ROLES.has(m.role);
              const fieldsRequired = !isOptional;

              return (
                <div key={index} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {roles.find((r) => r.value === m.role)?.label ?? `Member ${index + 1}`}
                        {isOptional && <span className="ml-1.5 normal-case font-medium text-slate-400">(optional — fill in now or later)</span>}
                      </span>
                      {isScreening && (m.role === 'Chairman' || m.role === 'CoPrincipalInvestigator') && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                          <UserCheck size={11} className="text-blue-600 dark:text-blue-400" /> Already a Member
                        </span>
                      )}
                      {isScreening && m.role === 'NominatedFaculty' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white dark:bg-indigo-500 px-2.5 py-0.5 rounded-full shadow-xs">
                          <Gavel size={11} /> Chosen by Dean
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => remove(index)}
                      aria-label={`Remove member ${index + 1}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <select value={m.role} onChange={(e) => update(index, 'role', e.target.value)}
                    aria-label={`Member ${index + 1} role`} className={`${FIELD_CLASS} w-full`}>
                    {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>

                  {isOptional && (
                    <p className="text-[11px] text-slate-400">
                      Leave every field below blank to skip this member for now — it will not be sent, and Members 1-2 can still be saved.
                    </p>
                  )}

                  <CommitteeMemberPicker
                    label={`Member ${index + 1}`}
                    idPrefix={`manual-${index}`}
                    value={m}
                    onChange={(next) => setMembers((prev) => prev.map((mm, i) => (i === index ? { ...mm, ...next } : mm)))}
                    required={fieldsRequired}
                    defaultDepartmentId={resolvedPiDeptId}
                    existingMembers={members.filter((_, i) => i !== index)}
                  />

                  {!isScreening && m.scope !== 'outside' && (
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={m.isExternal}
                        onChange={(e) => update(index, 'isExternal', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      External to the PI's department
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg">
              {isSubmitting ? 'Saving…' : 'Save committee'}
            </button>
          </div>
        </form>
      </details>
      )}
    </div>
  );
}
