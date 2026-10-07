import { useState } from 'react';
import { motion } from 'framer-motion';
import WorkflowList from './WorkflowList';
import WorkflowDesigner from './WorkflowDesigner';

const WorkflowConfig = () => {
  const [activeView, setActiveView] = useState('list');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  const handleEditWorkflow = (id) => {
    setSelectedWorkflowId(id);
    setActiveView('designer');
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflowId(null);
    setActiveView('designer');
  };

  const handleBackToList = () => {
    setActiveView('list');
    setSelectedWorkflowId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflow Configuration</h1>
          <p className="text-gray-600 text-lg">Define and manage configurable approval workflows</p>
        </div>
        {activeView !== 'list' && (
          <button
            onClick={handleBackToList}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium cursor-pointer"
          >
            ← Back to List
          </button>
        )}
      </div>

      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeView === 'list' ? (
          <WorkflowList onEdit={handleEditWorkflow} onCreate={handleCreateWorkflow} />
        ) : (
          <WorkflowDesigner workflowId={selectedWorkflowId} onBack={handleBackToList} />
        )}
      </motion.div>
    </div>
  );
};

export default WorkflowConfig;
