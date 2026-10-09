import {
  RECRUITMENT_STAGES,
  RECRUITMENT_STAGE_STYLES,
  DEFAULT_STAGE_STYLE,
} from '../../../constants/recruitmentEnums';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

export default function RecruitmentList({
  recruitments,
  positionsById = {},
  onSelect,
  emptyMessage = 'No recruitment raised yet',
}) {
  if (!recruitments || recruitments.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        <p className="text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-bold tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-5 py-4 w-16 text-center">S.No</th>
              <th className="px-5 py-4">Position</th>
              <th className="px-5 py-4 text-center">Project </th>
              <th className="px-5 py-4 text-center">Applicants</th>
              <th className="px-5 py-4">Stage</th>
              <th className="px-5 py-4">Raised</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {recruitments.map((r, i) => {
            const style = RECRUITMENT_STAGE_STYLES[r.stage] ?? DEFAULT_STAGE_STYLE;
            const position = positionsById[r.sanctionedManpowerPositionId];

            return (
              <tr
                key={r.id}
                onClick={() => onSelect?.(r)}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${onSelect ? 'cursor-pointer' : ''}`}
              >
                <td className="px-5 py-4 text-center text-slate-400">{i + 1}</td>
                <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">
                  {r.designation ?? position?.designation ?? 'Research Staff'}
                </td>
                <td className="px-5 py-4 text-center">
                  {r.projectTitle.length > 70 ? r.projectTitle.slice(0, 70) + '...' : r.projectTitle}
                </td>
                <td className="px-5 py-4 text-center">{r.candidateCount}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${style}`}>
                    {RECRUITMENT_STAGES[r.stage] ?? r.stage}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(r.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
