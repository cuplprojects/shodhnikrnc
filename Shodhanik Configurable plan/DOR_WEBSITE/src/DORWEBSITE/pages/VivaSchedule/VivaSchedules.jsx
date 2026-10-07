import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRef, useState, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';

const VivaSchedules = () => {
  const tableRef = useRef(null);
  const [vivaScheduleData, setVivaScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch viva schedule data from API
  useEffect(() => {
    const fetchVivaData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await API.get('/Viva');
        
        // Transform API data to match table structure
        const transformedData = response.data.map((item, index) => ({
          srNo: index + 1,
          date: item.vivaDate ? new Date(item.vivaDate).toLocaleDateString('en-GB') : null,
          scholar: `${item.permUserName}\n${item.name}`,
          faculty: item.department,
          supervisor: `${item.supervisorName}\n${item.supervisorCollegeName}`,
          coSupervisor: '', // Not available in API response
          phdTitle: item.thesisTitle,
          venue: item.venue 
        }));
        
        setVivaScheduleData(transformedData);
      } catch (err) {
        console.error('Error fetching viva data:', err);
        setError('Failed to load viva schedule data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchVivaData();
  }, []);

  // Define table columns
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor('srNo', {
      header: () => <div className="text-center font-semibold text-gray-800">Sr No</div>,
      cell: (info) => <div className="text-center font-medium">{info.getValue()}</div>,
      size: 50,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('date', {
      header: () => <div className="text-center font-semibold text-gray-800">Date</div>,
      cell: (info) => (
        <div className="text-center">
          {info.getValue() ? (
            <span className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs font-semibold">
              {info.getValue()}
            </span>
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </div>
      ),
      size: 90,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('scholar', {
      header: () => <div className="text-center font-semibold text-gray-800">Scholar</div>,
      cell: (info) => (
        <div className="text-center whitespace-pre-line font-medium text-[#0066cc] text-xs leading-tight">
          {info.getValue()}
        </div>
      ),
      size: 120,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('faculty', {
      header: () => <div className="text-center font-semibold text-gray-800">Faculty</div>,
      cell: (info) => (
        <div className="text-center">
          <span className="bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs font-medium">
            {info.getValue()}
          </span>
        </div>
      ),
      size: 80,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('supervisor', {
      header: () => <div className="text-center font-semibold text-gray-800">Supervisor</div>,
      cell: (info) => (
        <div className="text-center whitespace-pre-line text-gray-700 text-xs leading-tight">
          {info.getValue()}
        </div>
      ),
      size: 150,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('coSupervisor', {
      header: () => <div className="text-center font-semibold text-gray-800">Co-Supervisor</div>,
      cell: (info) => (
        <div className="text-center">
          {info.getValue() ? (
            <div className="whitespace-pre-line text-gray-700 text-xs leading-tight">
              {info.getValue()}
            </div>
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </div>
      ),
      size: 110,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('phdTitle', {
      header: () => <div className="text-center font-semibold text-gray-800">Ph.D. Title</div>,
      cell: (info) => (
        <div className="text-center text-gray-700 leading-tight text-xs px-1">
          {info.getValue()}
        </div>
      ),
      size: 200,
      meta: { headerClassName: 'text-center' }
    }),
    columnHelper.accessor('venue', {
      header: () => <div className="text-center font-semibold text-gray-800">Venue</div>,
      cell: (info) => (
        <div className="text-center text-gray-600 text-xs leading-tight px-1">
          {info.getValue() || <span className="text-gray-400 italic">-</span>}
        </div>
      ),
      size: 160,
      meta: { headerClassName: 'text-center' }
    }),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-6xl mx-auto px-4 py-6 w-full">
        {/* Page Header Section */}
        <div >
          <h1 className="text-1xl font-bold text-[#0066cc] mb-1">Viva Schedules</h1>
          <p className="text-gray-600 text-sm">Ph.D. Viva Voce Examination Schedule</p>
         
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#0066cc] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading viva schedules...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-600 mb-4">
              {error || 'Failed to load data. Please try again later.'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-[#0066cc] text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table Container */}
        {!loading && !error && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <TableService
                ref={tableRef}
                columns={columns}
                data={vivaScheduleData}
              />
            </div>
            {vivaScheduleData.length === 0 && (
              <div className="text-center py-8 text-gray-500 border-t">
                <div className="mb-3">
                  <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p>No viva schedules available at the moment.</p>
                <p className="text-xs text-gray-400 mt-1">Please check back later for updates.</p>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default VivaSchedules;