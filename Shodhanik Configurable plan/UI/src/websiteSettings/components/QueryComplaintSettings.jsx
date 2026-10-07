import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Eye, Trash2, RefreshCw } from 'lucide-react';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import TableService from '@/services/TableService';
import { hasPermission } from '@/services/hasPermissionService';

const QueryComplaintSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_querycomplaint.update');
  
  if (!canUpdate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600 text-sm mb-4">
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_querycomplaint.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Format date with full date and time in dd/mm/yyyy format
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Define table columns
  const columns = useMemo(() => [
    {
      id: 'serialNumber',
      header: 'S.N.',
      cell: ({ row }) => row.index + 1,
      size: 60,
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Name & Contact',
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{row.original.name}</div>
          <div className="text-sm text-gray-500">{row.original.email}</div>
          <div className="text-sm text-gray-500">{row.original.mobile}</div>
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: 'shodhanikId',
      header: 'Shodhanik ID',
      cell: ({ getValue }) => getValue() || 'N/A',
      size: 120,
    },
    {
      accessorKey: 'queryComplaintText',
      header: 'Query/Complaint',
      cell: ({ getValue }) => (
        <div className="text-sm text-gray-900 max-w-xs truncate">
          {getValue()}
        </div>
      ),
      size: 250,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue, row }) => (
        <select
          value={getValue() || 'Pending'}
          onChange={(e) => updateQueryStatus(row.original.id, e.target.value)}
          disabled={updatingStatus === row.original.id}
          className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(getValue())} ${
            updatingStatus === row.original.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {/* Only show Pending option if current status is not Solved */}
          {getValue() !== 'Solved' && <option value="Pending">Pending</option>}
          <option value="Solved">Solved</option>
        </select>
      ),
      size: 120,
      filterFn: 'equals',
    },
    {
      accessorKey: 'submittedAt',
      header: 'Submitted Date & Time',
      cell: ({ getValue }) => (
        <div className="text-sm text-gray-500">
          {formatDateTime(getValue())}
        </div>
      ),
      size: 180,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedQuery(row.original);
              setShowModal(true);
            }}
            className="text-blue-600 hover:text-blue-900 transition-colors"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => deleteQuery(row.original.id)}
            className="text-red-600 hover:text-red-900 transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      size: 100,
      enableSorting: false,
    },
  ], [updatingStatus]);

  // Fetch queries from API
  const fetchQueries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/QueryComplaint');
      if (response.data) {
        const queriesData = Array.isArray(response.data) ? response.data : [response.data];
        setQueries(queriesData);
        setLastRefreshed(new Date()); // Set current date/time when data is refreshed
      }
    } catch (err) {
      setError('Failed to fetch queries. Please try again later.');
      notification().error('Failed to fetch queries. Please try again later.');
      console.error('Error fetching queries:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update query status
  const updateQueryStatus = async (queryId, newStatus) => {
    try {
      setUpdatingStatus(queryId);
      setError(null);
      
      // First get the current query
      const getResponse = await API.get(`/QueryComplaint/${queryId}`);
      if (getResponse.data) {
        const currentQuery = getResponse.data;
        
        // Update the status
        const updatedQuery = {
          ...currentQuery,
          status: newStatus
        };
        
        const response = await API.put(`/QueryComplaint/${queryId}`, updatedQuery);
        
        if (response.status === 204) {
          await fetchQueries(); // Refresh data
          notification().success(`Status updated to "${newStatus}" successfully!`);
        }
      }
    } catch (err) {
      setError('Failed to update status. Please try again later.');
      notification().error('Failed to update status. Please try again later.');
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Delete query
  const deleteQuery = async (queryId) => {
    if (!window.confirm('Are you sure you want to delete this query/complaint?')) {
      return;
    }

    try {
      setError(null);
      
      const response = await API.delete(`/QueryComplaint/${queryId}`);
      
      if (response.status === 204) {
        await fetchQueries(); // Refresh data
        notification().success('Query/Complaint deleted successfully!');
      }
    } catch (err) {
      setError('Failed to delete query. Please try again later.');
      notification().error('Failed to delete query. Please try again later.');
      console.error('Error deleting query:', err);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchQueries();
  }, []);

  // Get status badge color
  const getStatusBadge = (status) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Solved': 'bg-green-100 text-green-800 border-green-200'
    };
    
    return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066cc] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading queries...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Query & Complaint</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage and respond to user queries and complaints
          </p>
         
        </div>
        <button
          onClick={() => {
            fetchQueries();
            notification().info('Refreshing queries...');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={fetchQueries}
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <MessageSquare className="text-blue-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Queries</p>
              <p className="text-2xl font-bold text-gray-800">{queries.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-800">
                {queries.filter(q => q.status === 'Pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Solved</p>
              <p className="text-2xl font-bold text-gray-800">
                {queries.filter(q => q.status === 'Solved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Queries Table using TableService */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <TableService
          columns={columns}
          data={queries}
          loading={loading}
          initialPageSize={10}
        />
      </div>

      {/* Query Details Modal */}
      {showModal && selectedQuery && (
        <div className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">
                Query Details - #{selectedQuery.id}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <p className="text-sm text-gray-900">{selectedQuery.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shodhanik ID</label>
                    <p className="text-sm text-gray-900">{selectedQuery.shodhanikId || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-sm text-gray-900">{selectedQuery.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                    <p className="text-sm text-gray-900">{selectedQuery.mobile}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-block text-xs px-2 py-1 rounded-full border ${getStatusBadge(selectedQuery.status)}`}>
                      {selectedQuery.status || 'Pending'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Submitted At</label>
                    <p className="text-sm text-gray-900">{formatDateTime(selectedQuery.submittedAt)}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Query/Complaint</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedQuery.queryComplaintText}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryComplaintSettings;