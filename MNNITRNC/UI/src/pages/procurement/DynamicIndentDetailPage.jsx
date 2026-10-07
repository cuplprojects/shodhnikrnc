import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt } from 'lucide-react';
import { getDynamicIndentDetail } from '../../api/dynamicIndentApi';
import { formatCurrency } from '../projects/utils/currency';

export default function DynamicIndentDetailPage() {
  const { indentId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getDynamicIndentDetail(indentId)
      .then((data) => { if (active) setDetail(data); })
      .catch(() => { if (active) setError('Could not load this indent.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [indentId]);

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  if (error || !detail) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'Indent not found.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft size={14} /> Back
      </button>

      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{detail.indentNumber}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{detail.purpose}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <Receipt size={20} className="text-emerald-500" />
          Budget Allocation Breakdown
        </h2>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-6">
          {detail.allocations && detail.allocations.length > 0 ? (
            <div className="space-y-4">
              {detail.allocations.map((alloc, idx) => {
                const percentage = detail.totalEstimatedCost > 0
                  ? ((alloc.amount / detail.totalEstimatedCost) * 100).toFixed(1)
                  : '0.0';
                return (
                  <div key={`${alloc.budgetHeadId}-${alloc.subHead ?? 'main'}`} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{alloc.budgetHeadName}</h4>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {percentage}% of total cost
                        </span>
                      </div>
                    </div>
                    <span className="text-md font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCurrency(alloc.amount)}
                    </span>
                  </div>
                );
              })}

              <div className="mt-6 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Total Requested</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(detail.totalEstimatedCost)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">No budget allocations found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
