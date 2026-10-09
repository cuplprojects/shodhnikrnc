import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, IndianRupee, Clock, Calendar, CheckCircle, ExternalLink, CalendarDays, Pencil } from 'lucide-react';
import { getProposal, extendProposalExpiry, updateProposal } from '../../api/proposalsApi';
import { getWorkflowInstance } from '../../api/workflowApi';
import { formatCurrency } from '../projects/utils/currency';
import { formatActor } from '../../utils/formatActor';
import { useAuth } from '../../auth/useAuth';
import { validateProposalBudget } from './validateProposalBudget';
import ApprovalTimeline from '../../components/ApprovalTimeline';
import WorkflowQueryPanel from '../../components/WorkflowQueryPanel';
import DocumentUploader from '../../components/DocumentUploader';
import ExpiryCountdownWidget from '../../components/ExpiryCountdownWidget';
import ProposalStageBadge from './components/ProposalStageBadge';
import ProposalStatusBadge from './components/ProposalStatusBadge';
import ProposalChainActions from './components/ProposalChainActions';
import ProposalAgencyActions from './components/ProposalAgencyActions';
import ProposalBudgetMatrix from './components/ProposalBudgetMatrix';
import ProposalEquipmentFieldArray from './components/ProposalEquipmentFieldArray';
import ProposalManpowerFieldArray from './components/ProposalManpowerFieldArray';
import ProposalCoPiFieldArray from './components/ProposalCoPiFieldArray';


function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

const PROPOSAL_TYPES = {
  ResearchProject: 'Type-I: Research Projects',
  IndustrySponsoredProject: 'Type-II: Industry sponsored Projects',
  ConsultancyProject: 'Type-III: Consultancy Project',
  Testing: 'Type IV: Testing',
  OtherActivities: 'Type V: Other activities',
};

