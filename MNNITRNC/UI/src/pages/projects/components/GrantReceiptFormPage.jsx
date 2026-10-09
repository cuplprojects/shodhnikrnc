import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Wallet, Check, AlertCircle, Calendar, ArrowLeft } from 'lucide-react';
import { getProject, recordGrantReceipt } from '../../../api/projectsApi';
import { BUDGET_HEAD_NAMES, OVERHEAD_HEAD_VALUE, getBudgetHeadDisplay } from '../../../constants/projectEnums';
import { ApiError } from '../../../api/apiClient';
import OverheadSplitInputs from './OverheadSplitInputs';

const FIELD_CLASS = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800";
const LABEL_CLASS = "text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5";

export default function GrantReceiptFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [budgetHeadId, setBudgetHeadId] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [amount, setAmount] = useState('');
  const [overheadSplit, setOverheadSplit] = useState({});
  const [projectYear, setProjectYear] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const remarksBlank = !remarks.trim();

  useEffect(() => {
    getProject(id)
      .then((data) => {
        setProject(data);
        if (data.budgetHeads.length > 0) {
          setBudgetHeadId(data.budgetHeads[0].id);
        }
      })
      .catch(() => setError('Failed to load project.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const selectedHead = project?.budgetHeads.find((h) => h.id === budgetHeadId);
  const isOverheadHead = selectedHead?.headName === OVERHEAD_HEAD_VALUE;

  const maxProjectYear = project?.durationMonths
    ? Math.max(1, Math.min(5, Math.ceil(project.durationMonths / 12)))
    : 5;
  const projectYearOptions = Array.from({ length: maxProjectYear }, (_, i) => i + 1);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await recordGrantReceipt(id, {
        budgetHeadId,
        receivedDate,
        amount: Number(amount),
        overheadSplit: isOverheadHead ? overheadSplit : null,
        projectYear: projectYear === '' ? null : Number(projectYear),
        transactionReference: `NEFT-${Date.now()}`,
        paymentMode: 'Neft',
        remarks,
      });
      navigate(`/projects/${id}`, { state: { grantReceiptSubmitted: true } });
    } catch (err) {
      if (err instanceof ApiError) {
        // Error is shown via the global toast notification
      } else {
        setError('Failed to record grant receipt.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 flex items-center gap-2">
        <AlertCircle size={20} />
        <span className="font-medium">{error ?? 'Project not found.'}</span>
      </div>
    );
  }

  const isProjectApproved = project?.status === 'Approved' || project?.status === 'Active';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Record Grant Receipt</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {project.projectTitle}
            </p>
          </div>
        </div>
        <button 
          onClick={() => navigate(`/projects/${id}`)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Project
        </button>
      </div>

      {!isProjectApproved && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="font-medium">
            Grant receipts cannot be recorded until the project is approved by the Dean (Current status: <span className="font-bold">{project.status}</span>).
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={LABEL_CLASS}>Project Year</label>
            <select
              value={projectYear}
              onChange={(e) => setProjectYear(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">Not set — use Received Date below</option>
              {projectYearOptions.map((year) => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-start gap-1">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {projectYear === ''
                ? 'The Received Date below determines which project year this receipt counts against.'
                : `This receipt will be recorded and validated against the start of Year ${projectYear}, not the Received Date.`}
            </p>
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLASS}>Budget Head <span className="text-red-500">*</span></label>
            <select
              value={budgetHeadId}
              onChange={(e) => setBudgetHeadId(e.target.value)}
              className={FIELD_CLASS}
            >
              {project.budgetHeads.map((h) => (
                <option key={h.id} value={h.id}>{getBudgetHeadDisplay(h.headName, h.customLabel)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-2">
            <label className={LABEL_CLASS}>Received Date <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                min={project.submittedToAgencyOn || undefined}
                className={FIELD_CLASS}
              />
            </div>
            
          </div>

          <div className="space-y-2">
            <label className={LABEL_CLASS}>Amount (₹) <span className="text-red-500">*</span></label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${FIELD_CLASS} font-mono`}
            />
          </div>
        </div>

        {isOverheadHead && (
          <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Overhead Split Distribution</h3>
            <OverheadSplitInputs overheadAmount={amount} split={overheadSplit} onChange={setOverheadSplit} />
          </div>
        )}

        <div className="space-y-3 w-full pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className={LABEL_CLASS}>
            Remarks <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows="3"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="A remark is required to record a grant receipt (e.g. Reference numbers, notes, etc.)"
            className={`${FIELD_CLASS} resize-none ${remarksBlank && remarks.length > 0 ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
          />
          {remarksBlank && (
            <p className="text-[13px] font-medium text-red-500 mt-1">A remark is required to record a grant receipt.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/projects/${id}`)}
            className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !budgetHeadId || remarksBlank || !isProjectApproved}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Check size={20} />
            )}
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
