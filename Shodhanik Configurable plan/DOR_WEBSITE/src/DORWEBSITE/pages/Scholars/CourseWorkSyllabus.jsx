import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import TableService from '@/services/TableService';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { Download, FileText, Eye, ExternalLink } from 'lucide-react';

const CourseWorkSyllabus = () => {
  const [syllabusData, setSyllabusData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle file preview
  const handlePreview = (filePath) => {
    try {
      const baseURL = getBaseFileURL();
      const fullURL = `${baseURL}/${filePath}`;
      window.open(fullURL, '_blank');
    } catch (error) {
      console.error('Error previewing file:', error);
      alert('Error opening file preview. Please try again.');
    }
  };

  // Handle file download
  const handleDownload = (filePath, fileName) => {
    try {
      const baseURL = getBaseFileURL();
      const fullURL = `${baseURL}/${filePath}`;
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = fullURL;
      link.download = fileName || 'syllabus.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  // Define table columns
  const columns = [
    {
      id: 'serialNumber',
      header: 'S.N.',
      cell: ({ row }) => (
        <div className="font-medium text-gray-900 text-center">
          {row.index + 1}
        </div>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      size: 80,
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ getValue }) => (
        <div className="text-gray-700 font-medium">
          {getValue() || 'N/A'}
        </div>
      ),
      enableColumnFilter: true,
      filterFn: 'includesString',
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ getValue }) => (
        <div className="text-gray-700">
          {getValue() || 'N/A'}
        </div>
      ),
      enableColumnFilter: true,
      filterFn: 'includesString',
    },
    {
      accessorKey: 'syllabusFilePath',
      header: 'Actions',
      cell: ({ getValue, row }) => {
        const filePath = getValue();
        const fileName = filePath ? filePath.split('/').pop() : 'syllabus.pdf';
        const originalData = row.original;
        
        return (
          <div className="flex justify-center gap-2">
            {filePath ? (
              <>
                <button
                  onClick={() => handlePreview(filePath)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium cursor-pointer"
                  title="Preview Syllabus"
                >
                  <Eye size={14} />
                  View
                </button>
                <button
                  onClick={() => handleDownload(filePath, fileName)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#0066cc] text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium cursor-pointer"
                  title="Download Syllabus"
                >
                  <Download size={14} />
                  Download
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 text-gray-400 text-sm">
                <FileText size={14} />
                No file available
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
      size: 200,
    },
  ];

  // Fetch PhD syllabus data
  const fetchSyllabusData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/PhdSyllabus');
      
      // Extract data from the response structure
      if (response.data && response.data.success && response.data.data) {
        setSyllabusData(Array.isArray(response.data.data) ? response.data.data : [response.data.data]);
      } else if (Array.isArray(response.data)) {
        setSyllabusData(response.data);
      } else {
        setSyllabusData([]);
      }
    } catch (err) {
      console.error('Error fetching syllabus data:', err);
      setError('Failed to load syllabus data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyllabusData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col cursor-pointer">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full cursor-pointer">
        <div className="mb-6">
          <h1 className="text-1xl font-bold text-[#0066cc] mb-2">Course Work Syllabus</h1>
          <p className="text-gray-600">Download and view syllabus documents for various departments and subjects</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
          {error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={fetchSyllabusData}
                className="px-4 py-2 bg-[#0066cc] text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <TableService
              columns={columns}
              data={syllabusData}
              loading={loading}
              initialPageSize={15}
              enableGlobalFilter={true}
              globalFilterPlaceholder="Search syllabus..."
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CourseWorkSyllabus;
