import { useCallback, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, ExternalLink, Eye } from 'lucide-react';
import {
  listPendingReappropriations,
  forwardReappropriation,
  approveReappropriation,
  rejectReappropriation,
  returnReappropriation,
} from '../../api/projectsApi';
import { formatCurrency } from './utils/currency';
import ReappropriationWorkflowModal from './components/ReappropriationWorkflowModal';
import toast from 'react-hot-toast';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

const ACTIONS_BY_STAGE = {
  ReappropriationWithHOD: ['Forward'],
  ReappropriationWithDA: ['Forward', 'Reject', 'Return'],
  ReappropriationWithSuperintendent: ['Forward', 'Reject', 'Return'],
  ReappropriationWithDR: ['Forward', 'Reject', 'Return'],
  ReappropriationWithDean: ['Approve', 'Reject', 'Return'],
};

const ACTION_LABELS = { Forward: 'Forward', Approve: 'Approve', Reject: 'Reject', Return: 'Return to PI' };
const ACTION_STYLES = {
  Forward: 'bg-blue-600 hover:bg-blue-700',
  Approve: 'bg-emerald-600 hover:bg-emerald-700',
  Reject: 'bg-rose-600 hover:bg-rose-700',
  Return: 'bg-amber-500 hover:bg-amber-600',
};
const ACTION_CALL = {
  Forward: forwardReappropriation, Approve: approveReappropriation,
  Reject: rejectReappropriation, Return: returnReappropriation,
};

function RowActions({ req, onActed }) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actions = ACTIONS_BY_STAGE[req.currentStage] ?? [];
  if (req.status !== 'PendingApproval' || actions.length === 0) {
    return <span className="text-xs text-slate-400 italic">Awaiting the next approver. (Stage: {req.currentStage}, Status: {req.status})</span>;
  }

  const run = async (action) => {
    if (isSubmitting) return;

    if ((action === 'Return' || action === 'Reject') && !remarks.trim()) {
      toast.error(`A remark is required to ${action.toLowerCase()} this request.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await ACTION_CALL[action](req.projectId, req.id, remarks);
      setRemarks('');
      onActed?.();
    } catch {
      // Handled globally
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <input
        type="text"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Remarks (required for Reject/Return)"
        disabled={isSubmitting}
        className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
      />
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={isSubmitting}
            onClick={() => run(action)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors ${ACTION_STYLES[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReappropriationQueuePage() {
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedReq, setSelectedReq] = useState(null);
  const isFirstLoad = useRef(true);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'pending') {
        const data = await listPendingReappropriations();
        setRequests(data ?? []);
        // Automatically switch to history if there are no pending actions, but only on first load
        if (data && data.length === 0 && isFirstLoad.current) {
          setActiveTab('history');
        }
      } else {
        const { listHistoryReappropriations } = await import('../../api/projectsApi');
        const data = await listHistoryReappropriations();
        setHistory(data ?? []);
      }
    } catch {
      if (activeTab === 'pending') setRequests([]);
      else setHistory([]);
    } finally {
      setIsLoading(false);
      isFirstLoad.current = false;
    }
  }, [activeTab]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const currentList = activeTab === 'pending' ? requests : history;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <FileSearch size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Budget Reappropriations</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Track and manage budget redistribution requests.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-px">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Pending Actions
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          History
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[60vh]">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Sources / Destinations</th>
                <th className="px-6 py-4">Reason</th>
                {activeTab === 'pending' ? (
                  <th className="px-6 py-4 bg-slate-100/50 dark:bg-slate-800">Action</th>
                ) : (
                  <th className="px-6 py-4 bg-slate-100/50 dark:bg-slate-800">Status</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium animate-pulse">
                    Loading requests...
                  </td>
                </tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-500">
                    <div className="w-full space-y-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                        <FileSearch size={32} />
                      </div>
                      <p className="font-semibold text-base text-slate-600 dark:text-slate-300">
                        {activeTab === 'pending' ? 'All caught up!' : 'No history found.'}
                      </p>
                      <p className="text-sm">
                        {activeTab === 'pending' ? 'No reappropriation requests are waiting in your queue.' : 'You have not acted on any reappropriation requests yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentList.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 align-top">
                      <Link
                        to={`/projects/${req.projectId}`}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 w-max"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {req.projectSanctionNo || req.projectId.substring(0, 8)} <ExternalLink size={14} />
                      </Link>
                      <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">
                        {req.projectTitle || 'Loading...'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold align-top">
                      {formatDate(req.createdAt)}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Sources:</span>
                          {req.sources?.map((s, i) => (
                            <div key={i} className="flex justify-between gap-4 ml-2 text-rose-600 dark:text-rose-400">
                              <span>- {s.headName}</span>
                              <span className="font-medium">{formatCurrency(s.amount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Destinations:</span>
                          {req.destinations?.map((d, i) => (
                            <div key={i} className="flex justify-between gap-4 ml-2 text-emerald-600 dark:text-emerald-400">
                              <span>+ {d.headName}</span>
                              <span className="font-medium">{formatCurrency(d.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 w-full align-top">
                      {req.reason}
                    </td>
                    <td className="px-6 py-4 align-top bg-slate-50/30 dark:bg-slate-800/30">
                      <div className="flex flex-col gap-3">
                        {activeTab === 'pending' ? (
                          <RowActions req={req} onActed={loadRequests} />
                        ) : (
                          <div className="text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              {req.status}
                            </span>
                            <span className="text-slate-500">
                              Stage: {req.currentStage}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => setSelectedReq(req)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors w-full"
                        >
                          <Eye size={16} /> View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {selectedReq && (
        <ReappropriationWorkflowModal
          req={selectedReq}
          isOpen={!!selectedReq}
          onClose={() => setSelectedReq(null)}
          onUpdated={() => {
            setSelectedReq(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}
