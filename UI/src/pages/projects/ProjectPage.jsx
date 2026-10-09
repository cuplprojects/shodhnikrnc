import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects, deleteProject } from '../../api/projectsApi';
import { PROJECT_TYPES } from '../../constants/projectEnums';
import { formatCurrency } from './utils/currency';
import { useAccess } from '../../access/useAccess';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Building2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

/// Remounts when the route changes the filter, so the inner page can seed
/// typeFilter from the prop instead of syncing it in with an effect.
export default function ProjectListPage({ initialTypeFilter = 'ALL' }) {
  return <ProjectList key={initialTypeFilter} initialTypeFilter={initialTypeFilter} />;
}

function ProjectList({ initialTypeFilter }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const navigate = useNavigate();

  // A project normally comes from a sanctioned research proposal, not this
  // manual form -- projects.new is now office-only (see PageCatalogue), so
  // most Faculty users hold projects.list but not projects.new. Reading it
  // from access rather than role, so this stays correct if a SuperAdmin
  // ever reconfigures who holds it.
  const { pages } = useAccess();
  const canCreateManually = (pages ?? []).some((p) => p.key === 'projects.new');
  const canCreateProposal = (pages ?? []).some((p) => p.key === 'proposals.new');

  // Nothing is set synchronously before the first await: isLoading already starts
  // true and error already starts null, so the initial fetch does not need to
  // write them, and setting state synchronously inside an effect cascades an
  // extra render. A retry path would need to reset both again first.
  const loadProjects = async () => {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch on mount. The rule flags this because loadProjects eventually calls
    // setState, but every write happens after an await, in a promise callback --
    // not synchronously during the effect, which is what causes cascading renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesType = typeFilter === 'ALL' || p.projectType === typeFilter;
      const safeTitle = p.projectTitle || '';
      const safeAgency = p.agency || '';
      const titleMatches = safeTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const agencyMatches = safeAgency.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = !searchQuery || titleMatches || agencyMatches;
      return matchesType && matchesSearch;
    });
  }, [projects, typeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage) || 1;

  // Clamp during render rather than resetting from an effect: filtering to fewer
  // pages than the current one would otherwise render an empty page for a frame
  // before the effect corrected it.
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProjects = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProjects, safeCurrentPage, itemsPerPage]);

  const handleDeleteConfirmed = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteProject(pendingDeleteId);
      setProjects(projects.filter(p => p.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch {
      setError('Failed to delete project.');
      setPendingDeleteId(null);
    }
  };

  const typeLabel = (value) => PROJECT_TYPES.find((t) => t.value === value)?.label ?? value;

  const getTypeBadgeColor = (type) => {
    const str = String(type);
    if (str.includes('I') && !str.includes('II') && !str.includes('IV')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    if (str.includes('II') && !str.includes('III')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    if (str.includes('III')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    if (str.includes('IV')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <FolderKanban size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Projects</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Manage your active and pending projects, track funding, and monitor durations.
            </p>
          </div>
        </div>
        {canCreateManually && (
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus size={18} /> New Project
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search projects or agencies..."
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
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block pl-9 pr-10 p-2 transition-all shadow-sm cursor-pointer"
          >
            <option value="ALL">All Project Types</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-white dark:bg-slate-800">{t.label}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
          <AlertCircle size={18} />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm animate-pulse">Loading your projects...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap w-16 text-center">S.No</th>
                  <th className="px-4 py-3 whitespace-nowrap">Project Info</th>
                  <th className="px-4 py-3 whitespace-nowrap">Agency</th>
                  <th className="px-4 py-3 whitespace-nowrap">Timeline</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Funding</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedProjects.map((project, index) => (
                  <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3 text-center text-slate-400 dark:text-slate-500 font-medium">
                      {(safeCurrentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {project.projectTitle}
                        </span>
                        <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-medium border ${getTypeBadgeColor(project.projectType)}`}>
                          {typeLabel(project.projectType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium text-sm">
                        <Building2 size={14} className="text-slate-400" />
                        <span>{project.agency}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          <span>Started: <span className="font-medium text-slate-700 dark:text-slate-300">{project.startDate}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          <span>Duration: <span className="font-medium text-slate-700 dark:text-slate-300">{project.durationMonths} mo</span></span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(project.totalSanctioned)}
                        </span>
                        <span className="text-[10px] text-slate-400">Total Sanctioned</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${project.id}/edit`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                          title="Edit Project"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(project.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          title="Delete Project"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-full text-slate-400">
                          <Search size={24} />
                        </div>
                        <p className="text-base font-medium text-slate-700 dark:text-slate-300">No projects found</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                          {searchQuery ? "We couldn't find any projects matching your search." : "You haven't created any projects yet."}
                        </p>
                        {!searchQuery && (canCreateManually || canCreateProposal) && (
                          <button
                            onClick={() => navigate(canCreateManually ? '/projects/new' : '/proposals/new')}
                            className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-1"
                          >
                            <Plus size={14} /> {canCreateManually ? 'Create your first project' : 'Create your first proposal'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredProjects.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-800/30 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Showing <span className="font-medium text-slate-900 dark:text-white">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-900 dark:text-white">{Math.min(safeCurrentPage * itemsPerPage, filteredProjects.length)}</span> of <span className="font-medium text-slate-900 dark:text-white">{filteredProjects.length}</span> projects
                </span>
                <div className="flex items-center gap-2 border-l border-slate-300 dark:border-slate-700 pl-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Rows per page:</span>
                  <div className="relative">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="appearance-none bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 pr-6 pl-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {[5, 10, 20, 50].map((size) => (
                        <option key={size} value={size} className="bg-white dark:bg-slate-800">{size}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-1 flex items-center pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 transform animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Project</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  This action cannot be undone by you.
                </p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-5 px-1">
              Are you sure you want to delete this project? It will be removed from your active list immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:ring-2 focus:ring-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition-colors focus:ring-2 focus:ring-red-500"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
