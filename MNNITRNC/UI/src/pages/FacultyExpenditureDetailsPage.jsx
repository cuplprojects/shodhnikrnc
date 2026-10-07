import { useState, useEffect } from 'react';
import { Search, Download, Printer, Receipt } from 'lucide-react';
import { listProjects } from '../api/projectsApi';
import { getReport, downloadReport } from '../api/reportsApi';

const formatDateInDMY = (dateStr) => {
  if (!dateStr) return "N/A";
  const str = String(dateStr).split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return str;
};

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "₹0.00";
  const num = Number(amount);
  if (isNaN(num)) return "₹0.00";
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `₹-${absFormatted}` : `₹${absFormatted}`;
};

export default function FacultyExpenditureDetailsPage() {
  const [formData, setFormData] = useState({
    projectId: '',
    requestType: 'all',
    fromDate: '',
    toDate: ''
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenditures, setExpenditures] = useState([]);

  useEffect(() => {
    listProjects()
      .then(data => setProjects(data))
      .catch(err => console.error("Failed to load projects", err));
  }, []);

  const requestTypes = [
    { value: 'all', label: 'All Heads' },
    { value: 'consumable', label: 'Consumable' },
    { value: 'contingency', label: 'Contingency' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'travel', label: 'Travel' }
  ];

  // Search handler using API: /api/reports/view-transaction-details
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!formData.projectId) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await getReport('view-transaction-details', {
        projectId: formData.projectId,
        from: formData.fromDate,
        to: formData.toDate,
      });

      if (Array.isArray(data)) {
        let filtered = data;
        if (formData.requestType && formData.requestType !== 'all') {
          filtered = filtered.filter(item => {
            const itemHead = (item.headName || item.head || item.sectionType || '').toLowerCase();
            return itemHead === formData.requestType.toLowerCase();
          });
        }
        setExpenditures(filtered);
      } else {
        setExpenditures([]);
      }
    } catch (err) {
      console.error("Failed to fetch transaction details", err);
      setExpenditures([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDownloadExcel = async () => {
    try {
      await downloadReport('view-transaction-details', 'excel', {
        projectId: formData.projectId,
        from: formData.fromDate,
        to: formData.toDate,
      });
    } catch (err) {
      console.error("Failed to download excel from API, using client fallback", err);
      if (expenditures.length === 0) return;

      const headers = [
        "Transaction Date",
        "Transaction Reference Number",
        "Payment Mode",
        "Head",
        "Item/Equipment Name",
        "Current Balance in Concerned head",
        "Expenditure Amount",
        "Balance after Payment",
        "Updated By",
      ];

      const rows = expenditures.map((exp) => [
        `"${formatDateInDMY(exp.transactionDate || exp.date)}"`,
        `"${exp.transactionRef || exp.refNumber || ''}"`,
        `"${exp.paymentMode || ''}"`,
        `"${exp.headName || exp.head || exp.sectionType || ''}"`,
        `"${exp.itemName || exp.equipmentName || ''}"`,
        `"${formatCurrency(exp.currentBalance)}"`,
        `"${formatCurrency(exp.amount)}"`,
        `"${formatCurrency(exp.balanceAfter)}"`,
        `"${exp.updatedBy || ''}"`,
      ]);

      rows.push([
        '"Total"',
        '""',
        '""',
        '""',
        '""',
        '""',
        `"${formatCurrency(totalAmount)}"`,
        '""',
        '""',
      ]);

      const csvContent =
        "\uFEFF" +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Transaction_Details.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePrintPdf = async () => {
    try {
      await downloadReport('view-transaction-details', 'pdf', {
        projectId: formData.projectId,
        from: formData.fromDate,
        to: formData.toDate,
      });
    } catch (err) {
      console.error("Failed to download PDF from API, triggering print", err);
      window.print();
    }
  };

  const totalAmount = expenditures.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="w-full w-full space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">View Transaction Details</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Search and view expenditure history across your projects</p>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project <span className="text-red-500">*</span></label>
              <select required name="projectId" value={formData.projectId} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.projectTitle || p.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Head</label>
              <select name="requestType" value={formData.requestType} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                {requestTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">From Date <span className="text-red-500">*</span></label>
              <input required type="date" name="fromDate" value={formData.fromDate} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">To Date <span className="text-red-500">*</span></label>
              <input required type="date" name="toDate" value={formData.toDate} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
            </div>

          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95">
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search size={18} />}
              {isLoading ? 'Searching...' : 'Search'}
            </button>

            {expenditures.length > 0 && (
              <>
                <button type="button" onClick={handleDownloadExcel} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md shadow-green-500/20 transition-all active:scale-95">
                  <Download size={18} /> Download Excel
                </button>
                <button type="button" onClick={handlePrintPdf} className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95">
                  <Printer size={18} /> Print / Download PDF
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Results Section */}
      {hasSearched && !isLoading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors animate-in fade-in slide-in-duration-300">
          {expenditures.length > 0 ? (
            <div className="overflow-x-auto print-friendly">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Transaction Date</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Transaction Reference Number</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Payment Mode</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Head</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700">Item/Equipment Name</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 text-right whitespace-nowrap">Current Balance in Concerned head</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 text-right whitespace-nowrap">Expenditure Amount</th>
                    <th className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700 text-right whitespace-nowrap">Balance after Payment</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Updated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {expenditures.map((exp, idx) => (
                    <tr key={exp.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">{formatDateInDMY(exp.transactionDate || exp.date)}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 font-mono text-xs whitespace-nowrap">{exp.transactionRef || exp.refNumber || '-'}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">{exp.paymentMode || '-'}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">{exp.headName || exp.head || exp.sectionType || '-'}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 w-full truncate" title={exp.itemName || exp.equipmentName}>{exp.itemName || exp.equipmentName || '-'}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-medium whitespace-nowrap">{formatCurrency(exp.currentBalance)}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-medium whitespace-nowrap">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-medium whitespace-nowrap">{formatCurrency(exp.balanceAfter)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{exp.updatedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                  <tr>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700">Total</td>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-4 py-3.5 text-right font-mono text-base border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">{formatCurrency(totalAmount)}</td>
                    <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-4 py-3.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Receipt size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">No transactions found</h3>
              <p className="text-slate-500 dark:text-slate-400 w-full ">
                We couldn't find any expenditure records for the selected project and date range. Try adjusting your search criteria.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-friendly, .print-friendly * {
            visibility: visible;
          }
          .print-friendly {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />
    </div>
  );
}
