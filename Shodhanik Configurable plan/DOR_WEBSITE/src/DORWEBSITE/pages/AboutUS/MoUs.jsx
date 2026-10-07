import { useState, useEffect, useRef } from 'react';
import { Calendar, Download, Globe, Building } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '../../../services/API';
import TableService from '../../../services/TableService';
import { createColumnHelper } from '@tanstack/react-table';

const MoUs = () => {
  const tableRef = useRef(null);
  const [mous, setMoUs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch MoUs from API
  const fetchMoUs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/MoUs');
      
      if (response.data.success) {
        const allMoUs = response.data.data || [];
        
        // Filter only active MoUs for public view
        const activeMoUs = allMoUs.filter(mou => {
          const status = mou.status || mou.Status || '';
          // Show all MoUs except those explicitly marked as 'Archive' or 'Delete'
          return status !== 'Archive' && status !== 'Delete';
        });
        
        // Map API data to table format
        const mappedMoUs = activeMoUs.map((mou) => ({
          id: mou.id || mou.Id,
          institutionName: mou.institutionName || mou.InstitutionName,
          countryOfInstitution: mou.countryOfInstitution || mou.CountryOfInstitution,
          department: mou.department || mou.Department,
          natureOfMoU: mou.natureOfMoU || mou.NatureOfMoU,
          year: mou.year || mou.Year,
          pdfFileName: mou.pdfFileName || mou.PdfFileName,
          status: mou.status || mou.Status
        }));
        
        setMoUs(mappedMoUs);
      } else {
        setError('Failed to fetch MoUs from server');
      }
    } catch (err) {
      setError('Failed to fetch MoUs. Please try again later.');
      console.error('Error fetching MoUs:', err);
    } finally {
      setLoading(false);
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
      console.error('Error downloading file:', err);
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
    columnHelper.accessor('institutionName', {
      header: 'Institution Details',
      cell: (info) => {
        const row = info.row.original;
        return (
          <div>
            <div className="text-sm font-medium text-gray-900 mb-1">
              {info.getValue()}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Globe size={12} />
              {row.countryOfInstitution}
            </div>
          </div>
        );
      },
      size: 250,
    }),
    columnHelper.accessor('department', {
      header: 'Department',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Building size={14} className="text-gray-400" />
          <span className="text-sm text-gray-900">
            {info.getValue() || 'N/A'}
          </span>
        </div>
      ),
      size: 150,
    }),
    columnHelper.accessor('natureOfMoU', {
      header: 'Nature of MoU',
      cell: (info) => (
        <div className="text-sm text-gray-900">
          {info.getValue() || 'N/A'}
        </div>
      ),
      size: 180,
    }),
    columnHelper.accessor('year', {
      header: 'Year',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{info.getValue()}</span>
        </div>
      ),
      size: 100,
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
    fetchMoUs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-1xl font-bold text-[#0066cc]">Memorandums of Understanding (MoUs)</h1>
          {!loading && (
            <button
              onClick={fetchMoUs}
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
                onClick={fetchMoUs}
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
            <p className="text-gray-600">Loading MoUs...</p>
          </div>
        )}

        {/* Table Container */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
            <TableService
              ref={tableRef}
              columns={columns}
              data={mous}
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

export default MoUs;
