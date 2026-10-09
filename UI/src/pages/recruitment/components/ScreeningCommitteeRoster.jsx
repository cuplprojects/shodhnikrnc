import { UserCheck, Gavel, Clock, Mail, Building2, ShieldCheck, Sparkles, CheckCircle } from 'lucide-react';

/**
 * Returns helper info for a screening committee member's role.
 */
function getRoleMeta(role) {
  switch (role) {
    case 'Chairman':
    case 'PrincipalInvestigator':
      return {
        label: 'Chairman (Principal Investigator)',
        isAlreadyMember: true,
        isDeanChosen: false,
        memberNum: 'Member 1',
        tag: 'Core Project Member',
        description: 'Principal Investigator of the project — default committee chair.',
      };
    case 'CoPrincipalInvestigator':
      return {
        label: 'Co-Principal Investigator',
        isAlreadyMember: true,
        isDeanChosen: false,
        memberNum: 'Member 2',
        tag: 'Core Project Member',
        description: 'Co-PI of the project — standing committee member.',
      };
    case 'NominatedFaculty':
      return {
        label: 'Nominated Faculty',
        isAlreadyMember: false,
        isDeanChosen: true,
        memberNum: 'Member 3',
        tag: "Dean's Approved Nominee",
        description: 'Additional faculty member nominated and assigned by the Dean.',
      };
    default:
      return {
        label: role,
        isAlreadyMember: true,
        isDeanChosen: false,
        memberNum: 'Committee Member',
        tag: 'Committee Member',
        description: '',
      };
  }
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * High-visibility roster card for the Screening Committee Setup.
 *
 * Distinctly highlights:
 * 1. Members who are already part of the committee (PI / Chairman, Co-PI) with
 *    "Already a Member" badge and blue/emerald styling.
 * 2. The member chosen by the Dean (Nominated Faculty) with a prominent
 *    "Member Chosen by Dean" badge and indigo/purple gradient styling.
 * 3. If the Dean has not yet nominated a member, a clear pending slot
 *    indicating "Awaiting Member Chosen by Dean".
 */
export default function ScreeningCommitteeRoster({ screening = [] }) {
  const deanNominee = screening.find((m) => m.role === 'NominatedFaculty');
  const alreadyMembers = screening.filter((m) => m.role !== 'NominatedFaculty');

  const isComplete = screening.some(
    (m) => m.role === 'Chairman' || m.role === 'PrincipalInvestigator'
  ) && Boolean(deanNominee);

  if (screening.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          No committee members registered yet.
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-500">
          Submitting for Dean approval will automatically register the PI (Chairman) and Co-PI as standing members, and request the Dean to choose the 3rd member.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with summary stats and legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Committee Roster ({screening.length} {screening.length === 1 ? 'member' : 'members'} on record)
          </span>
          {isComplete ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
              <CheckCircle size={12} /> Complete Roster
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
              <Clock size={12} /> Awaiting Dean Nominee
            </span>
          )}
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold">
            <UserCheck size={11} /> Already a Member
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white dark:bg-indigo-500 font-bold shadow-xs">
            <Gavel size={11} /> Chosen by Dean
          </span>
        </div>
      </div>

      {/* Grid of members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Render members who are already part of the committee */}
        {alreadyMembers.map((m, idx) => {
          const meta = getRoleMeta(m.role);
          const initials = getInitials(m.name);

          return (
            <div
              key={m.id || idx}
              className="relative p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 border-l-4 border-l-blue-500 dark:border-l-blue-400 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 group"
            >
              <div className="space-y-2.5">
                {/* Top badges */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/80 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <UserCheck size={12} className="text-blue-600 dark:text-blue-400" />
                    Already a Member
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                    {meta.memberNum}
                  </span>
                </div>

                {/* Member Identity */}
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-700 shadow-xs">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {m.name}
                    </h4>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {meta.label}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building2 size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{m.department || 'Department not specified'} {m.position ? `(${m.position})` : ''}</span>
                    </p>
                    {m.email && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 truncate">
                        <Mail size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{m.email}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Tag */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded">
                  <ShieldCheck size={11} className="text-blue-500" /> {meta.tag}
                </span>
                <span>Inside Institute</span>
              </div>
            </div>
          );
        })}

        {/* Render the member chosen by the Dean (or placeholder if not yet chosen) */}
        {deanNominee ? (
          <div
            key={deanNominee.id || 'dean-nominee'}
            className="relative p-3.5 dark:dark:dark:rounded-xl border border-indigo-200 dark:border-indigo-800/80 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 group ring-1 ring-indigo-500/10"
          >
            <div className="space-y-2.5">
              {/* Top badges with high visual prominence */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white dark:bg-indigo-500 shadow-xs tracking-wide">
                  <Gavel size={13} className="text-amber-300" />
                  Chosen by Dean
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded">
                  Member 3
                </span>
              </div>

              {/* Member Identity */}
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-700">
                  {getInitials(deanNominee.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {deanNominee.name}
                    </h4>
                    <Sparkles size={13} className="text-amber-500 shrink-0" />
                  </div>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Nominated Faculty (Dean's Choice)
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                    <Building2 size={12} className="text-indigo-500 shrink-0" />
                    <span className="truncate">{deanNominee.department || 'Department not specified'} {deanNominee.position ? `(${deanNominee.position})` : ''}</span>
                  </p>
                  {deanNominee.email && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1 truncate">
                      <Mail size={11} className="text-indigo-400 shrink-0" />
                      <span className="truncate">{deanNominee.email}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card Footer Tag */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-[10px]">
              <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded">
                <CheckCircle size={11} className="text-indigo-600 dark:text-indigo-400" />
                Dean's Approved Nominee
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {deanNominee.isOutsideInstitute ? 'Outside Institute' : 'Inside Institute'}
              </span>
            </div>
          </div>
        ) : (
          /* Placeholder Slot when Dean has NOT yet chosen the 3rd member */
          <div
            key="dean-nominee-pending"
            className="p-3.5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700">
                  <Clock size={12} className="animate-pulse text-amber-600" />
                  Awaiting Dean's Choice
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Member 3
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Nominated Faculty (Dean)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  The additional faculty member will be chosen and assigned by the Dean from inside the institute to finalize the committee.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              <span>Pending Dean Assignment</span>
              <span>Seat 3 of 3</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
