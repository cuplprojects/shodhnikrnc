import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import TableService from '@/services/TableService';
import API from '@/services/API';
import { User, Building, GraduationCap } from 'lucide-react';

const CourseWorkCoordinators = () => {
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      accessorKey: 'name',
      header: 'Co-ordinator Name',
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <User size={16} className="text-blue-600" />
          <span className="font-medium text-gray-900">
            {getValue() || 'N/A'}
          </span>
        </div>
      ),
      enableColumnFilter: true,
      filterFn: 'includesString',
    },
    {
      accessorKey: 'affiliationResearchCenter',
      header: 'Research Center',
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <Building size={16} className="text-green-600" />
          <span className="text-gray-700">
            {getValue() || 'N/A'}
          </span>
        </div>
      ),
      enableColumnFilter: true,
      filterFn: 'includesString',
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-purple-600" />
          <span className="text-gray-700">
            {getValue() || 'N/A'}
          </span>
        </div>
      ),
      enableColumnFilter: true,
      filterFn: 'includesString',
    },
  ];

  // Fetch coordinators data
  const fetchCoordinators = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/CoOrdinators');
      
      // Handle different response structures
      if (response.data && response.data.success && response.data.data) {
        setCoordinators(Array.isArray(response.data.data) ? response.data.data : [response.data.data]);
      } else if (Array.isArray(response.data)) {
        setCoordinators(response.data);
      } else {
        setCoordinators([]);
      }
    } catch (err) {
      console.error('Error fetching coordinators:', err);
      setError('Failed to load coordinators data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col cursor-pointer">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full cursor-pointer">
        <div className="mb-6">
          <h1 className="text-1xl font-bold text-[#0066cc] mb-2">Course Work Co-Ordinators</h1>
          <p className="text-gray-600">Details of course work coordinators across departments and research centers</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
          {error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={fetchCoordinators}
                className="px-4 py-2 bg-[#0066cc] text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <TableService
              columns={columns}
              data={coordinators}
              loading={loading}
              initialPageSize={15}
              enableGlobalFilter={true}
              globalFilterPlaceholder="Search coordinators..."
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};
export default CourseWorkCoordinators;
