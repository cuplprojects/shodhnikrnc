import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Users } from 'lucide-react';
import { hodManual } from './hodManualData';
import { facultyManual } from './facultyManualData';

const decks = [
  {
    to: '/manual/faculty',
    icon: GraduationCap,
    title: 'Faculty User Manual',
    subtitle: facultyManual.subtitle,
    count: facultyManual.slides.length,
  },
  {
    to: '/manual/hod',
    icon: Users,
    title: 'HOD User Manual',
    subtitle: hodManual.subtitle,
    count: hodManual.slides.length,
  },
];

export default function ManualPickerPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-600 text-white mb-4">
            <BookOpen size={28} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">MNNIT R&C Portal Manuals</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Screenshot-based, step-by-step walkthroughs. Pick a role to begin.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {decks.map(({ to, icon: Icon, title, subtitle, count }) => (
            <Link
              key={to}
              to={to}
              className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition p-6 flex flex-col"
            >
              <div className="h-11 w-11 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                <Icon size={22} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 flex-1">{subtitle}</p>
              <span className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                {count} steps &rarr;
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
