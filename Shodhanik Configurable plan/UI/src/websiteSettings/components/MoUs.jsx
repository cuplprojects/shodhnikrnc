import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Download } from 'lucide-react';
import API from '@/services/API';
import MoUForm from './MoUForm';
import TableService from '@/services/TableService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { hasPermission } from '@/services/hasPermissionService';

const MoUs = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_mous.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_mous.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [mous, setMoUs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMoU, setEditingMoU] = useState(null);
  const tableRef = useRef();

  // Fetch MoUs from API
  const fetchMoUs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/MoUs');
      if (response.data.success) {
        setMoUs(response.data.data || []);
      }
    } catch (err) {
      setError('Failed to fetch MoUs. Please try again later.');
      console.error('Error fetching MoUs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete MoU
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this MoU?')) {
      return;
    }

    try {
      const response = await API.delete(`/MoUs/${id}`);
      if (response.data.success) {
        await fetchMoUs(); // Refresh the list
      }
    } catch (err) {
      setError('Failed to delete MoU. Please try again.');
      console.error('Error deleting MoU:', err);
    }
  };

  // Download PDF
  const handleDownload = async (id, fileName) => {
    try {
      const response = await API.get(`/MoUs/download/${id}`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download PDF. Please try again.');
      console.error('Error downloading file:', err);
    }
  };

  // Handle form submission
  const handleFormSubmit = async () => {
    await fetchMoUs();
    setShowForm(false);
    setEditingMoU(null);
  };

  // Get file URL for display
  const getFileUrl = (filePath) => {
    if (!filePath) return '';
    
    // Check if it's already a full URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    
    // Use the proper base URL for files
    const baseURL = getBaseFileURL();
    
    // Ensure the path starts with /
    const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    
    return `${baseURL}${cleanPath}`;
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Archive': return 'bg-gray-100 text-gray-800';
      case 'Delete': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Define table columns
  const columns = useMemo(() => [
    {
      id: 'sn',
      header: 'S.N.',
      size: 50,
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-gray-900">
          {row.index + 1}
        </span>
      ),
    },
    {
      accessorKey: 'institutionName',
      header: 'Institution Name',
      size: 200,
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900 block truncate">
          {row.original.institutionName}
        </span>
      ),
    },
    {
      accessorKey: 'countryOfInstitution',
      header: 'Country',
      size: 130,
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.countryOfInstitution}
        </span>
      ),
    },
    {
      accessorKey: 'department',
      header: 'Department',
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.department || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'natureOfMoU',
      header: 'Nature of MoU',
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.natureOfMoU || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'year',
      header: 'Year',
      size: 100,
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900">
          {row.original.year}
        </span>
      ),
    },
    {
      accessorKey: 'pdfFileName',
      header: 'PDF File',
      size: 180,
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">
          {row.original.pdfFileName ? (
            <a
              href={getFileUrl(row.original.pdfFileName)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline truncate block"
              title={row.original.pdfFileName}
            >
              {row.original.pdfFileName}
            </a>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 110,
      cell: ({ row }) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.original.status)}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.pdfFileName && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(row.original.id, row.original.pdfFileName);
              }}
              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="Download PDF"
            >
              <Download size={16} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingMoU(row.original);
              setShowForm(true);
            }}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit MoU"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.original.id);
            }}
            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete MoU"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);

  useEffect(() => {
    fetchMoUs();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066cc] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading MoUs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">MoUs</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage Memorandums of Understanding and their documents
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMoU(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus size={16} />
          Add MoU
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={fetchMoUs}
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* MoUs Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <TableService
          ref={tableRef}
          columns={columns}
          data={mous}
          loading={loading}
          initialPageSize={10}
        />
      </div>

      

      {/* Form Modal */}
      {showForm && (
        <MoUForm
          mou={editingMoU}
          onClose={() => {
            setShowForm(false);
            setEditingMoU(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
};

export default MoUs;