import { useState, useEffect } from 'react';
import { FiCheck, FiX, FiMessageSquare, FiEye } from 'react-icons/fi';
import workflowService from '../../services/workflowService';

const ApprovalInbox = ({ roleId, onReviewEntity }) => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [remark, setRemark] = useState('');

  useEffect(() => {
    fetchPending();
  }, [roleId]);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await workflowService.getPendingApprovals(roleId);
      setPendingApprovals(data);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (instanceId, action) => {
    if (!remark && action === 'Reject') {
      alert('Please provide a remark for rejection.');
      return;
    }

    try {
      setActioningId(instanceId);
      await workflowService.submitApprovalAction({
        instanceId,
        action,
        comments: remark
      });
      setRemark('');
      fetchPending();
    } catch (error) {
      console.error('Error submitting action:', error);
      alert('Failed to submit action.');
    } finally {
      setActioningId(null);
    }
  };

  if (loading) return <div className="p-4">Loading pending approvals...</div>;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">Pending My Approval</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Process</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Step</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started At</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pendingApprovals.map((item) => (
              <tr key={item.instanceID}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{item.workflow?.name}</div>
                  <div className="text-xs text-gray-500">{item.entityType}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{item.entityID}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    Step {item.currentStepOrder}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.startedAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-2">
                    {onReviewEntity && (
                      <button 
                        onClick={() => onReviewEntity(item)}
                        className="p-1 text-gray-600 hover:text-blue-600" title="View Details"
                      >
                        <FiEye size={18} />
                      </button>
                    )}
                    <div className="flex items-center space-x-1 border rounded p-1 bg-gray-50">
                      <input 
                        type="text" 
                        placeholder="Remark..." 
                        className="text-xs p-1 border-none bg-transparent focus:ring-0 w-24"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                      />
                      <button 
                        onClick={() => handleAction(item.instanceID, 'Approve')}
                        disabled={actioningId === item.instanceID}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                      >
                        <FiCheck size={18} />
                      </button>
                      <button 
                        onClick={() => handleAction(item.instanceID, 'Reject')}
                        disabled={actioningId === item.instanceID}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <FiX size={18} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {pendingApprovals.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                  No pending approvals for your role.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApprovalInbox;
