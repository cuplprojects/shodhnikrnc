import { useState, useEffect, useRef } from 'react';
import { Calendar, Download, Clock } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '../../../services/API';
import TableService from '../../../services/TableService';
import { createColumnHelper } from '@tanstack/react-table';

const ResearchCompendium = () => {
  const tableRef = useRef(null);
  const [compendiums, setCompendiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Research Compendiums from API
  const fetchCompendiums = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/ResearchCompendium');
      
      if (response.data.success) {
        const allCompendiums = response.data.data || [];
        
        // Filter only active compendiums for public view
        const activeCompendiums = allCompendiums.filter(compendium => 
          compendium.status === 'Active'
        );
        
        // Map API data to table format
        const mappedCompendiums = activeCompendiums.map((compendium, index) => ({
          srNo: index + 1,
          id: compendium.id,
          duration: compendium.duration,
          publishingYear: compendium.publishingYear,
          pdfFileName: compendium.pdfFileName,
          status: compendium.status
        }));
        
        setCompendiums(mappedCompendiums);
      } else {
        setError('Failed to fetch research compendiums');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('Error fetching research compendiums:', err);
    } finally {
      setLoading(false);
    }
  };

  // Download PDF
  const handleDownload = async (id, fileName) => {
    try {
      const response = await API.get(`/ResearchCompendium/download/${id}`, {
        responseType: 'blob'
      });
      
      if (response.data) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  // Define table columns
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.display({
      id: 'srNo',
      header: 'Sr. No.',
      cell: (info) => info.row.index + 1,
      size: 80,
    }),
    columnHelper.accessor('duration', {
      header: 'Duration',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {info.getValue()}
          </span>
        </div>
      ),
      size: 200,
    }),
    columnHelper.accessor('publishingYear', {
      header: 'Publishing Year',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{info.getValue()}</span>
        </div>
      ),
      size: 150,
    }),
    columnHelper.accessor('pdfFileName', {
      header: 'Document',
      cell: (info) => {
        const row = info.row.original;
        return info.getValue() ? (
          <button
            onClick={() => handleDownload(row.id, info.getValue())}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Download size={16} />
            <span className="text-sm">Download PDF</span>
          </button>
        ) : (
          <span className="text-sm text-gray-400">No document</span>
        );
      },
      size: 150,
    }),
  ];

  useEffect(() => {
    fetchCompendiums();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-1xl font-bold text-[#0066cc]">
            Research Compendium
          </h1>
          {!loading && (
            <button
              onClick={fetchCompendiums}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Refresh
            </button>
          )}
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
                onClick={fetchCompendiums}
                className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading research compendiums...</p>
          </div>
        )}

        {/* Table Container */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
            <TableService
              ref={tableRef}
              columns={columns}
              data={compendiums}
              loading={loading}
              initialPageSize={10}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ResearchCompendium;
