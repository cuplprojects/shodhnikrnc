import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Check, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from './projects/utils/currency';
import { listProjects, getProject, recordGrantReceipt, listGrantReceipts } from '../api/projectsApi';
import { getBudgetHeadDisplay } from '../constants/projectEnums';

export default function AddGrantReceivedPage() {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [schemeCode, setSchemeCode] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [grants, setGrants] = useState({});
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ProjectService.RecordGrantReceiptAsync throws WorkflowTransitionException
  // when remarks is null/whitespace -- gate Save here too so the user sees
  // why the action is blocked instead of a failed request.
  const remarksBlank = !remarks.trim();

  const [projects, setProjects] = useState([]);
  const [budgetHeads, setBudgetHeads] = useState([]);
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectDurationMonths, setProjectDurationMonths] = useState(0);
  const [existingReceipts, setExistingReceipts] = useState([]);
  const [isLoadingHeads, setIsLoadingHeads] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    listProjects()
      .then(data => setProjects(data || []))
      .catch(err => console.error("Failed to fetch projects", err));
  }, []);

  // Fetch project details & existing grant receipts when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setBudgetHeads([]);
      setExistingReceipts([]);
      setProjectStartDate('');
      setProjectDurationMonths(0);
      return;
    }

    setIsLoadingHeads(true);
    Promise.all([
      getProject(selectedProjectId),
      listGrantReceipts(selectedProjectId).catch(() => [])
    ])
      .then(([projectData, receipts]) => {
        setBudgetHeads(projectData?.budgetHeads || []);
        setProjectStartDate(projectData?.startDate || '');
        setProjectDurationMonths(projectData?.durationMonths || 12);
        setExistingReceipts(receipts || []);
      })
      .catch(err => console.error("Failed to fetch project details", err))
      .finally(() => setIsLoadingHeads(false));
  }, [selectedProjectId]);

  const getReceiptYear = (startDate, receivedDateStr) => {
    if (!startDate || !receivedDateStr) return 1;
    const sDate = new Date(startDate);
    const rDate = new Date(receivedDateStr);
    const sFy = sDate.getMonth() >= 3 ? sDate.getFullYear() : sDate.getFullYear() - 1;
    const rFy = rDate.getMonth() >= 3 ? rDate.getFullYear() : rDate.getFullYear() - 1;
    return Math.max(1, rFy - sFy + 1);
  };

  // Pre-fill existing grant amounts when selectedYear or budgetHeads/existingReceipts change
  useEffect(() => {
    if (!selectedYear || !budgetHeads.length) {
      setGrants({});
      return;
    }

    const yearNum = Number(selectedYear);
    const initialGrants = {};

    budgetHeads.forEach(head => {
      // Find matching grant receipt for this head and selected year
      const match = existingReceipts.find(r => 
        r.budgetHeadId === head.id && 
        (!r.type || r.type === 'Head' || r.type === 0) &&
        getReceiptYear(projectStartDate, r.receivedDate) === yearNum
      );
      if (match && match.amount != null) {
        initialGrants[head.id] = match.amount;
      }
    });

    setGrants(initialGrants);
  }, [selectedYear, budgetHeads, existingReceipts, projectStartDate]);

  const handleProjectChange = (e) => {
    const pId = e.target.value;
    setSelectedProjectId(pId);
    setPaymentMethod('');
    setSchemeCode('');
    setSelectedYear('');
    setGrants({});
    setRemarks('');
  };

  const totalYears = Math.max(1, Math.ceil(projectDurationMonths / 12));
  const yearOptions = Array.from({ length: totalYears }, (_, i) => i + 1);

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
  };

  const handleGrantChange = (headId, value) => {
    setGrants(prev => ({
      ...prev,
      [headId]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setShowSuccess(false);
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const promises = Object.entries(grants).map(([headId, amount]) => {
        if (Number(amount) > 0) {
          const head = budgetHeads.find(h => h.id === headId);
          let overheadSplit = null;
          if (head && head.headName.toLowerCase().includes('overhead')) {
            const amt = Number(amount);
            overheadSplit = {
              Idf: Math.round(amt * 0.4 * 100) / 100,
              Pdf: Math.round(amt * 0.4 * 100) / 100,
              Ddf: Math.round(amt * 0.2 * 100) / 100
            };
          }

          return recordGrantReceipt(selectedProjectId, {
            budgetHeadId: headId,
            receivedDate: receivedDate || today,
            amount: Number(amount),
            overheadSplit,
            projectYear: Number(selectedYear),
            transactionReference: paymentMethod === 'PFMS' ? `PFMS-${schemeCode}-${Date.now()}` : `DB-${Date.now()}`,
            paymentMode: paymentMethod,
            schemeCode: paymentMethod === 'PFMS' ? schemeCode : undefined,
            remarks,
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(promises);
      
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error("Failed to save grants", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full w-full space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Add Grants / Budget Allocation</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Record received grants, and allocate or distribute project budget.</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors space-y-8">
        
        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Step 1: Project Selection */}
          <div className="space-y-2 w-full">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Project <span className="text-red-500">*</span></label>
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
            >
              <option value="">-- Choose a project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.projectTitle || p.title}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Payment Method Selection */}
          {selectedProjectId && (
            <div className="space-y-2 w-full animate-in fade-in duration-300">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Method <span className="text-red-500">*</span></label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  if (e.target.value !== 'PFMS') setSchemeCode('');
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
              >
                <option value="">-- Choose payment method --</option>
                <option value="PFMS">PFMS</option>
                <option value="DirectBank">Direct Bank</option>
              </select>
            </div>
          )}

          {/* Step 3: Scheme Code Selection (If PFMS) */}
          {selectedProjectId && paymentMethod === 'PFMS' && (
            <div className="space-y-2 w-full animate-in fade-in duration-300">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Scheme Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={schemeCode}
                onChange={(e) => setSchemeCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
                placeholder="Enter Scheme Code"
              />
            </div>
          )}

          {/* Step 4: Year Selection */}
          {selectedProjectId && paymentMethod && (paymentMethod !== 'PFMS' || schemeCode.trim() !== '') && (
            <div className="space-y-2 w-full animate-in fade-in duration-300">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Year <span className="text-red-500">*</span></label>
              <select
                value={selectedYear}
                onChange={handleYearChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
              >
                <option value="">-- Choose a year --</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Step 5: Grant Receiving Date */}
          {selectedProjectId && paymentMethod && (paymentMethod !== 'PFMS' || schemeCode.trim() !== '') && (
            <div className="space-y-2 w-full animate-in fade-in duration-300">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Grant Receiving Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
              />
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {selectedProjectId && isLoadingHeads && (
          <div className="flex items-center gap-3 p-6 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading budget heads...</span>
          </div>
        )}

        {/* Empty State */}
        {selectedProjectId && selectedYear && !isLoadingHeads && budgetHeads.length === 0 && (
          <div className="flex items-center gap-3 p-6 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>No budget heads found for this project. Please configure budget heads for the project first.</span>
          </div>
        )}

        {/* Step 3: Grant Entry Table */}
        {selectedProjectId && selectedYear && !isLoadingHeads && budgetHeads.length > 0 && (
          <form onSubmit={handleSubmit} className="pt-8 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-500">

            <div className="overflow-x-auto mb-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-5">Budget Head</th>
                    <th className="px-6 py-5 text-center">Sanctioned Amount (₹)</th>
                    <th className="px-6 py-5 text-right">Allocation / Distribution (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {budgetHeads.map(head => {
                    const yearKey = `year${selectedYear}Amount`;
                    const sanctionedAmount = head[yearKey];

                    return (
                      <React.Fragment key={head.id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                            {getBudgetHeadDisplay(head.headName, head.customLabel)}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-mono">
                            {formatCurrency(sanctionedAmount || 0)}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex justify-end">
                              <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                placeholder="0.00"
                                value={grants[head.id] !== undefined ? grants[head.id] : ''}
                                onChange={(e) => handleGrantChange(head.id, e.target.value)}
                                className="w-40 text-right px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono font-medium text-slate-800 dark:text-slate-100 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                              />
                            </div>
                          </td>
                        </tr>
                        {head.headName.toLowerCase().includes('overhead') && Number(grants[head.id]) > 0 && (
                          <>
                            <tr className="bg-slate-50/30 dark:bg-slate-800/10">
                              <td className="px-6 py-2 text-sm text-slate-500 dark:text-slate-400 pl-12 font-medium">DDF</td>
                              <td className="px-6 py-2 text-center text-slate-400 dark:text-slate-500">---</td>
                              <td className="px-6 py-2 text-right text-slate-600 dark:text-slate-300 font-mono pr-12">{formatCurrency(Number(grants[head.id]) * 0.2)}</td>
                            </tr>
                            <tr className="bg-slate-50/30 dark:bg-slate-800/10">
                              <td className="px-6 py-2 text-sm text-slate-500 dark:text-slate-400 pl-12 font-medium">PDF</td>
                              <td className="px-6 py-2 text-center text-slate-400 dark:text-slate-500">---</td>
                              <td className="px-6 py-2 text-right text-slate-600 dark:text-slate-300 font-mono pr-12">{formatCurrency(Number(grants[head.id]) * 0.4)}</td>
                            </tr>
                            <tr className="bg-slate-50/30 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800">
                              <td className="px-6 py-2 text-sm text-slate-500 dark:text-slate-400 pl-12 font-medium">IDF</td>
                              <td className="px-6 py-2 text-center text-slate-400 dark:text-slate-500">---</td>
                              <td className="px-6 py-2 text-right text-slate-600 dark:text-slate-300 font-mono pr-12">{formatCurrency(Number(grants[head.id]) * 0.4)}</td>
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 w-full mb-8 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                Remarks <span className="text-red-500">*</span>
              </label>
              <textarea
                rows="3"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="A remark is required to record a grant receipt (e.g. Reference numbers, notes, etc.)"
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                {showSuccess && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-lg font-medium animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 size={20} />
                    Grant receipts saved successfully! Redirecting...
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting || remarksBlank}
                className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Check size={20} />}
                {isSubmitting ? 'Saving Allocation...' : 'Save Budget Allocation'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
