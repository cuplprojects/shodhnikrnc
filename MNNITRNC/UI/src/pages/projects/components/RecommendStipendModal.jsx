import { useState } from 'react';
import { X, Check, Banknote, Calendar } from 'lucide-react';

/// Mounting the form only while open resets it on every open for free; the
/// effect that re-zeroed the fields fired an extra render each time.
export default function RecommendStipendModal({ isOpen, onClose, manpower }) {
  if (!isOpen) return null;

  return <RecommendStipendForm onClose={onClose} manpower={manpower} />;
}

function RecommendStipendForm({ onClose, manpower }) {
  // We mock the candidates since we don't have real backend data
  const candidates = [
    { id: 1, name: 'John Doe', stipend: 31000 },
    { id: 2, name: 'Jane Smith', stipend: 35000 }
  ];

  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [formData, setFormData] = useState({
    recommendedStipend: '',
    leavesBeyondSanctioned: '',
    yearlyLeaves: '',
    totalLeavesTaken: '',
    hra: '',
    fromDate: '',
    toDate: '',
    remarks: ''
  });

  // Derived state
  const currentStipend = selectedCandidateId ? candidates.find(c => c.id === parseInt(selectedCandidateId))?.stipend : 0;
  const finalAmount = parseFloat(formData.recommendedStipend || 0) + parseFloat(formData.hra || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Recommending Stipend...', { candidateId: selectedCandidateId, ...formData });
    // TODO: Wire to backend API
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Banknote size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Recommend Stipend</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Recommend stipend and track leave history for a candidate.</p>
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
          
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Selected Position</label>
                <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
                  {manpower?.designation || 'None'}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Candidate <span className="text-red-500">*</span></label>
                <select 
                  value={selectedCandidateId} 
                  onChange={(e) => setSelectedCandidateId(e.target.value)} 
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                >
                  <option value="">-- Select Candidate --</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedCandidateId && (
            <div className="space-y-8 animate-in slide-in-duration-300">
              
              {/* Stipend History Table - Mocked for UI */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" /> Stipend Recommendation History
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 uppercase border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3">Recommended Stipend (₹)</th>
                        <th className="px-4 py-3">Leaves Beyond Sanctioned</th>
                        <th className="px-4 py-3">HRA (₹)</th>
                        <th className="px-4 py-3">Final Amount (₹)</th>
                        <th className="px-4 py-3">From Date</th>
                        <th className="px-4 py-3">To Date</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-300 font-medium">{currentStipend}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">0</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">5000</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-300 font-medium text-blue-600 dark:text-blue-400">{currentStipend + 5000}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">2023-01-01</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">2023-12-31</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-500 italic">Initial setup</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendation Form */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4">New Recommendation</h4>
                <form id="recommendStipendForm" onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Stipend (₹)</label>
                      <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-mono">
                        {currentStipend}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recommended Stipend (₹) <span className="text-red-500">*</span></label>
                      <input required type="number" min="0" step="0.01" name="recommendedStipend" value={formData.recommendedStipend} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leaves Beyond Sanctioned <span className="text-red-500">*</span></label>
                      <input required type="number" min="0" name="leavesBeyondSanctioned" value={formData.leavesBeyondSanctioned} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Yearly leaves during period <span className="text-red-500">*</span></label>
                      <input required type="number" min="0" name="yearlyLeaves" value={formData.yearlyLeaves} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total leaves taken <span className="text-red-500">*</span></label>
                      <input required type="number" min="0" name="totalLeavesTaken" value={formData.totalLeavesTaken} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">HRA (₹) <span className="text-red-500">*</span></label>
                      <input required type="number" min="0" step="0.01" name="hra" value={formData.hra} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1 lg:col-start-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Effective From Date <span className="text-red-500">*</span></label>
                      <input required type="date" name="fromDate" value={formData.fromDate} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Effective To Date <span className="text-red-500">*</span></label>
                      <input required type="date" name="toDate" value={formData.toDate} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Final Amount (₹)</label>
                      <div className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 font-bold font-mono">
                        {finalAmount.toFixed(2)}
                      </div>
                    </div>

                    <div className="space-y-1 md:col-span-2 lg:col-span-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                      <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="2" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white custom-scrollbar"></textarea>
                    </div>

                  </div>
                </form>
              </div>

            </div>
          )}
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
            form="recommendStipendForm"
            disabled={!selectedCandidateId}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Check size={16} /> Submit Recommendation
          </button>
        </div>
      </div>
    </div>
  );
}
