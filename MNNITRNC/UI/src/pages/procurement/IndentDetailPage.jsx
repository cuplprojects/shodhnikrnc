import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Package } from 'lucide-react';
import { getIndent } from '../../api/procurementApi';
import { getWorkflowInstance } from '../../api/workflowApi';
import { PROCUREMENT_TIERS, WORKFLOW_STAGE_LABELS, INDENT_TYPES } from '../../constants/procurementEnums';
import { formatCurrency } from '../projects/utils/currency';
import ApprovalTimeline from '../../components/ApprovalTimeline';
import DocumentUploader from '../../components/DocumentUploader';
// import ProcessBillForm from './components/ProcessBillForm';
import IndentChainActions from './components/IndentChainActions';

const STAGE_STYLES = {
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  Rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  Cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  Raised: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
};

const DEFAULT_STAGE_STYLE =
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

export default function IndentDetailPage() {
  const { indentType, indentId } = useParams();
  const navigate = useNavigate();

  const [indent, setIndent] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isKnownType = INDENT_TYPES.some((t) => t.value === indentType);

  const load = async () => {
    const indentData = await getIndent(indentType, indentId);
    setIndent(indentData);
    if (indentData?.workflowInstanceId) {
      const instance = await getWorkflowInstance(indentData.workflowInstanceId).catch(() => null);
      setWorkflow(instance);
    }
    return indentData;
  };

  useEffect(() => {
    if (!isKnownType) return undefined;

    let active = true;
    // Fetch on mount: every write happens in a promise callback after an await,
    // not synchronously during the effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    load()
      .catch(() => { if (active) setError('Failed to load the indent.'); })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indentType, indentId]);

  // Derived rather than pushed into state from the effect: an unrecognised route
  // segment is knowable during render.
  if (!isKnownType) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">Unknown indent type “{indentType}”.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading indent…</div>;
  }

  if (error || !indent) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">{error ?? 'Indent not found.'}</p>
      </div>
    );
  }

  const tier = PROCUREMENT_TIERS[indent.tier];
  const stageStyle = STAGE_STYLES[indent.currentStage] ?? DEFAULT_STAGE_STYLE;

  // The server refuses to process a bill until the indent itself is approved.
  const canProcessBill = workflow?.phase === 'Indent' && (workflow?.currentStage === 'Approved' || workflow?.currentStage === 'IndentApproved');

  const steps = workflow?.steps ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button
        onClick={() => navigate(`/projects/${indent.projectId}`)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Back to project
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Package size={22} />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {indent.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {indentType}
              </span>
              {tier && (
                <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded" title={tier.label}>
                  {tier.annexure}
                </span>
              )}
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${stageStyle}`}>
                {WORKFLOW_STAGE_LABELS[indent.currentStage] ?? indent.currentStage}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Estimated Cost
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(indent.estimatedCost)}
            </p>
          </div>
        </div>

        {tier && (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            {tier.label} — GeM availability:{' '}
            <span className="font-semibold">{indent.gemAvailability}</span>
          </p>
        )}
      </div>

      {/* BRD A7.2 HOD Stamp & Seal Workflow Card */}
      <div className="dark:dark:rounded-2xl border border-blue-200 dark:border-blue-800/60 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide flex items-center gap-2">
            <FileText size={18} className="text-blue-600 dark:text-blue-400" />
            Indent Form Sign & Seal Process
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
            Mandatory Step
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
          The indent form is raised online. The generated form must be <strong>downloaded</strong>, signed and stamped with official seal by both the <strong>Indenter</strong> and <strong>HOD</strong>, and then re-uploaded under the Documents section below as <em>Signed Indent Copy</em>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
              Approval Timeline
            </h2>
            <ApprovalTimeline steps={steps} />
          </div>
          <IndentChainActions
            indentType={indentType}
            indentId={indentId}
            workflowInstance={workflow}
            indent={indent}
            onActed={() => { void load(); }}
          />
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-slate-500 dark:text-slate-400" />
            Documents
          </h2>
          <DocumentUploader
            ownerType={`${indentType}Indent`}
            ownerId={indentId}
            requestType={indentType}
            phase={workflow?.phase ?? 'Indent'}
            onUploaded={() => { void load(); }}
          />
        </section>
      </div>

      {/* {canProcessBill && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <ProcessBillForm
            indentType={indentType}
            indent={indent}
            onProcessed={() => { void load(); }}
          />
        </section>
      )} */}
    </div>
  );
}
