import React, { useState, useEffect, useMemo } from 'react';
import { Archive, Loader2, AlertCircle } from 'lucide-react';
import { listHistoricalEntryProjects, listHistoricalEntries } from '../../api/historicalEntriesApi';
import { getBudgetSummary, getProject } from '../../api/projectsApi';
import { getBudgetHeadDisplay } from '../../constants/projectEnums';
import { formatCurrency } from './utils/currency';
import HistoricalExpenditureForm from './components/HistoricalExpenditureForm';
import HistoricalGrantReceiptForm from './components/HistoricalGrantReceiptForm';
import HistoricalEntriesTable from './components/HistoricalEntriesTable';

export default function HistoricalEntriesPage() {
  const [allProjects, setAllProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [budgetSummary, setBudgetSummary] = useState(null);
  const [projectBudgetHeads, setProjectBudgetHeads] = useState([]);
  const [entries, setEntries] = useState({ expenditures: [], grantReceipts: [] });
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      setError(null);
      const data = await listHistoricalEntryProjects();
      setAllProjects(data || []);
    } catch (err) {
      console.error('Failed to load historical-entry projects', err);
      setError('Failed to fetch department projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Distinct departments across all projects
  const departments = useMemo(() => {
    const map = new Map();
    allProjects.forEach((p) => {
      if (!map.has(p.departmentId)) {
        map.set(p.departmentId, { id: p.departmentId, name: p.departmentName });
      }
    });
    return Array.from(map.values());
  }, [allProjects]);

  // Faculty (project owners) within the selected department, deduplicated by ownerUserId
  const faculty = useMemo(() => {
    if (!selectedDepartmentId) return [];
    const map = new Map();
    allProjects
      .filter((p) => p.departmentId === selectedDepartmentId)
      .forEach((p) => {
        if (!map.has(p.ownerUserId)) {
          map.set(p.ownerUserId, { id: p.ownerUserId, name: p.ownerName });
        }
      });
    return Array.from(map.values());
  }, [allProjects, selectedDepartmentId]);

  // Projects for the selected department + faculty
  const projects = useMemo(() => {
    if (!selectedDepartmentId || !selectedFacultyId) return [];
    return allProjects.filter(
      (p) => p.departmentId === selectedDepartmentId && p.ownerUserId === selectedFacultyId
    );
  }, [allProjects, selectedDepartmentId, selectedFacultyId]);

  const handleDepartmentChange = (e) => {
    setSelectedDepartmentId(e.target.value);
    setSelectedFacultyId('');
    setSelectedProjectId('');
    setBudgetSummary(null);
    setEntries({ expenditures: [], grantReceipts: [] });
  };

  const handleFacultyChange = (e) => {
    setSelectedFacultyId(e.target.value);
    setSelectedProjectId('');
    setBudgetSummary(null);
    setEntries({ expenditures: [], grantReceipts: [] });
  };

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
  };

  useEffect(() => {
    if (!selectedProjectId) {
      setBudgetSummary(null);
      setProjectBudgetHeads([]);
      setEntries({ expenditures: [], grantReceipts: [] });
      return;
    }
    loadProjectDetail(selectedProjectId);
  }, [selectedProjectId]);

  const loadProjectDetail = async (projectId) => {
    try {
      setLoadingDetail(true);
      setError(null);
      const [projectData, summaryData, entriesData] = await Promise.all([
        getProject(projectId),
        getBudgetSummary(projectId),
        listHistoricalEntries(projectId),
      ]);
      setProjectBudgetHeads(projectData?.budgetHeads || []);
      setBudgetSummary(summaryData);
      setEntries(entriesData || { expenditures: [], grantReceipts: [] });
    } catch (err) {
      console.error('Failed to load project historical-entry detail', err);
      setError('Failed to fetch the budget summary or entries for the selected project.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRefresh = () => {
    if (selectedProjectId) loadProjectDetail(selectedProjectId);
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Archive size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Historical Expenditure &amp; Grants</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Directly record a pre-existing project's real-world expenditure and grant receipts (no approval workflow).
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {/* Department -> Faculty -> Project Picker */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 w-full">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Department <span className="text-red-500">*</span></label>
            {loadingProjects ? (
              <p className="text-sm text-slate-500">Loading departments...</p>
            ) : (
              <select
                value={selectedDepartmentId}
                onChange={handleDepartmentChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
              >
                <option value="">-- Choose a department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2 w-full">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Faculty <span className="text-red-500">*</span></label>
            <select
              value={selectedFacultyId}
              onChange={handleFacultyChange}
              disabled={!selectedDepartmentId}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Choose a faculty --</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 w-full">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project <span className="text-red-500">*</span></label>
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              disabled={!selectedFacultyId}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Choose a project --</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectTitle} (Sanction No: {p.sanctionNo})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading Spinner */}
      {selectedProjectId && loadingDetail && (
        <div className="flex items-center gap-3 p-6 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Loading budget summary and historical entries...</span>
        </div>
      )}

      {selectedProjectId && !loadingDetail && (
        <>
          {/* Budget Summary (read-only) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Current Budget Summary</h3>
            </div>
            <div className="overflow-x-auto">
              {!budgetSummary?.lines || budgetSummary.lines.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  No budget summary lines found for this project.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
                  <thead className="bg-slate-50/90 dark:bg-slate-900/80 uppercase text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4 text-left">Head</th>
                      <th className="py-3 px-4 text-center">Year</th>
                      <th className="py-3 px-4 text-right">Sanctioned</th>
                      <th className="py-3 px-4 text-right">Received</th>
                      <th className="py-3 px-4 text-right">Spent</th>
                      <th className="py-3 px-4 text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {budgetSummary.lines.map((line, idx) => (
                      <tr key={`${line.headName}-${line.projectYear}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {getBudgetHeadDisplay(line.headName, line.customLabel)}
                        </td>
                        <td className="py-3 px-4 text-center">Year {line.projectYear}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(line.sanctioned)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(line.grantReceived)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(line.spent)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(line.available)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Entry Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HistoricalExpenditureForm
              projectId={selectedProjectId}
              budgetHeads={projectBudgetHeads}
              onRecorded={handleRefresh}
            />
            <HistoricalGrantReceiptForm
              projectId={selectedProjectId}
              budgetHeads={projectBudgetHeads}
              onRecorded={handleRefresh}
            />
          </div>

          {/* Entries Table */}
          <HistoricalEntriesTable
            expenditures={entries.expenditures || []}
            grantReceipts={entries.grantReceipts || []}
            onDeleted={handleRefresh}
          />
        </>
      )}
    </div>
  );
}
