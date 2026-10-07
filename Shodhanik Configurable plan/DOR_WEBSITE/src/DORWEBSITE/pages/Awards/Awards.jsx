import { useState, useRef, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';

const Awards = () => {
  const [facultiesData, setFacultiesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [expandedFaculties, setExpandedFaculties] = useState({});
  const [awardData, setAwardData] = useState([]);
  const [loadingAwards, setLoadingAwards] = useState(false);
  const tableRef = useRef(null);

  // Fetch faculties and subjects on component mount
  useEffect(() => {
    const fetchFaculties = async () => {
      try {
        setLoading(true);
        const response = await API.get('/FacultyAwards/FacultiesWithSubjects');
        
        const data = response.data;
        setFacultiesData(data);
        
        // Initialize expanded state for all faculties
        const initialExpandedState = {};
        data.forEach((faculty, index) => {
          initialExpandedState[faculty.faculty] = index === 0; // Expand first faculty by default
        });
        setExpandedFaculties(initialExpandedState);
        
        // Set default selected subject (first subject of first faculty)
        if (data.length > 0 && data[0].subjects.length > 0) {
          const firstFaculty = data[0];
          const firstSubject = firstFaculty.subjects[0];
          setSelectedFaculty(firstFaculty.faculty);
          setSelectedSubject(firstSubject.subjectName);
          setSelectedSubjectId(firstSubject.subjectId);
        }
        
      } catch (err) {
        setError(err.message || 'Failed to fetch faculties data');
        console.error('Error fetching faculties:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFaculties();
  }, []);

  // Fetch awards when subject is selected
  useEffect(() => {
    const fetchAwards = async () => {
      if (!selectedSubjectId) return;
      
      try {
        setLoadingAwards(true);
        const response = await API.get(`/FacultyAwards/SubjectAwards/${selectedSubjectId}`);
        
        const data = response.data;
        
        // Transform the data to match the table structure
        const transformedData = [];
        if (data.supervisors) {
          data.supervisors.forEach(supervisor => {
            if (supervisor.awards && supervisor.awards.length > 0) {
              // If supervisor has awards, create a row for each award
              supervisor.awards.forEach(award => {
                transformedData.push({
                  id: award.awardId,
                  name: supervisor.supervisorName,
                  email: supervisor.email,
                  award: award.fellowship,
                  givenBy: award.agency,
                  year: award.year
                });
              });
            } else {
              // If supervisor has no awards, still show them with empty award fields
              transformedData.push({
                id: supervisor.supervisorId,
                name: supervisor.supervisorName,
                email: supervisor.email,
                award: 'No awards yet',
                givenBy: '-',
                year: '-'
              });
            }
          });
        }
        
        setAwardData(transformedData);
        
      } catch (err) {
        console.error('Error fetching awards:', err);
        setAwardData([]); // Set empty array on error
      } finally {
        setLoadingAwards(false);
      }
    };

    fetchAwards();
  }, [selectedSubjectId]);

  const handleSubjectClick = (faculty, subject) => {
    setSelectedFaculty(faculty);
    setSelectedSubject(subject.subjectName);
    setSelectedSubjectId(subject.subjectId);
  };

  const toggleFaculty = (faculty) => {
    setExpandedFaculties(prev => ({
      ...prev,
      [faculty]: !prev[faculty]
    }));
  };

  // Define table columns
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor('id', {
      header: 'Sr. No.',
      cell: (info) => info.row.index + 1,
      size: 50,
    }),
    columnHelper.accessor('name', {
      header: 'Recipients Name',
      cell: (info) => info.getValue(),
      size: 200,
    }),
    columnHelper.accessor('award', {
      header: 'Name of Award',
      cell: (info) => info.getValue(),
      size: 200,
    }),
    columnHelper.accessor('givenBy', {
      header: 'Award Given By',
      cell: (info) => info.getValue(),
      size: 200,
    }),
    columnHelper.accessor('year', {
      header: 'Year',
      cell: (info) => info.getValue(),
      size: 100,
    }),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading faculties...</div>
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
        <h1 className="text-1xl  text-[#0066cc] mb-6">Awards / Fellowships</h1>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Sidebar - Faculty and Subjects */}
            <div className="lg:w-1/4 w-full lg:min-h-[600px] bg-gray-50 p-4 border-r border-gray-200 overflow-y-auto">
              <div className="space-y-2">
                <div className="border-b border-gray-200 mb-2"></div>
                
                {facultiesData.map((facultyData) => (
                  <div key={facultyData.faculty} className="mb-2">
                    <button
                      onClick={() => toggleFaculty(facultyData.faculty)}
                      className="w-full flex items-center justify-between text-lg font-semibold text-gray-800 py-2 px-2 hover:bg-gray-100 rounded cursor-pointer"
                    >
                      <span>{facultyData.faculty}</span>
                      <span className="text-xl">{expandedFaculties[facultyData.faculty] ? '−' : '+'}</span>
                    </button>
                    {expandedFaculties[facultyData.faculty] && (
                      <ul className="space-y-1 text-sm ml-4 mt-2">
                        {facultyData.subjects.map((subject) => (
                          <li
                            key={subject.subjectId}
                            onClick={() => handleSubjectClick(facultyData.faculty, subject)}
                            className={`hover:text-blue-600 cursor-pointer px-2 py-1 rounded ${
                              selectedSubject === subject.subjectName 
                                ? 'text-blue-600 font-medium bg-blue-50' 
                                : 'text-gray-700'
                            }`}
                          >
                            {subject.subjectName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Main content - Awards Table */}
            <div className="lg:w-3/4 w-full p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 border-gray-300">Award Details</h2>
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-700">Selected Subject: </span>
                  <span className="text-sm text-blue-600 font-medium">{selectedSubject || 'None selected'}</span>
                </div>
              </div>

              {loadingAwards ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-lg text-gray-600">Loading awards...</div>
                </div>
              ) : (
                <TableService
                  ref={tableRef}
                  columns={columns}
                  data={awardData}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Awards;
