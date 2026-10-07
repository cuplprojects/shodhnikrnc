/**
 * Course Work Status Component
 * Displays current course work status and provides refresh functionality
 */
import React, { useState } from 'react';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import { fetchCourseWorkStatus } from '@/services/courseWorkService';
import notification from '@/services/NotificationService';

const CourseWorkStatus = () => {
  const notify = notification();
  const { user, courseWorkCompleted, fetchCourseWorkStatus: refreshStatus } = useSelectedScholarAuthStore();
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshStatus();
      setLastChecked(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error refreshing course work status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAPI = async () => {
    if (!user?.sId) return;
    
    setLoading(true);
    try {
      const result = await fetchCourseWorkStatus(user.sId);
      console.log('Course Work API Response:', result);
      notify.info(`Course Work Status: ${result?.courseWork?.courseWorkStatus || 'Not found'}`);
    } catch (error) {
      console.error('API Test Error:', error);
      // alert('API call failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-3">Course Work Status</h3>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Scholar ID:</span>
          <span className="font-medium">{user.sId}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            courseWorkCompleted 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {courseWorkCompleted ? 'Completed (Unlocked)' : 'Not Completed (Locked)'}
          </span>
        </div>
        
        {lastChecked && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Last Checked:</span>
            <span className="text-sm">{lastChecked}</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Status'}
        </button>
        
        <button
          onClick={handleTestAPI}
          disabled={loading}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
        >
          Test API Call
        </button>
      </div>
    </div>
  );
};

export default CourseWorkStatus;