import useStaffAuthStore from '@/store/staffAuthStore';
import ApprovalInbox from '@/components/workflow/ApprovalInbox';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useStaffAuthStore();
  const navigate = useNavigate();

  const handleReviewEntity = (item) => {
    if (item.entityType === 'Supervisor') {
      // Navigate to supervisor screening details
      // Assuming URL pattern based on routes.jsx: /director_panel/supervisor-details/:id
      // We might need to map role to specific URL if they differ
      navigate(`/dashboard/supervisor-details/${item.entityID}`);
    } else if (item.entityType === 'Scholar') {
      navigate(`/dashboard/scholar-details/${item.entityID}`);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome, {user?.name || 'User'} to your dashboard</p>
      </div>

      {user?.roleId && (
        <div className="mb-8">
          <ApprovalInbox roleId={user.roleId} onReviewEntity={handleReviewEntity} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Quick Stats</h3>
          <p className="text-gray-600">Overview of your activities</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
          <p className="text-gray-600">Your latest actions</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Notifications</h3>
          <p className="text-gray-600">Important updates</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;