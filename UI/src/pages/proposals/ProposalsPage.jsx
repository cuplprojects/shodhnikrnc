import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, AlertCircle, FileSearch, ChevronLeft, ChevronRight } from 'lucide-react';
import { listMyProposals, submitProposal, withdrawProposal } from '../../api/proposalsApi';
import { PI_ACTIONABLE_STAGES } from '../../constants/proposalEnums';
import { formatCurrency } from '../projects/utils/currency';
import ProposalStageBadge from './components/ProposalStageBadge';
import ProposalStatusBadge from './components/ProposalStatusBadge';

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

export default function ProposalsPage() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const load = useCallback(async (page) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listMyProposals(page, PAGE_SIZE);
      setProposals(result?.items ?? []);
      setTotalCount(result?.totalCount ?? 0);
      setTotalPages(result?.totalPages ?? 1);
    } catch {
      setError('Failed to load your proposals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(currentPage);
  }, [load, currentPage]);

  const runAction = async (id, action) => {
    setPendingId(id);
    try {
      await action();
      await load(currentPage);
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setPendingId(null);
    }
  };

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Compute visible page numbers (max 5 pages shown)
  const getPageNumbers = () => {
    const delta = 2;
    const pages = [];
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Research Proposals</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Your proposals and where each stands in the approval chain.
              {totalCount > 0 && !isLoading && (
                <span className="ml-2 text-indigo-500 dark:text-indigo-400 font-semibold">
                  ({totalCount} total)
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/proposals/new')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus size={18} /> New Proposal
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      ) : proposals.length === 0 && currentPage === 1 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-16 text-center flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
            <FileSearch size={36} className="text-indigo-400 dark:text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No Proposals Found</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md">
            You have not created any research proposals yet. Click the &quot;New Proposal&quot; button above to start your first draft.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-bold tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Agency</th>
                    <th className="px-6 py-4 text-right">Proposed Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Stage</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {proposals.map((p) => {
                    const canSubmit = p.status === 'Draft' && p.currentStage === 'Draft';
                    const canForward = PI_ACTIONABLE_STAGES.has(p.currentStage) && p.status !== 'Draft';
                    const canWithdraw = !['Approved', 'SubmittedToAgency', 'Sanctioned', 'Withdrawn', 'Rejected', 'NotFunded'].includes(p.status);
                    const isPending = pendingId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td
                          className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 cursor-pointer group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                          onClick={() => navigate(`/proposals/${p.id}`)}
                        >
                          {p.title}
                        </td>
                        <td className="px-6 py-4 font-medium">{p.agency}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.proposedAmount)}
                        </td>
                        <td className="px-6 py-4"><ProposalStatusBadge status={p.status} /></td>
                        <td className="px-6 py-4"><ProposalStageBadge stage={p.currentStage} /></td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{formatDate(p.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/proposals/${p.id}`)}
                              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              View
                            </button>
                            {canSubmit && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => runAction(p.id, () => submitProposal(p.id))}
                                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors shadow-sm shadow-blue-500/20"
                              >
                                Submit
                              </button>
                            )}
                            {canForward && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => navigate(`/proposals/${p.id}`)}
                                title="Review and forward from the detail page"
                                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors shadow-sm shadow-indigo-500/20"
                              >
                                Forward
                              </button>
                            )}
                            {canWithdraw && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => runAction(p.id, () => withdrawProposal(p.id))}
                                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of{' '}
                <span className="font-bold text-slate-700 dark:text-slate-200">{totalCount}</span> proposals
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-colors ${
                      pageNum === currentPage
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
