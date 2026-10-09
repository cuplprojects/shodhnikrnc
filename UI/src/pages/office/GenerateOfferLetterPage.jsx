import { FileText } from 'lucide-react';

export default function GenerateOfferLetterPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Generate Manpower Offer Letter</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create official offer letters for recruited project staff.</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col items-center justify-center p-16 text-center">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-full flex items-center justify-center mb-6">
          <FileText size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Offer Letter Generator</h2>
        <p className="text-slate-500 dark:text-slate-400 w-full ">
          This area will house the form to generate and preview manpower offer letters. It is currently under construction.
        </p>
      </div>
    </div>
  );
}
