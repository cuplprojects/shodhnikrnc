import { useEffect, useState, useRef } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';
import TableService from '@/services/TableService';

const AvailableSeats = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        setLoading(true);
        const response = await API.get('/Dor/Counts');
        
        // Map API response to table format
        const mappedData = response.data.map((item, index) => ({
          srNo: index + 1,
          subject: item.subject,
          seatsAvailable: item.seatsAvailable,
        }));
        
        setData(mappedData);
        setError(null);
      } catch (err) {
        console.error('Error fetching available seats:', err);
        setError('Failed to load available seats data');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();
  }, []);

  // Color palette for subject cells
  const colors = [
    'bg-purple-100 text-purple-900',
    'bg-blue-100 text-blue-900',
    'bg-pink-100 text-pink-900',
    'bg-green-100 text-green-900',
    'bg-yellow-100 text-yellow-900',
    'bg-indigo-100 text-indigo-900',
    'bg-red-100 text-red-900',
    'bg-cyan-100 text-cyan-900',
  ];

  const columns = [
    {
      accessorKey: 'srNo',
      header: 'Sr. No.',
      cell: (info) => info.getValue(),
    },
    {
      accessorKey: 'subject',
      header: 'Department / Subject',
      cell: (info) => {
        const rowIndex = info.row.index;
        const colorClass = colors[rowIndex % colors.length];
        return (
          <span className={`px-2 py-1 rounded-lg text-sm font-medium w-fit inline-block ${colorClass}`}>
            {info.getValue()}
          </span>
        );
      },
    },
    {
      accessorKey: 'seatsAvailable',
      header: 'Seats Available',
      cell: (info) => info.getValue(),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        <h1 className="text-1xl font-bold text-[#0066cc] mb-6">Available Seats for Admission</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading available seats...</div>
          ) : (
            <TableService
              ref={tableRef}
              columns={columns}
              data={data}
              initialPageSize={10}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AvailableSeats;
