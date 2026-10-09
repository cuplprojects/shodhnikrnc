import { useState, useEffect } from 'react';
import { X, History } from 'lucide-react';
import ApprovalTimeline from '../../../components/ApprovalTimeline';
import ReappropriationForm from './ReappropriationForm';
import { getWorkflowInstance } from '../../../api/workflowApi';
import { getProject, getBudgetSummary } from '../../../api/projectsApi';
import { resubmitReappropriation } from '../../../api/projectsApi';
import { useToast } from '../../../context/ToastContext';

export default function ReappropriationWorkflowModal({ req, isOpen, onClose, onUpdated }) {
  const [steps, setSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveStage, setLiveStage] = useState(null);
  
  // For Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [budgetHeads, setBudgetHeads] = useState([]);
  const [effectiveReceivedByHeadName, setEffectiveReceivedByHeadName] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen || !req) return;
    
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const instance = await getWorkflowInstance(req.workflowInstanceId);
        if (isMounted && instance) {
          setSteps(instance.steps || []);
          setLiveStage(instance.currentStage);
        }
      } catch (err) {
        if (isMounted) addToast('Failed to load workflow history.', 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    void load();
    return () => { isMounted = false; };
  }, [isOpen, req, addToast]);

  const handleEditClick = async () => {
    setIsLoading(true);
    try {
      const [proj, summary] = await Promise.all([
        getProject(req.projectId),
        getBudgetSummary(req.projectId)
      ]);
      setBudgetHeads(proj.budgetHeads || []);
      
      const effective = {};
      (summary.budgetLines || []).forEach((line) => {
        effective[line.headName] = (effective[line.headName] ?? 0) + (line.grantReceived || 0);
      });
      (summary.reappropriationSummary || []).forEach((r) => {
        effective[r.headName] = (effective[r.headName] ?? 0) + (r.netReappropriated || 0);
      });
      setEffectiveReceivedByHeadName(effective);
      setIsEditing(true);
    } catch (err) {
      addToast('Failed to load project details for editing.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitEdit = async (data) => {
    setIsSubmitting(true);
    try {
      await resubmitReappropriation(req.projectId, req.id, data);
      addToast('Reappropriation request resubmitted successfully!', 'success');
      setIsEditing(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      throw err; // handled by ReappropriationForm
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !req) return null;

  const actualStage = liveStage || req.currentStage;
  const canEdit = actualStage === 'ReappropriationReturnedToPI' && req.status === 'PendingApproval';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <History size={22} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Reappropriation Workflow
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                View remarks and history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading data...</div>
          ) : isEditing ? (
            <ReappropriationForm
              budgetHeads={budgetHeads}
              effectiveReceivedByHeadName={effectiveReceivedByHeadName}
              initialData={{
                reason: req.reason,
                sources: req.sources,
                destinations: req.destinations,
              }}
              onSubmit={handleSubmitEdit}
              onCancel={() => setIsEditing(false)}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Request Summary</h3>
                <p className="text-sm mb-3"><strong>Reason:</strong> {req.reason}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong className="text-xs text-rose-600 uppercase">Sources</strong>
                    <ul className="text-sm list-disc pl-4 mt-1">
                      {req.sources?.map((s, i) => <li key={i}>{s.headName}: {s.amount}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-xs text-emerald-600 uppercase">Destinations</strong>
                    <ul className="text-sm list-disc pl-4 mt-1">
                      {req.destinations?.map((d, i) => <li key={i}>{d.headName}: {d.amount}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="flex justify-end">
                  <button
                    onClick={handleEditClick}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all"
                  >
                    Edit & Resubmit
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Workflow History</h3>
                <ApprovalTimeline steps={steps} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
