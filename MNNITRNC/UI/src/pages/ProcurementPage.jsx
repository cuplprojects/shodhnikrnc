import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Info, Plus, ShoppingBag, X } from 'lucide-react';
import { listProjects, getProject } from '../api/projectsApi';
import { listIndentsForProject } from '../api/procurementApi';
import { INDENT_TYPES, WORKFLOW_STAGE_LABELS } from '../constants/procurementEnums';
import IndentList from './procurement/components/IndentList';
import RequisitionModalShell from './procurement/components/RequisitionModalShell';

const SELECT_CLASS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 ' +
  'text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 ' +
  'focus:border-blue-500 block pl-9 pr-8 p-2 transition-all shadow-sm cursor-pointer';

export default function ProcurementPage() {
  const navigate = useNavigate();
  const [indents, setIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');

  // New Indent Modal state
  const [userProjectsList, setUserProjectsList] = useState([]);
  const [isSelectProjectOpen, setIsSelectProjectOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Consumable');
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedProjectObject, setSelectedProjectObject] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const projects = await listProjects();
      setUserProjectsList(projects ?? []);
      const perProject = await Promise.all(
        (projects ?? []).flatMap((project) =>
          INDENT_TYPES.map((type) =>
            listIndentsForProject(type.value, project.id)
              .then((rows) => (rows ?? []).map((row) => ({
                ...row,
                indentType: type.value,
                projectId: project.id,
                projectTitle: project.projectTitle,
              })))
              .catch(() => [])
          )
        )
      );
      setIndents(perProject.flat());
    } catch {
      setError('Failed to load indents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNewIndentModal = async () => {
    if (userProjectsList.length > 0) {
      setSelectedProjectId(userProjectsList[0].id);
      setSelectedProjectObject(userProjectsList[0]);
      setIsSelectProjectOpen(true);
    } else {
      navigate('/projects');
    }
  };

  const handleProceedToForm = async () => {
    const proj = userProjectsList.find((p) => p.id === selectedProjectId);
    if (!proj) return;

    try {
      const fullProj = await getProject(selectedProjectId).catch(() => proj);
      setSelectedProjectObject(fullProj || proj);
    } catch {
      setSelectedProjectObject(proj);
    }

    setIsSelectProjectOpen(false);
    setIsRaiseModalOpen(true);
  };

  const visibleIndents = useMemo(
    () => indents.filter((indent) =>
      (typeFilter === 'ALL' || indent.indentType === typeFilter) &&
      (stageFilter === 'ALL' || indent.currentStage === stageFilter)),
    [indents, typeFilter, stageFilter]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Procurement</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage GeM and Non-GeM indents</p>
        </div>
        <button
          onClick={handleOpenNewIndentModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20 text-sm"
        >
          <Plus size={18} />
          Raise New Indent
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          Indents are raised from within a project, because each one draws against a
          specific budget head.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter size={16} className="text-slate-400" />
          </div>
          <select
            aria-label="Filter by indent type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="ALL">All Types</option>
            {INDENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter size={16} className="text-slate-400" />
          </div>
          <select
            aria-label="Filter by stage"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="ALL">All Stages</option>
            {Object.entries(WORKFLOW_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading indents…</div>
      ) : error ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">{error}</div>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {visibleIndents.length} of {indents.length} indents
          </p>
          <IndentList
            indents={visibleIndents}
            onSelect={(indent) => navigate(`/procurement/${indent.indentType}/${indent.id}`)}
            showType
            showProject
            emptyMessage={
              indents.length === 0
                ? 'No indents raised yet across your projects'
                : 'No indents match the selected filters'
            }
          />
        </>
      )}

      {/* SELECT PROJECT & CATEGORY MODAL FOR RAISING NEW INDENT */}
      {isSelectProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Raise New Procurement Indent</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select project & requisition category</p>
                </div>
              </div>
              <button onClick={() => setIsSelectProjectOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Select Research Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                >
                  {userProjectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectTitle || p.title || `Project #${p.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Select Requisition Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: 'Consumable', label: 'Consumable', desc: 'Chemicals, Stationeries' },
                    { type: 'Contingency', label: 'Contingency', desc: 'Services, Minor Repairs' },
                    { type: 'Equipment', label: 'Equipment', desc: 'Capital Equipment' },
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.type}
                      onClick={() => setSelectedCategory(cat.type)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedCategory === cat.type
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="text-xs font-bold">{cat.label}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsSelectProjectOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToForm}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
              >
                Proceed to Form →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUISITION MODAL FORM */}
      {isRaiseModalOpen && selectedProjectObject && (
        <RequisitionModalShell
          title={`Raise ${selectedCategory} Requisition`}
          indentType={selectedCategory}
          projectId={selectedProjectObject.id}
          budgetHeads={selectedProjectObject.budgetHeads}
          sanctionedEquipment={selectedProjectObject.sanctionedEquipment?.[0]}
          onClose={() => setIsRaiseModalOpen(false)}
          onRaised={() => {
            setIsRaiseModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
