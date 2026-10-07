import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Filter, Users, FileCheck, FileX, UserCheck, UserX, Clock } from 'lucide-react';
import API from '@/services/API';

const ItemDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cardData = location.state?.cardData;

  // Map status to icons since we can't pass React components through navigation state
  const getIconByStatus = (status) => {
    const iconMap = {
      qualifiedForAdmission: Users,
      verificationPending: Clock,
      documentVerified: FileCheck,
      documentRejected: FileX,
      admissionCancelled: UserX,
      admitted: UserCheck,
      notAppliedForCounselling: Users,
    };
    return iconMap[status] || Users;
  };

  const StatusIcon = cardData ? getIconByStatus(cardData.status) : Users;

  useEffect(() => {
    const fetchData = async () => {
      if (!cardData?.apiFilter) {
        setError('No filter provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await API.get(`/OfficeDashboard/PHD-Admission?type=${cardData.apiFilter}`);
        setData(response.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cardData?.apiFilter, cardData?.status]);

  // Use actual API data or empty array
  const tableData = data.length > 0 ? data : [];

  if (!cardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No data available</p>
          <button
            onClick={() => navigate('/admission-cell-dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {cardData.title}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-lg"
      >
        <div className="px-6 md:px-8 py-6">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => navigate('/admission-cell-dashboard')}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`${cardData?.iconBg || 'bg-blue-100'} p-3 rounded-lg`}>
                <StatusIcon className={`w-6 h-6 ${cardData?.iconColor || 'text-blue-600'}`} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{cardData?.title || 'Details'}</h1>
                <p className="text-slate-200 text-sm">Total Records: {tableData.length}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="px-6 md:px-8 py-8">
        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Showing {tableData.length} records
            </span>
            {error && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                API Error: {error}
              </span>
            )}
            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
              Filter: {cardData.apiFilter}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Filter size={18} />
              Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
              <Download size={18} />
              Export
            </button>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Application No</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone Number</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Subject</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length > 0 ? (
                  tableData.map((item, index) => (
                    <motion.tr
                      key={item.applicationNo || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.applicationNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.phoneNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.subject}</td>
                      <td className="px-6 py-4 text-sm">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('View button clicked for item:', item);
                            console.log('Available item fields:', Object.keys(item));
                            console.log('Full item data:', item);
                            
                            // Check if sid exists, otherwise use applicationNo or another identifier
                            const scholarId = item.sid || item.scholarId || item.applicationNo;
                            console.log('Using scholar ID:', scholarId);
                            
                            navigate('/admission-cell-dashboard/form', {
                              state: { 
                                sid: scholarId,
                                scholarData: item,
                                cardData: cardData // Pass the original card data for back navigation
                              }
                            });
                          }}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-xs font-medium"
                        >
                          View
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      {loading ? 'Loading...' : error ? 'Failed to load data' : 'No records found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Summary Card */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Count</p>
              <p className="text-3xl font-bold text-blue-600">{cardData.value}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className="text-lg font-semibold text-green-600 capitalize">{cardData.status}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Records Loaded</p>
              <p className="text-lg font-semibold text-purple-600">
                {tableData.length}
              </p>
            </div>
          </div>
        </motion.div> */}
      </div>
    </div>
  );
};

export default ItemDetails;
