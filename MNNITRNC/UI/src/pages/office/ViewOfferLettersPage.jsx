import { Files } from 'lucide-react';

export default function ViewOfferLettersPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">View Generated Offer Letters</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Browse and download previously generated offer letters.</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col items-center justify-center p-16 text-center">
        <div className="w-20 h-20 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 dark:text-cyan-400 rounded-full flex items-center justify-center mb-6">
          <Files size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Offer Letter Archive</h2>
        <p className="text-slate-500 dark:text-slate-400 w-full ">
          This area will list all generated offer letters with download options. It is currently under construction.
        </p>
      </div>
    </div>
  );
}
