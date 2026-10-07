import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyRecruitments } from '../api/recruitmentApi';
import RecruitmentList from './recruitment/components/RecruitmentList';

/**
 * The PI's recruitments across all of their projects. Recruitment is always
 * started from a project's sanctioned manpower position (ProjectDetailPage's
 * "Start recruitment" flow) -- there is no standalone create-without-a-
 * project path, so this page is a landing list into the real screening/
 * selection work on RecruitmentDetailPage, not a place to start one.
 */
export default function RecruitmentPage() {
  const navigate = useNavigate();
  const [recruitments, setRecruitments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => listMyRecruitments(), []);

  useEffect(() => {
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsLoading(true);
    setError(null);
    load()
      .then((rows) => { if (active) setRecruitments(rows ?? []); })
      .catch(() => { if (active) setError('Failed to load recruitments.'); })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Recruitment</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Your recruitment drives, across every project. Start one from a project's sanctioned positions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/recruitment/manage')}
            className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm"
          >
            Advertisement Templates
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 text-sm"
          >
            Go to Projects
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading recruitments…</div>
      ) : error ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">{error}</div>
      ) : (
        <RecruitmentList
          recruitments={recruitments}
          onSelect={(r) => navigate(`/recruitments/${r.id}`)}
          emptyMessage="No recruitment raised yet. Start one from a project's sanctioned manpower positions."
        />
      )}
    </div>
  );
}
