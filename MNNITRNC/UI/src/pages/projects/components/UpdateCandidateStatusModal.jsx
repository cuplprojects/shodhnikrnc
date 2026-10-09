import { useState } from 'react';
import { X, Check, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';

/// Mounting the form only while open resets it on every open for free; the
/// effect that re-zeroed the fields fired an extra render each time.
export default function UpdateCandidateStatusModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return <UpdateCandidateStatusForm onClose={onClose} />;
}

function UpdateCandidateStatusForm({ onClose }) {
  const [activeTab, setActiveTab] = useState('resignation');
  const [formData, setFormData] = useState({
    candidateId: '',
    effectiveDate: ''
  });

  // Mock candidates
  const candidates = [
    { id: 1, name: 'John Doe - JRF' },
    { id: 2, name: 'Jane Smith - SRF' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.error("Updating Candidate Status requires a registered Candidate ID from the backend database. This standalone modal is incompatible with the new backend.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
              <UserMinus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Update Candidate Status</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Process resignation or termination of a candidate.</p>
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
          
          {/* Tabs */}
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('resignation')}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'resignation'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Resignation
            </button>
            <button
              onClick={() => setActiveTab('termination')}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'termination'
                  ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Termination
            </button>
          </div>

          <form id="updateStatusForm" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Candidate <span className="text-red-500">*</span></label>
                <select 
                  required 
                  name="candidateId" 
                  value={formData.candidateId} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                >
                  <option value="">-- Select Candidate --</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Effective Date (w.e.f.) <span className="text-red-500">*</span></label>
                <input required type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${activeTab === 'resignation' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'}`}>
              <p className={`text-sm ${activeTab === 'resignation' ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'}`}>
                {activeTab === 'resignation' 
                  ? "This is to inform that the candidate's resignation has been accepted by the competent authority."
                  : "This is to inform that the candidate's termination has been done through proper channel duly approved by the competent authority."
                }
              </p>
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
            form="updateStatusForm"
            className={`flex items-center gap-2 px-6 py-2.5 text-white text-sm font-bold rounded-lg shadow-md active:scale-95 transition-all ${
              activeTab === 'resignation' 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' 
                : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
            }`}
          >
            <Check size={16} /> Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
}
