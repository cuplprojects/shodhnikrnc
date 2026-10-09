import { useState, useEffect } from 'react';
import { X, Check, FileText } from 'lucide-react';

export default function GenerateSelectionProformaModal({ isOpen, onClose, project, manpower, onGenerateComplete }) {
  const [formData, setFormData] = useState({
    coPi: ''
  });

  useEffect(() => {
    let mounted = true;
    if (isOpen) {
      const loadCached = async () => {
        try {
          const { getOrCreateRecruitment } = await import('../utils/recruitmentHelper');
          const { getDocumentData } = await import('../../../api/recruitmentApi');
          const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
          const cached = await getDocumentData(recId, 'SelectionProforma');
          const defaultCoPi = project?.collaborators?.map(c => c.faculty).filter(Boolean).join(', ') || '';
          if (mounted) {
            setFormData({
              coPi: cached?.coPi || defaultCoPi
            });
          }
        } catch (e) {
          console.log("No cached selection proforma data found", e);
          const defaultCoPi = project?.collaborators?.map(c => c.faculty).filter(Boolean).join(', ') || '';
          if (mounted) {
            setFormData({ coPi: defaultCoPi });
          }
        }
      };
      loadCached();
    }
    return () => { mounted = false; };
  }, [isOpen, project?.id, manpower?.id]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onGenerateComplete) {
      onGenerateComplete({ coPi: formData.coPi });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Generate Selection Committee Proforma</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Fill out the details for the selection committee proforma.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="selectionProformaForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Read-Only Pre-filled Info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Project Title</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {project?.projectTitle || 'N/A'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agency</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {project?.agency || 'N/A'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Designation</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {manpower?.designation || 'N/A'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Principal Investigator</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {project?.piName || 'Dr. Faculty Test'}
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Co-PI (if any)</label>
                  <input type="text" name="coPi" value={formData.coPi} onChange={handleChange} placeholder="Optional" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>
              </div>
            </div>
            
          </form>
        </div>

        {/* Footer */}
        <div className="flex-none p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 z-10">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="selectionProformaForm"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Check size={16} /> Generate Proforma
          </button>
        </div>
      </div>
    </div>
  );
}
