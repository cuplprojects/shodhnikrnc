import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit, ExternalLink, Link } from 'lucide-react';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import TableService from '@/services/TableService';

const ExternalLinksSettings = () => {
  const [externalLinks, setExternalLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    category: '',
    status: 'Active',
    displayOrder: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default external links for bulk import
  const defaultLinks = [
    { name: 'University Grants Commission (UGC)', url: 'https://www.ugc.gov.in/', category: 'Government' },
    { name: 'Ministry of Education, Govt. of India', url: 'https://www.education.gov.in/', category: 'Government' },
    { name: 'All India Council for Technical Education (AICTE)', url: 'https://www.aicte-india.org/', category: 'Government' },
    { name: 'Government of Uttar Pradesh', url: 'https://up.gov.in/', category: 'Government' },
    { name: 'UP Higher Education Service Commission', url: 'https://uphesc.org/', category: 'Government' },
    { name: 'Indian Science Technology and Engineering Map (I-STEM)', url: 'https://www.istem.gov.in/', category: 'Research' },
    { name: 'Shodh Ganga', url: 'https://shodhganga.inflibnet.ac.in/', category: 'Research' },
    { name: 'Chaudhary Charan Singh University', url: 'https://www.ccsuniversity.ac.in/', category: 'University' },
    { name: 'National Academy of Sciences, India', url: 'https://www.nasi.org.in/', category: 'Research' },
    { name: 'Government of India', url: 'https://www.india.gov.in/', category: 'Government' },
    { name: 'Elsevier', url: 'https://www.elsevier.com/', category: 'Publisher' },
    { name: 'Springer', url: 'https://www.springer.com/', category: 'Publisher' },
    { name: 'National Testing Agency (NTA)', url: 'https://nta.ac.in/', category: 'Government' },
    { name: 'Council of Scientific & Industrial Research (CSIR)', url: 'https://www.csir.res.in/', category: 'Research' },
    { name: 'Ministry of Electronics and Information Technology', url: 'https://www.meity.gov.in/', category: 'Government' },
    { name: 'Indian Council of Agricultural Research', url: 'https://icar.org.in/', category: 'Research' },
    { name: 'Indian Council of Historical Research', url: 'https://ichr.ac.in/', category: 'Research' }
  ];

  // Fetch external links from API
  const fetchExternalLinks = async () => {
    try {
      setLoading(true);
      
      const response = await API.get('/ExternalLinks');
      if (response.data.success && response.data.data) {
        setExternalLinks(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching external links:', err);
      notification().error('Failed to fetch external links. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Create external link
  const createExternalLink = async (linkData) => {
    try {
      const response = await API.post('/ExternalLinks', linkData);
      if (response.data.success) {
        await fetchExternalLinks(); // Refresh list
        notification().success('External link created successfully!');
        return response.data;
      }
    } catch (err) {
      console.error('Error creating external link:', err);
      notification().error('Failed to create external link');
      throw err;
    }
  };

  // Update external link
  const updateExternalLink = async (id, linkData) => {
    try {
      const response = await API.put(`/ExternalLinks/${id}`, { ...linkData, id });
      if (response.data.success) {
        await fetchExternalLinks(); // Refresh list
        notification().success('External link updated successfully!');
        return response.data;
      }
    } catch (err) {
      console.error('Error updating external link:', err);
      notification().error('Failed to update external link');
      throw err;
    }
  };

  // Delete external link
  const deleteExternalLink = async (id) => {
    try {
      const response = await API.delete(`/ExternalLinks/${id}`);
      if (response.data.success) {
        await fetchExternalLinks(); // Refresh list
        notification().success('External link deleted successfully!');
        return response.data;
      }
    } catch (err) {
      console.error('Error deleting external link:', err);
      notification().error('Failed to delete external link');
      throw err;
    }
  };

  useEffect(() => {
    fetchExternalLinks();
  }, []);

  // Column definitions for external links table
  const externalLinksColumns = useMemo(() => [
    {
      id: 'serialNumber',
      header: 'S.N.',
      cell: ({ row }) => {
        return <div className="font-medium text-gray-900">{row.index + 1}</div>;
      },
      enableSorting: false,
      enableColumnFilter: false,
      size: 60,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <div className="font-medium text-gray-900 max-w-xs truncate" title={getValue()}>
          {getValue() || 'No name'}
        </div>
      ),
    },
    {
      accessorKey: 'url',
      header: 'URL',
      cell: ({ getValue }) => (
        <a
          href={getValue()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm max-w-xs truncate block"
          title={getValue()}
        >
          {getValue() || 'No URL'}
        </a>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => {
        const category = getValue();
        return category ? (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
            {category}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">No category</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue() || 'Active';
        return (
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            status === 'Active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'displayOrder',
      header: 'Order',
      cell: ({ getValue }) => getValue() || 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const link = row.original;
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(link);
              }}
              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit size={14} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(link.id);
              }}
              className="text-red-600 hover:text-red-900 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
  ], []);

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      category: '',
      status: 'Active',
      displayOrder: 0
    });
    setEditingLink(null);
    setIsFormOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingLink) {
        await updateExternalLink(editingLink.id, formData);
      } else {
        await createExternalLink(formData);
      }
      resetForm();
    } catch (error) {
      console.error('Error saving external link:', error);
      // Error notifications are handled in the API functions
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (link) => {
    setEditingLink(link);
    setFormData({
      name: link.name || '',
      url: link.url || '',
      category: link.category || '',
      status: link.status || 'Active',
      displayOrder: link.displayOrder || 0
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this external link?')) {
      try {
        await deleteExternalLink(id);
      } catch (error) {
        console.error('Error deleting external link:', error);
        // Error notification is handled in the API function
      }
    }
  };

  const handleAddNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">External Links Settings</h2>
          <p className="text-gray-600">Manage external links displayed on the homepage</p>
        </div>
      </div>

      {/* Single Link Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-transparent bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {editingLink ? 'Edit External Link' : 'Add New External Link'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter link name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Government, Research, Publisher"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    name="displayOrder"
                    value={formData.displayOrder}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : (editingLink ? 'Update Link' : 'Create Link')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

     

      {/* Links List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">External Links</h3>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Link
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading external links...</p>
          </div>
        ) : externalLinks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Link className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No External Links</h3>
            <p className="text-gray-500 mb-4">Add your first external link to get started</p>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Add First Link
            </button>
          </div>
        ) : (
          <TableService
            columns={externalLinksColumns}
            data={externalLinks}
            initialPageSize={10}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default ExternalLinksSettings;
