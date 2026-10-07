import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Save, X, Upload, Download, ExternalLink } from 'lucide-react';
import API from '@/services/API';
import TableService from '@/services/TableService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const SciPapers = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_scipapers.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_scipapers.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPaper, setEditingPaper] = useState(null);
  const [formData, setFormData] = useState({
    id: 0,
    sid: 0,
    titleOfPaper: '',
    authorName: [],
    nameOfJournal: '',
    yearOfPb: new Date().getFullYear(),
    volume: '',
    issNo: '',
    page: 0,
    citations: '',
    impactFactor: '',
    webUrl: '',
    listedIn: 'SCI',
    ugcListNo: '',
    uploadPaper: null
  });
  const [authorInput, setAuthorInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const tableRef = useRef(null);

  // Define table columns
  const columns = useMemo(() => [
    {
      accessorKey: 'srNo',
      header: 'Sr. No.',
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        return pageIndex * pageSize + row.index + 1;
      },
    },
    {
      accessorKey: 'titleOfPaper',
      header: 'Title of Paper',
      cell: ({ row }) => (
        <div className="text-sm font-medium text-gray-900">
          {row.original.titleOfPaper}
        </div>
      ),
    },
    {
      accessorKey: 'yearOfPb',
      header: 'Publication Year',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.yearOfPb}</div>
      ),
    },
    {
      accessorKey: 'nameOfJournal',
      header: 'Journal Name',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.nameOfJournal}</div>
      ),
    },
    {
      accessorKey: 'authorNames',
      header: 'Author Name',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">
          {Array.isArray(row.original.authorNames) 
            ? row.original.authorNames.join(', ') 
            : row.original.authorNames || 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'issNo',
      header: 'ISSN',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.issNo || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'volume',
      header: 'Volume',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.volume || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'page',
      header: 'Page No.',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.page || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'citations',
      header: 'Citations',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.citations || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'impactFactor',
      header: 'Impact Factor',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.impactFactor || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'listedIn',
      header: 'Listed In',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.listedIn}</div>
      ),
    },
    {
      accessorKey: 'ugcListNo',
      header: 'UGC List No.',
      cell: ({ row }) => (
        <div className="text-sm text-gray-900">{row.original.ugcListNo || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'webUrl',
      header: 'Web URL',
      cell: ({ row }) => {
        const url = row.original.webUrl;
        return url ? (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            View
          </a>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        );
      },
    },
    {
      accessorKey: 'uploadPaper',
      header: 'Paper Document',
      cell: ({ row }) => {
        const paperPath = row.original.uploadPaper;
        return paperPath ? (
          <a 
            href={(() => {
              if (!paperPath) return '';
              
              // Check if it's already a full URL
              if (paperPath.startsWith('http://') || paperPath.startsWith('https://')) {
                return paperPath;
              }
              
              // Use the proper base URL for files
              const baseURL = getBaseFileURL();
              
              // Ensure the path starts with /
              const cleanPath = paperPath.startsWith('/') ? paperPath : `/${paperPath}`;
              
              return `${baseURL}${cleanPath}`;
            })()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Download
          </a>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row.original);
            }}
            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.original.id);
            }}
            className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);

  // Fetch all papers
  const fetchPapers = async () => {
    try {
      setLoading(true);
      const response = await API.get('/ScholarResearch');
      setPapers(Array.isArray(response.data) ? response.data : [response.data]);
    } catch (error) {
      console.error('Error fetching papers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  // Handle author management
  const addAuthor = () => {
    if (authorInput.trim()) {
      setFormData(prev => ({
        ...prev,
        authorName: [...prev.authorName, authorInput.trim()]
      }));
      setAuthorInput('');
    }
  };

  const removeAuthor = (index) => {
    setFormData(prev => ({
      ...prev,
      authorName: prev.authorName.filter((_, i) => i !== index)
    }));
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      id: 0,
      sid: 0,
      titleOfPaper: '',
      authorName: [],
      nameOfJournal: '',
      yearOfPb: new Date().getFullYear(),
      volume: '',
      issNo: '',
      page: 0,
      citations: '',
      impactFactor: '',
      webUrl: '',
      listedIn: 'SCI',
      ugcListNo: '',
      uploadPaper: null
    });
    setAuthorInput('');
    setSelectedFile(null);
    setEditingPaper(null);
    setShowForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Create new paper
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (key === 'authorName') {
          // Send author names as array indices (as per API requirement)
          formData.authorName.forEach((_, index) => {
            formDataToSend.append('AuthorName', index + 1);
          });
        } else if (key !== 'uploadPaper') {
          formDataToSend.append(key.charAt(0).toUpperCase() + key.slice(1), formData[key]);
        }
      });

      // Append file if selected
      if (selectedFile) {
        formDataToSend.append('uploadPaper', selectedFile);
      }

      await API.post('/ScholarResearch', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await fetchPapers();
      resetForm();
      notification().success('Paper created successfully!');
    } catch (error) {
      console.error('Error creating paper:', error);
      notification().error('Error creating paper. Please try again.');
    }
  };

  // Update paper
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (key === 'authorName') {
          formData.authorName.forEach((_, index) => {
            formDataToSend.append('AuthorName', index + 1);
          });
        } else if (key !== 'uploadPaper') {
          formDataToSend.append(key.charAt(0).toUpperCase() + key.slice(1), formData[key]);
        }
      });

      // Append file if selected
      if (selectedFile) {
        formDataToSend.append('uploadPaper', selectedFile);
      }

      await API.put(`/ScholarResearch/${formData.id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      await fetchPapers();
      resetForm();
      notification().success('Paper updated successfully!');
    } catch (error) {
      console.error('Error updating paper:', error);
      notification().error('Error updating paper. Please try again.');
    }
  };

  // Delete paper
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this paper?')) {
      try {
        await API.delete(`/ScholarResearch/${id}`);
        await fetchPapers();
        notification().success('Paper deleted successfully!');
      } catch (error) {
        console.error('Error deleting paper:', error);
        notification().error('Error deleting paper. Please try again.');
      }
    }
  };

  // Edit paper
  const handleEdit = (paper) => {
    setFormData({
      id: paper.id,
      sid: paper.sid || 0,
      titleOfPaper: paper.titleOfPaper || '',
      authorName: Array.isArray(paper.authorNames) ? paper.authorNames : [],
      nameOfJournal: paper.nameOfJournal || '',
      yearOfPb: paper.yearOfPb || new Date().getFullYear(),
      volume: paper.volume || '',
      issNo: paper.issNo || '',
      page: paper.page || 0,
      citations: paper.citations || '',
      impactFactor: paper.impactFactor || '',
      webUrl: paper.webUrl || '',
      listedIn: paper.listedIn || 'SCI',
      ugcListNo: paper.ugcListNo || '',
      uploadPaper: paper.uploadPaper
    });
    setEditingPaper(paper);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg text-gray-600">Loading SCI Papers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SCI Papers </h2>
          <p className="text-gray-600">Manage scholar research papers and publications</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus size={20} />
          Add New Paper
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-transparent bg-opacity-80 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl h-full max-h-[95vh] flex flex-col border border-gray-300">
            {/* Header - Fixed */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingPaper ? 'Edit Paper' : 'Add New Paper'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="sci-paper-form" onSubmit={editingPaper ? handleUpdate : handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title of Paper *
                    </label>
                    <input
                      type="text"
                      name="titleOfPaper"
                      value={formData.titleOfPaper}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  {/* Authors */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Authors
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                      <input
                        type="text"
                        value={authorInput}
                        onChange={(e) => setAuthorInput(e.target.value)}
                        placeholder="Enter author name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
                      />
                      <button
                        type="button"
                        onClick={addAuthor}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.authorName.map((author, index) => (
                        <span
                          key={index}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                        >
                          {author}
                          <button
                            type="button"
                            onClick={() => removeAuthor(index)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Journal Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Journal Name *
                    </label>
                    <input
                      type="text"
                      name="nameOfJournal"
                      value={formData.nameOfJournal}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Year of Publication */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year of Publication *
                    </label>
                    <input
                      type="number"
                      name="yearOfPb"
                      value={formData.yearOfPb}
                      onChange={handleInputChange}
                      min="1900"
                      max="2030"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Volume */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Volume
                    </label>
                    <input
                      type="text"
                      name="volume"
                      value={formData.volume}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* ISSN */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ISSN
                    </label>
                    <input
                      type="text"
                      name="issNo"
                      value={formData.issNo}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Page */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Page Number
                    </label>
                    <input
                      type="number"
                      name="page"
                      value={formData.page}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Citations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Citations
                    </label>
                    <input
                      type="text"
                      name="citations"
                      value={formData.citations}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Impact Factor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Impact Factor
                    </label>
                    <input
                      type="text"
                      name="impactFactor"
                      value={formData.impactFactor}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Listed In */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Listed In
                    </label>
                    <select
                      name="listedIn"
                      value={formData.listedIn}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="SCI">SCI</option>
                      <option value="SCOPUS">SCOPUS</option>
                      <option value="UGC">UGC</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* UGC List No */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UGC List No.
                    </label>
                    <input
                      type="text"
                      name="ugcListNo"
                      value={formData.ugcListNo}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Web URL */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Web URL
                    </label>
                    <input
                      type="url"
                      name="webUrl"
                      value={formData.webUrl}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="https://example.com"
                    />
                  </div>

                  {/* File Upload */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Paper (PDF)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {selectedFile && (
                      <p className="text-sm text-gray-600 mt-1">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                    {editingPaper && formData.uploadPaper && !selectedFile && (
                      <p className="text-sm text-green-600 mt-1">
                        Current file: {formData.uploadPaper.split('/').pop()}
                      </p>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Form Actions - Fixed Footer */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="sci-paper-form"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <Save size={16} />
                {editingPaper ? 'Update Paper' : 'Create Paper'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Papers List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Papers List ({papers.length})
          </h3>
        </div>

        <TableService
          ref={tableRef}
          columns={columns}
          data={papers}
          loading={loading}
          initialPageSize={10}
        />
      </div>
    </div>
  );
};

export default SciPapers;