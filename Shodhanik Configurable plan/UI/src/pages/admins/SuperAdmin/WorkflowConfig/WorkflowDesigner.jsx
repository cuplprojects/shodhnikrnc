import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit3 } from 'react-icons/fi';
import workflowService from '../../../../services/workflowService';

const WorkflowDesigner = ({ workflowId, onBack }) => {
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    isActive: true,
    steps: []
  });
  const [roles, setRoles] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
    fetchActions();
    if (workflowId) {
      fetchWorkflow();
    } else {
      setLoading(false);
    }
  }, [workflowId]);

  const fetchRoles = async () => {
    try {
      const data = await workflowService.getRoles();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchActions = async () => {
    try {
      const data = await workflowService.getWorkflowActions();
      setActions(data);
    } catch (error) {
      console.error('Error fetching workflow actions:', error);
    }
  };

  const fetchWorkflow = async () => {
    try {
      const data = await workflowService.getWorkflow(workflowId);
      setWorkflow(data);
    } catch (error) {
      console.error('Error fetching workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = () => {
    const nextOrder = workflow.steps.length + 1;
    setWorkflow({
      ...workflow,
      steps: [
        ...workflow.steps,
        {
          stepName: '',
          requiredRoleID: '',
          stepOrder: nextOrder,
          isFinalStep: false,
          actionToTrigger: ''
        }
      ]
    });
  };

  const handleRemoveStep = (index) => {
    const newSteps = workflow.steps.filter((_, i) => i !== index);
    // Re-order steps
    const reorderedSteps = newSteps.map((step, i) => ({
      ...step,
      stepOrder: i + 1
    }));
    setWorkflow({ ...workflow, steps: reorderedSteps });
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...workflow.steps];
    
    // Parse numeric fields
    if (field === 'requiredRoleID') {
      newSteps[index][field] = value ? parseInt(value, 10) : '';
    } else {
      newSteps[index][field] = value;
    }
    
    // Ensure only one final step or logic for completion
    if (field === 'isFinalStep' && value === true) {
      newSteps.forEach((s, i) => {
        if (i !== index) s.isFinalStep = false;
      });
    }
    
    setWorkflow({ ...workflow, steps: newSteps });
  };

  const handleSave = async () => {
    try {
      if (workflowId) {
        await workflowService.updateWorkflow(workflowId, workflow);
      } else {
        await workflowService.createWorkflow(workflow);
      }
      onBack();
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Failed to save workflow. Check console for details.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Loading designer...</p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          {workflowId ? (
            <>
              <FiEdit3 size={28} className="mr-3 text-blue-600" />
              Edit Workflow
            </>
          ) : (
            <>
              <FiPlus size={28} className="mr-3 text-blue-600" />
              Create New Workflow
            </>
          )}
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          {workflowId ? 'Modify your workflow configuration' : 'Define a new approval workflow'}
        </p>
      </div>
      
      <div className="p-8">
        {/* Workflow Details Section */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold mr-3">1</span>
            Workflow Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Workflow Name *</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400"
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                placeholder="e.g. Scholar Registration Approval"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 cursor-pointer">Status</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white cursor-pointer"
                value={workflow.isActive}
                onChange={(e) => setWorkflow({ ...workflow, isActive: e.target.value === 'true' })}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400"
                rows="3"
                value={workflow.description}
                onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                placeholder="Describe the purpose and scope of this workflow..."
              />
            </div>
          </div>
        </div>

        {/* Workflow Steps Section */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold mr-3">2</span>
              Workflow Steps
            </h3>
            <button
              onClick={handleAddStep}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg font-medium cursor-pointer"
            >
              <FiPlus size={18} />
              <span>Add Step</span>
            </button>
          </div>

          <div className="space-y-4">
            {workflow.steps.map((step, index) => (
              <div key={index} className="border-2 border-gray-200 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white hover:border-blue-300 transition-colors duration-200">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-lg shadow-md">
                      {step.stepOrder}
                    </span>
                    <span className="text-sm font-medium text-gray-600">Step {step.stepOrder}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveStep(index)}
                    className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150 cursor-pointer"
                    title="Delete step"
                  >
                    <FiTrash2 size={20} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Step Name *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-200 text-sm text-gray-900 placeholder-gray-400"
                      value={step.stepName}
                      onChange={(e) => handleStepChange(index, 'stepName', e.target.value)}
                      placeholder="e.g. Supervisor Review"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 cursor-pointer">Required Role *</label>
                    <select
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-200 text-sm text-gray-900 bg-white cursor-pointer"
                      value={step.requiredRoleID}
                      onChange={(e) => handleStepChange(index, 'requiredRoleID', e.target.value)}
                    >
                      <option value="">Select Role</option>
                      {roles.map(role => (
                        <option key={role.roleID} value={role.roleID}>{role.roleName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 cursor-pointer">Action on Completion</label>
                    <select
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-200 text-sm text-gray-900 bg-white cursor-pointer"
                      value={step.actionToTrigger || ''}
                      onChange={(e) => handleStepChange(index, 'actionToTrigger', e.target.value)}
                    >
                      <option value="">None</option>
                      {actions.map(action => (
                        <option key={action.actionID} value={action.actionKey}>
                          {action.actionName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center p-3  rounded-lg">
                  <input
                    type="checkbox"
                    id={`final-${index}`}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    checked={step.isFinalStep}
                    onChange={(e) => handleStepChange(index, 'isFinalStep', e.target.checked)}
                  />
                  <label htmlFor={`final-${index}`} className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                    Mark as final step (workflow completes after this step)
                  </label>
                </div>
              </div>
            ))}
            
            {workflow.steps.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <div className="inline-block p-3 bg-gray-200 rounded-full mb-3">
                  <FiPlus size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-600 font-medium mb-1">No steps defined yet</p>
                <p className="text-gray-500 text-sm">Add at least one step to build your workflow</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all duration-200 font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg font-medium cursor-pointer"
          >
            Save Workflow
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDesigner;
