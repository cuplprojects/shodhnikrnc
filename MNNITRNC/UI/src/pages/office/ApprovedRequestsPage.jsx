import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Search, Filter, FileText, ChevronDown, RefreshCw } from 'lucide-react';
import { listAllProcurementIndents } from '../../api/procurementApi';
import { formatCurrency } from '../projects/utils/currency';

export default function ApprovedRequestsPage() {
  const navigate = useNavigate();
  const [indents, setIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const fetchIndents = async () => {
    setIsLoading(true);
    try {
      const data = await listAllProcurementIndents();
      setIndents(data ?? []);
    } catch (err) {
      console.error("Failed to load approved requests", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIndents();
  }, []);

  const toggleDropdown = (id) => {
    setOpenDropdownId(openDropdownId === id ? null : id);
  };

  const filteredIndents = useMemo(() => {
    return indents.filter((item) => {
      const isApproved = item.currentStage === 'Approved' || item.currentStage === 'IndentApproved';
      if (!isApproved) return false;

      const matchesCat = selectedCategory === 'ALL' || item.indentType?.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (item.itemName && item.itemName.toLowerCase().includes(q)) ||
        (item.projectTitle && item.projectTitle.toLowerCase().includes(q)) ||
        (item.indenterName && item.indenterName.toLowerCase().includes(q)) ||
        (item.id && item.id.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [indents, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
              <CheckSquare size={22} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Approved Requests
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl">
            Review requests that have been approved by the competent authority (Dean / Director).
          </p>
        </div>
        <button
          onClick={fetchIndents}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Loading..." : "Refresh List"}
        </button>
      </div>
      
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by project, item description, PI..."
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
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block pl-9 pr-10 p-2 transition-all shadow-sm cursor-pointer"
          >
            <option value="ALL">All Request Types</option>
            <option value="consumable">Consumable</option>
            <option value="contingency">Contingency</option>
            <option value="equipment">Equipment</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[380px] pb-36">
        <div className="overflow-visible">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Request Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Amount (₹)</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <RefreshCw size={24} className="mx-auto animate-spin mb-2 text-emerald-500" />
                    <p className="text-xs font-semibold">Loading approved requests...</p>
                  </td>
                </tr>
              ) : filteredIndents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileText size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                      <p className="text-lg font-medium text-slate-600 dark:text-slate-300">No Approved Requests Found</p>
                      <p className="text-sm mt-1">There are currently no approved requests matching your search.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIndents.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title={request.projectTitle}>
                      {request.projectTitle || 'Research Project'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {request.indentType || 'Consumable'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[250px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={request.itemName}>{request.itemName}</span>
                      <span className="text-[11px] text-slate-400">PI: {request.indenterName}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(request.estimatedCost)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                        Approved
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => toggleDropdown(request.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-xs shadow-sm"
                        >
                          Action <ChevronDown size={14} />
                        </button>
                        
                        {openDropdownId === request.id && (
                          <>
                            <div className="fixed inset-0 z-[9990]" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[9999] py-1 overflow-hidden animate-in fade-in duration-150">
                              <button 
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  navigate(`/procurement/indents/${(request.indentType || 'Consumable').toLowerCase()}/${request.id}`);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2"
                              >
                                <FileText size={14} className="text-emerald-500" /> View Indent & Process Bill
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
