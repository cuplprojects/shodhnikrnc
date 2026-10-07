import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, FileSearch } from 'lucide-react';
import { listAdvertisementRnCQueue } from '../../api/recruitmentApi';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

export default function RncOfficeAdvertisementsPage() {
  const navigate = useNavigate();

  const [recruitments, setRecruitments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setRecruitments(await listAdvertisementRnCQueue() ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    load()
      .catch(() => { if (active) setError('Failed to load the R&C office advertisement queue.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [load]);

  return (
    <div className="min-h-screen dark:dark:p-4 lg:p-8 animate-in fade-in duration-500">
      <div className="w-full space-y-6">
        <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Building2 size={24} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">R&C Office Advertisements</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium ml-14">
            Advertisements awaiting the R&C office's action in the approval chain (PI &rarr; RnC Office &rarr; Computer Centre).
          </p>
        </div>

        {isLoading ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 font-medium shadow-sm animate-pulse">
            Loading queue...
          </div>
        ) : error ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-rose-200/50 dark:border-rose-900/50 rounded-2xl p-12 text-center text-rose-500 dark:text-rose-400 font-medium shadow-sm">
            {error}
          </div>
        ) : recruitments.length === 0 ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-16 text-center flex flex-col items-center shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
              <FileSearch size={36} className="text-indigo-400 dark:text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Queue is Empty</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium w-full ">No advertisements are currently waiting in the R&C office queue.</p>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Project</th>
                    <th className="px-6 py-4 font-bold">Position</th>
                    <th className="px-6 py-4 font-bold">Round</th>
                    <th className="px-6 py-4 font-bold">Closing Date</th>
                    <th className="px-6 py-4 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recruitments.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/recruitments/${r.id}`)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {r.projectTitle || '-'}
                      </td>
                      <td className="px-6 py-4 font-medium">{r.designation || '-'}</td>
                      <td className="px-6 py-4">{r.advertisementRound}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{formatDate(r.closingDate)}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
