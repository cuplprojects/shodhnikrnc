import { useState } from 'react';
import { CreditCard, Search, Filter, FileText, Edit2, X, Check } from 'lucide-react';
import { formatCurrency } from '../projects/utils/currency';

export default function UpdatePaymentPage() {
  // Static placeholder until these pages are wired to the workflow API.
  const [requests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Only the setter is used; the selection is tracked but not yet rendered.
  const [, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({
    utrNumber: '',
    paymentDate: '',
    miscellaneousExpenditure: '',
    remarks: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openUpdateModal = (request) => {
    setSelectedRequest(request);
    setFormData({
      utrNumber: '',
      paymentDate: new Date().toISOString().split('T')[0],
      miscellaneousExpenditure: '',
      remarks: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  const handleUpdatePayment = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // API Call would go here
    setTimeout(() => {
      setIsSubmitting(false);
      closeModal();
    }, 800);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-xl text-teal-600 dark:text-teal-400">
              <CreditCard size={22} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Update Payment Details
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl">
            Record and manage payment reference numbers (UTR) and statuses for approved requests.
          </p>
        </div>
      </div>
      
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by project or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block pl-9 p-2 transition-all shadow-sm"
          />
        </div>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter size={16} className="text-slate-400" />
          </div>
          <select
            className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block pl-9 pr-10 p-2 transition-all shadow-sm cursor-pointer"
          >
            <option value="ALL">All Request Types</option>
            <option value="consumable">Consumable</option>
            <option value="contingency">Contingency</option>
            <option value="equipment">Equipment</option>
            <option value="travel">Travel</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Request Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileText size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                      <p className="text-lg font-medium text-slate-600 dark:text-slate-300">No Pending Payments</p>
                      <p className="text-sm mt-1">There are no approved requests pending payment updates.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title={request.project}>
                      {request.project}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {request.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 truncate max-w-[300px]" title={request.description}>
                      {request.description}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(request.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => openUpdateModal(request)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors text-xs shadow-sm"
                      >
                        <Edit2 size={14} /> Update Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard size={20} className="text-teal-600 dark:text-teal-400" /> 
                Update Payment
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Reference No. (UTR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.utrNumber}
                  onChange={(e) => setFormData({...formData, utrNumber: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white text-sm"
                  placeholder="e.g. UTR123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Miscellaneous Expenditure (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.miscellaneousExpenditure}
                  onChange={(e) => setFormData({...formData, miscellaneousExpenditure: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Remarks / Notes
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white text-sm min-h-[100px] resize-y"
                  placeholder="Any additional details..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors text-sm"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check size={16} />
                  )}
                  {isSubmitting ? 'Updating...' : 'Update Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
