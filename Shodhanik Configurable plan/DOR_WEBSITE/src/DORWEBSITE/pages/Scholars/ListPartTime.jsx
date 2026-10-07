import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useState, useEffect, useRef } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import TableService from '@/services/TableService';
import API from '@/services/API';
import { ChevronDown, ChevronUp } from 'lucide-react';

const ListPartTime = () => {
  const [scholarsByDepartment, setScholarsByDepartment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [expandAll, setExpandAll] = useState(true);
  const tableRef = useRef(null);

  useEffect(() => {
    const fetchScholars = async () => {
      try {
        setLoading(true);
        const response = await API.get('/Campus/PartTimeScholarsByDepartment');
        setScholarsByDepartment(response.data);
        
        // Initialize all departments as expanded
        const initialExpandedState = {};
        response.data.forEach((dept) => {
          initialExpandedState[dept.departmentId] = true;
        });
        setExpandedDepartments(initialExpandedState);
        
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to fetch scholars data');
        console.error('Error fetching scholars:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScholars();
  }, []);

  // Toggle all departments
  const handleToggleAll = () => {
    const newExpandAll = !expandAll;
    setExpandAll(newExpandAll);
    const newState = {};
    scholarsByDepartment.forEach((dept) => {
      newState[dept.departmentId] = newExpandAll;
    });
    setExpandedDepartments(newState);
  };

  // Toggle individual department
  const toggleDepartment = (departmentId) => {
    setExpandedDepartments(prev => ({
      ...prev,
      [departmentId]: !prev[departmentId]
    }));
  };

  // Define table columns
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor((row) => row, {
      id: 'srNo',
      header: 'Sr. No.',
      cell: (info) => info.row.index + 1,
      size: 50,
    }),
    columnHelper.accessor('scholarName', {
      header: 'Scholar Name',
      cell: (info) => (
        <div>
          <div className="font-medium">{info.row.original.scholarName}</div>
          <div className="text-xs text-gray-500 mt-1">
            {info.row.original.scholarShodhanikId}
          </div>
        </div>
      ),
      size: 200,
    }),
    columnHelper.accessor('supervisorName', {
      header: 'Supervisor',
      cell: (info) => (
        <div>
          <div className="font-medium">{info.row.original.supervisorName}</div>
          <div className="text-xs text-gray-500 mt-1">
            {info.row.original.supervisorShodhanikId}
          </div>
        </div>
      ),
      size: 200,
    }),
    columnHelper.accessor('college', {
      header: 'College',
      cell: (info) => info.getValue(),
      size: 200,
    }),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-600">Error: {error}</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        <h1 className="text-1xl font-bold text-[#0066cc] mb-8">Part-Time Scholars List</h1>

        {scholarsByDepartment.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-700 leading-relaxed">No departments found.</p>
          </div>
        ) : (
          <>
            {/* Toggle All Button */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleToggleAll}
                className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 cursor-pointer ${
                  expandAll
                    ? 'bg-[#0066cc] text-white hover:bg-[#0052a3]'
                    : 'bg-gray-400 text-white hover:bg-gray-500'
                }`}
              >
                {expandAll ? (
                  <>
                    <ChevronUp size={18} />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronDown size={18} />
                    Expand All
                  </>
                )}
              </button>
            </div>

            {/* Departments List */}
            <div className="space-y-4">
              {scholarsByDepartment.map((department, deptIndex) => {
                const isExpanded = expandedDepartments[department.departmentId];
                const tableData = department.scholars.map((scholar) => ({
                  ...scholar,
                }));

                return (
                  <div key={deptIndex} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Department Header with Toggle */}
                    <div
                      onClick={() => toggleDepartment(department.departmentId)}
                      className="bg-gray-200 text-gray-800 px-6 py-4 cursor-pointer hover:bg-gray-300 transition-colors flex items-center justify-between"
                    >
                      <h2 className="text-xl font-bold">{department.departmentName}</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          ({department.scholars.length} scholars)
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={24} />
                        ) : (
                          <ChevronDown size={24} />
                        )}
                      </div>
                    </div>

                    {/* Scholars Table - Collapsible */}
                    {isExpanded && (
                      <>
                        <div className="p-4">
                          {tableData.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p>No scholars data available for this department</p>
                            </div>
                          ) : (
                            <TableService
                              ref={tableRef}
                              columns={columns}
                              data={tableData}
                              initialPageSize={10}
                              loading={false}
                            />
                          )}
                        </div>

                        {/* Scholar Count Footer */}
                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-300">
                          <p className="text-sm text-gray-600">
                            Total Scholars: <span className="font-semibold">{department.scholars.length}</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ListPartTime;