export default function ProposalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.userId ?? null;

  const [proposal, setProposal] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    const data = await getProposal(id);
    setProposal(data);
    if (data?.workflowInstanceId) {
      setWorkflow(await getWorkflowInstance(data.workflowInstanceId).catch(() => null));
    } else {
      setWorkflow(null);
    }
    return data;
  };

  useEffect(() => {
    let active = true;
    load()
      .catch(() => { if (active) setError('Failed to load the proposal.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-12">
        <div className="text-slate-500 dark:text-slate-400 font-medium animate-pulse text-lg">Loading proposal...</div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-12">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-rose-200/50 dark:border-rose-900/50 rounded-2xl p-12 text-center text-rose-500 dark:text-rose-400 font-medium shadow-sm">
          {error ?? 'Proposal not found.'}
        </div>
      </div>
    );
  }

  const steps = workflow?.steps ?? [];

  // The backend's WorkflowStepResponse contract does not expose an
  // isUndone/undoneAt flag (only the WorkflowStep entity tracks that), so the
  // most-recent entry in this already-fetched, timestamp-ordered list is the
  // closest available proxy for "the most recent non-undone step". This is a
  // UX hint only -- Undo/UndoLastActionAsync on the backend remains the sole
  // authority and safely rejects an ineligible attempt with a clear message.
  const lastStepActorUserId = steps.length > 0 ? steps[steps.length - 1].actorUserId : null;

  const priorActors = Array.from(
    steps.reduce((map, step) => {
      if (step.actorUserId != null && !map.has(step.actorUserId)) {
        map.set(step.actorUserId, { userId: step.actorUserId, label: formatActor(step.actorName, step.actorEmployeeId, step.actorUserId) });
      }
      return map;
    }, new Map()).values(),
  );

  const actualOwnerId = proposal.ownerUserId || proposal.piUserId;
  const isOwner = Boolean(currentUserId) && Boolean(actualOwnerId) && currentUserId === actualOwnerId;
  const isPIActionableStage =
    proposal.status === 'Draft' ||
    proposal.currentStage === 'Draft' ||
    proposal.currentStage === 'ReturnedToPI';
  const canEdit = isOwner && isPIActionableStage;

  const startEditing = () => {
    setEditForm({
      title: proposal.title,
      proposalType: proposal.proposalType || 'ResearchProject',
      agency: proposal.agency,
      advertisementReference: proposal.advertisementReference ?? '',
      durationMonths: proposal.durationMonths,
      overheadPercent: proposal.overheadPercent,
      budgetLines: proposal.budgetLines.map((l) => ({
        headName: l.headName, includeInOverhead: l.includeInOverhead, customLabel: l.customLabel ?? '', yearAmounts: l.yearAmounts,
      })),
      equipment: proposal.equipment.map((e) => ({ name: e.name, unit: e.unit, amount: e.amount })),
      manpower: proposal.manpower.map((m) => ({
        designation: m.designation, positions: m.positions, hraPercent: m.hraPercent,
        stipendByYear: [...m.stipendByYear],
      })),
      coPis: proposal.coPis.map((c) => ({
        name: c.name,
        department: c.department,
        designation: c.designation,
        isInsideInstitute: Boolean(c.isInsideInstitute),
        instituteName: c.instituteName || ''
      })),
    });
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
    setEditError(null);
  };

  const saveEditing = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const validationError = validateProposalBudget({
      budgetLines: editForm.budgetLines, equipment: editForm.equipment, manpower: editForm.manpower,
    });
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      await updateProposal(proposal.id, {
        title: editForm.title,
        proposalType: editForm.proposalType,
        agency: editForm.agency,
        advertisementReference: editForm.advertisementReference || null,
        durationMonths: Number(editForm.durationMonths) || 1,
        overheadPercent: Number(editForm.overheadPercent) || 0,
        budgetLines: editForm.budgetLines.map((l) => ({
          headName: l.headName,
          includeInOverhead: Boolean(l.includeInOverhead),
          customLabel: l.customLabel || null,
          yearAmounts: l.yearAmounts.map((a) => Number(a) || 0),
        })),
        equipment: editForm.equipment.map((e) => ({ name: e.name, unit: e.unit, amount: Number(e.amount) || 0 })),
        manpower: editForm.manpower.map((m) => ({
          designation: m.designation, positions: Number(m.positions) || 1,
          hraPercent: Number(m.hraPercent) || 0,
          stipendByYear: (m.stipendByYear || []).map((s) => Number(s) || 0),
        })),
        coPis: editForm.coPis.map((c) => ({
          name: c.name,
          department: c.department,
          designation: c.designation,
          isInsideInstitute: Boolean(c.isInsideInstitute),
          instituteName: c.instituteName || null
        })),
      });
      setIsEditing(false);
      setEditForm(null);
      await load();
    } catch (err) {
      setEditError(err.message ?? 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen dark:dark:p-4 lg:p-8 animate-in fade-in duration-500">
      <div className="w-full space-y-6">
        
        {/* Navigation & Header */}
        <div className="space-y-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors w-fit"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
              <FileText size={180} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="space-y-2 w-full">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                    <FileText size={20} />
                  </span>
                  <span className="text-sm font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
                    Research Proposal
                  </span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  {proposal.title}
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                  Agency: <span className="text-slate-700 dark:text-slate-300">{proposal.agency}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-col sm:items-end sm:gap-3">
                <ProposalStatusBadge status={proposal.status} />
                <ProposalStageBadge stage={proposal.currentStage} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Details & Budget */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Expiry Countdown Widget (BRD §A1) */}
            {proposal.expiresAt && (
              <ExpiryCountdownWidget
                expiresAt={proposal.expiresAt}
                onExtend={async () => {
                  await extendProposalExpiry(proposal.id, 21);
                  await load();
                }}
              />
            )}

            {/* Resubmission Direct Routing Notice (BRD §A1) */}
            {proposal.currentStage === 'ReturnedToPI' && (
              <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-sm font-semibold flex items-center justify-between shadow-sm">
                <div>
                  <div className="font-extrabold uppercase tracking-wider text-xs text-amber-700 dark:text-amber-400 mb-1">
                    Resubmission Rule
                  </div>
                  <div>
                    This proposal was returned for revision. Resubmitting will route directly to the <strong>Dealing Assistant</strong> (skipping HOD and Dean approval).
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard icon={<FileText />} label="Type" value={PROPOSAL_TYPES[proposal.proposalType] || 'Unknown'} color="indigo" />
              <StatCard icon={<IndianRupee />} label="Proposed" value={formatCurrency(proposal.proposedAmount)} color="emerald" />
              <StatCard icon={<IndianRupee />} label="Overhead" value={formatCurrency(proposal.overheadAmount)} color="blue" />
              <StatCard icon={<IndianRupee />} label="Total" value={formatCurrency(proposal.totalAmount)} color="violet" />
              <StatCard icon={<Clock />} label="Duration" value={`${proposal.durationMonths} months`} color="amber" />
              <StatCard icon={<Calendar />} label="Created" value={formatDate(proposal.createdAt)} color="purple" />
            </div>

            {/* Co-PI summary, right under the headline stats */}
            {proposal.coPis.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Co-PI{proposal.coPis.length > 1 ? 's' : ''}:
                </span>
                {proposal.coPis.map((c, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold"
                  >
                    {c.name} <span className="text-indigo-400 dark:text-indigo-500 font-normal">· {c.department}, {c.designation}</span>
                  </span>
                ))}
              </div>
            )}


            {/* Actions Panel */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6 shadow-xl shadow-indigo-500/5 dark:shadow-none">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Available Actions</h2>
              <div className="space-y-4">
                <ProposalChainActions
                  proposal={proposal}
                  onActed={() => { void load(); }}
                  currentUserId={currentUserId}
                  lastStepActorUserId={lastStepActorUserId}
                />
                {(user?.roles ?? []).includes('Faculty') && (
                  <ProposalAgencyActions proposal={proposal} onActed={() => { void load(); }} />
                )}
              </div>
            </div>

            {/* Additional Details & Agency Progress */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-3">Agency Processing</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <Detail label="Submitted to agency on" value={formatDate(proposal.submittedToAgencyOn)} icon={<CalendarDays />} />
                <Detail label="Agency decision date" value={formatDate(proposal.agencyDecisionOn)} icon={<CheckCircle />} />
                
                {proposal.projectId && (
                  <div className="col-span-1 md:col-span-2 mt-2 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                    <div>
                      <dt className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Linked Project</dt>
                      <dd className="mt-1 font-medium text-slate-700 dark:text-slate-300">This proposal has been sanctioned and a project is active.</dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${proposal.projectId}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-md shadow-emerald-600/20"
                    >
                      Open Project <ExternalLink size={16} />
                    </button>
                  </div>
                )}
              </dl>
            </div>

            {/* Budget Summary / Edit */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
              <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {isEditing ? 'Edit Proposal' : 'Budget Summary'}
                </h2>
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={saveEditing} className="p-5 md:p-6 space-y-6">
                  {editError && (
                    <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
                      {editError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">Title</label>
                      <input required value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">Proposal Type</label>
                      <select required value={editForm.proposalType}
                        onChange={(e) => setEditForm((f) => ({ ...f, proposalType: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white text-sm">
                        <option value={1}>Type-I: Research Projects</option>
                        <option value={2}>Type-II: Industry sponsored Projects</option>
                        <option value={3}>Type-III: Consultancy Project</option>
                        <option value={4}>Type IV: Testing</option>
                        <option value={5}>Type V: Other activities</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">Agency</label>
                      <input required value={editForm.agency}
                        onChange={(e) => setEditForm((f) => ({ ...f, agency: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">Duration (months)</label>
                      <input required type="number" min="1" max="60" value={editForm.durationMonths}
                        onChange={(e) => setEditForm((f) => ({ ...f, durationMonths: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white text-sm" />
                    </div>
                  </div>

                  <ProposalBudgetMatrix
                    durationMonths={editForm.durationMonths}
                    lines={editForm.budgetLines}
                    onChange={(lines) => setEditForm((f) => ({ ...f, budgetLines: lines }))}
                    overheadPercent={editForm.overheadPercent}
                    onOverheadPercentChange={(value) => setEditForm((f) => ({ ...f, overheadPercent: value }))}
                  />

                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Equipment</h3>
                    <ProposalEquipmentFieldArray
                      items={editForm.equipment}
                      onChange={(items) => setEditForm((f) => ({ ...f, equipment: items }))}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Manpower</h3>
                    <ProposalManpowerFieldArray
                      items={editForm.manpower}
                      durationMonths={editForm.durationMonths}
                      onChange={(items) => setEditForm((f) => ({ ...f, manpower: items }))}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Co-Investigators</h3>
                    <ProposalCoPiFieldArray
                      items={editForm.coPis}
                      onChange={(items) => setEditForm((f) => ({ ...f, coPis: items }))}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={cancelEditing}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSaving}
                      className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="overflow-x-auto p-5 md:p-6">
                  <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                    <thead className="text-xs uppercase bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-bold">Budget Head</th>
                        {Array.from({ length: Math.ceil(proposal.durationMonths / 12) }, (_, i) => (
                          <th key={i} className="px-4 py-3 font-bold text-right">Year {i + 1}</th>
                        ))}
                        <th className="px-4 py-3 font-bold text-center">In Overhead</th>
                        <th className="px-4 py-3 font-bold text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {[...proposal.budgetLines]
                        .sort((a, b) => (a.headName === 'RecurringOverhead' ? 1 : 0) - (b.headName === 'RecurringOverhead' ? 1 : 0))
                        .map((line, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{line.customLabel || line.headName}</td>
                          {line.yearAmounts.map((amount, yi) => (
                            <td key={yi} className="px-4 py-3 text-right tabular-nums">{formatCurrency(amount)}</td>
                          ))}
                          <td className="px-4 py-3 text-center">{line.includeInOverhead ? '✓' : '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatCurrency(line.yearAmounts.reduce((s, a) => s + (Number(a) || 0), 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50">
                      <tr className="border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                        <td className="px-4 py-3" colSpan={Math.ceil(proposal.durationMonths / 12) + 1}>Total Proposed Budget</td>
                        <td className="px-4 py-3 text-right tabular-nums text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(proposal.proposedAmount)}</td>
                      </tr>
                      <tr className="text-slate-500 dark:text-slate-400">
                        <td className="px-4 py-3" colSpan={Math.ceil(proposal.durationMonths / 12) + 1}>Total Overhead ({proposal.overheadPercent}%)</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(proposal.overheadAmount)}</td>
                      </tr>
                      <tr className="border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                        <td className="px-4 py-3" colSpan={Math.ceil(proposal.durationMonths / 12) + 1}>Grand Total</td>
                        <td className="px-4 py-3 text-right tabular-nums text-lg text-violet-600 dark:text-violet-400">{formatCurrency(proposal.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {Math.ceil(proposal.durationMonths / 12) > 1 && proposal.overheadAmount > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Year-wise Overhead</h3>
                      <table className="text-sm border-collapse w-full ">
                        <thead>
                          <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {Array.from({ length: Math.ceil(proposal.durationMonths / 12) }, (_, i) => (
                              <th key={i} className="text-left pb-2 px-2">Year {i + 1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-slate-100 dark:border-slate-800">
                            {(() => {
                              // The RecurringOverhead row's own per-year amounts are
                              // the authoritative, server-persisted overhead breakdown
                              // -- overhead varies per year (that year's checked-lines
                              // total x percent), not one lump total split evenly.
                              const years = Math.ceil(proposal.durationMonths / 12);
                              const overheadLine = proposal.budgetLines.find((l) => l.headName === 'RecurringOverhead');
                              return Array.from({ length: years }, (_, i) => (
                                <td key={i} className="py-2 px-2 tabular-nums">
                                  {formatCurrency(Number(overheadLine?.yearAmounts[i]) || 0)}
                                </td>
                              ));
                            })()}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isEditing && (proposal.equipment.length > 0 || proposal.manpower.length > 0) && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg shadow-slate-200/40 dark:shadow-none space-y-6">
                {proposal.equipment.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">Equipment</h2>
                    <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                      <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Unit</th>
                          <th className="py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {proposal.equipment.map((e, i) => (
                          <tr key={i}>
                            <td className="py-2 pr-4">{e.name}</td>
                            <td className="py-2 pr-4">{e.unit}</td>
                            <td className="py-2 text-right tabular-nums">{formatCurrency(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {proposal.manpower.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">Manpower</h2>
                    <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                      <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2 pr-4">Designation</th>
                          <th className="py-2 pr-4">Positions</th>
                          <th className="py-2 pr-4">HRA %</th>
                          {proposal.manpower[0]?.stipendByYear.map((_, i) => (
                            <th key={i} className="py-2 pr-4 text-right">Year {i + 1} (₹/mo)</th>
                          ))}
                          <th className="py-2 text-right">Total (All Years)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {proposal.manpower.map((m, i) => {
                          const annualTotal = m.stipendByYear.reduce(
                            (sum, s, yi) => sum + m.positions * (s + (m.hraByYear[yi] ?? 0)) * 12, 0,
                          );
                          return (
                            <tr key={i}>
                              <td className="py-2 pr-4">{m.designation}</td>
                              <td className="py-2 pr-4">{m.positions}</td>
                              <td className="py-2 pr-4">{m.hraPercent}%</td>
                              {m.stipendByYear.map((s, yi) => (
                                <td key={yi} className="py-2 pr-4 text-right tabular-nums">{formatCurrency(s)}</td>
                              ))}
                              <td className="py-2 text-right tabular-nums font-semibold">{formatCurrency(annualTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!isEditing && proposal.coPis.length > 0 && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg shadow-slate-200/40 dark:shadow-none">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">Co-Investigators</h2>
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Institute</th>
                      <th className="py-2 pr-4">Department</th>
                      <th className="py-2 pr-4">Designation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {proposal.coPis.map((c, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-4">
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-semibold">
                            {c.isInsideInstitute ? 'Internal' : 'External'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-medium">{c.name}</td>
                        <td className="py-2 pr-4">{c.isInsideInstitute ? 'MNNIT Allahabad' : c.instituteName}</td>
                        <td className="py-2 pr-4">{c.department}</td>
                        <td className="py-2 pr-4">{c.designation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Timeline & Docs */}
          <div className="space-y-6">
            
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg shadow-slate-200/40 dark:shadow-none">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-3">Approval Timeline</h2>
              <ApprovalTimeline steps={steps} />
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg shadow-slate-200/40 dark:shadow-none">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Internal Queries</h2>
              <WorkflowQueryPanel
                workflowInstanceId={proposal?.workflowInstanceId}
                currentUserId={currentUserId}
                priorActors={priorActors}
              />
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg shadow-slate-200/40 dark:shadow-none">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Documents</h2>
              <DocumentUploader
                ownerType="ResearchProposal"
                ownerId={id}
                requestType="ResearchProposal"
                phase={workflow?.phase ?? 'Indent'}
                onUploaded={() => { void load(); }}
                allowDelete
                conditionallyMandatoryKinds={proposal.coPis.length > 0 ? ['CoPiConsent'] : []}
              />
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800/30',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-800/30',
  };

  return (
    <div className={`p-4 rounded-2xl border ${colorClasses[color]} flex flex-col justify-center`}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        <div className="[&>svg]:w-4 [&>svg]:h-4">{icon}</div>
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-base sm:text-lg font-extrabold truncate">{value}</div>
    </div>
  );
}

function Detail({ label, value, icon }) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 mt-0.5">
          <div className="[&>svg]:w-4 [&>svg]:h-4">{icon}</div>
        </div>
      )}
      <div>
        <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</dt>
        <dd className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</dd>
      </div>
    </div>
  );
}
