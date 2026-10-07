import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useState, useRef, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useHeaderSettings } from '@/hooks/useHeaderSettings';

const AffiliatedColleges = () => {
  const [facultiesData, setFacultiesData] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [supervisorsData, setSupervisorsData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [expandedFaculties, setExpandedFaculties] = useState({});
  const [loading, setLoading] = useState(true);
  const [supervisorsLoading, setSupervisorsLoading] = useState(false);
  const [error, setError] = useState(null);
  const tableRef = useRef(null);
  
  // Use header settings hook
  const { headerSettings } = useHeaderSettings();

  // Fetch faculties and subjects on component mount
  useEffect(() => {
    fetchFacultiesWithSubjects();
  }, []);

  const fetchFacultiesWithSubjects = async () => {
    try {
      setLoading(true);
      const response = await API.get('/AffiliatedCollegeSupervisorDetails/FacultiesWithSubjects');
      const data = response.data;
      setFacultiesData(data);
      
      // Initialize expanded faculties state
      const initialExpanded = {};
      data.forEach(faculty => {
        initialExpanded[faculty.faculty] = false;
      });
      setExpandedFaculties(initialExpanded);
      
      // Auto-select first subject if available
      if (data.length > 0 && data[0].subjects.length > 0) {
        const firstSubject = data[0].subjects[0];
        setSelectedSubject(firstSubject);
        fetchSubjectSupervisors(firstSubject.subjectId);
      }
    } catch (error) {
      console.error('Error fetching faculties:', error);
      setError('Failed to load faculties and subjects');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectSupervisors = async (subjectId) => {
    try {
      setSupervisorsLoading(true);
      const response = await API.get(`/AffiliatedCollegeSupervisorDetails/SubjectSupervisors/${subjectId}`);
      const data = response.data;
      setSupervisorsData(data.supervisors || []);
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      setSupervisorsData([]);
    } finally {
      setSupervisorsLoading(false);
    }
  };

  const fetchSupervisorProfile = async (supervisorId) => {
    try {
      const response = await API.get(`/AffiliatedCollegeSupervisorDetails/SupervisorProfile/${supervisorId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supervisor profile:', error);
      return null;
    }
  };

  // Handle subject click
  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    fetchSubjectSupervisors(subject.subjectId);
  };

  // Handle view profile click
  const handleViewProfile = async (supervisor) => {
    const profileData = await fetchSupervisorProfile(supervisor.supervisorId);
    if (profileData) {
      // Transform API data to match the expected format
      const transformedData = {
        id: profileData.profile.supervisorId,
        name: profileData.profile.fullName,
        shodhanikId: profileData.profile.shodhanikId || profileData.profile.supervisorId.toString(),
        rmsId: profileData.profile.applicationNumber,
        designation: profileData.profile.designation,
        department: `${selectedSubject?.subjectName} / ${selectedSubject?.faculty}`,
        college: profileData.profile.collegeName,
        contact: profileData.profile.mobileNo,
        email: profileData.profile.email,
        researchInterests: profileData.researchDetails?.researchArea || 'Research interests not specified',
        experience: profileData.educationDetails?.researchExp || 'Experience not specified',
        educationalQualifications: profileData.qualifications || [],
        careerProfile: profileData.experience || [],
        scholarsGuided: { 
          phd: profileData.researchDetails?.phdAwarded || 0, 
          mphil: profileData.researchDetails?.mPhilAwarded || 0, 
          dissertation: profileData.researchDetails?.dissertation || 0,
          phdUnderSupervision: profileData.researchDetails?.phdUnderSupervision || 0,
          mphilUnderSupervision: profileData.researchDetails?.mPhilUnderSupervision || 0,
          dissertationUnderSupervision: profileData.researchDetails?.dissertationUnderSupervision || 0
        },
        researchIds: { 
          scopus: profileData.researchDetails?.scopus || '', 
          orchid: profileData.researchDetails?.orchid || '', 
          publons: profileData.researchDetails?.publOns || '', 
          vidwan: profileData.researchDetails?.vidwan || '', 
          googleScholar: profileData.researchDetails?.googleScholar || '' 
        },
        awards: profileData.awards || [],
        publications: {
          authoredBooks: 0, 
          editedBooks: 0, 
          ugcPapers: profileData.publications?.length || 0, 
          chapters: 0,
          resourcePerson: 0, 
          organizedEvents: 0, 
          projects: 0,
          adminPositions: 0, 
          presentations: 0, 
          memberships: 0,
          communityService: 0, 
          patents: 0
        },
        detailedPublications: {
          ugcPapers: profileData.publications || [],
          resourcePerson: [],
          adminPositions: []
        },
        // Additional profile data
        profileData: profileData.profile,
        educationDetails: profileData.educationDetails
      };
      setSelectedSupervisor(transformedData);
      setShowModal(true);
    }
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  // Toggle faculty expansion
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
    columnHelper.accessor('fullName', {
      header: 'Name',
      cell: (info) => (
        <div>
          <div className="font-medium">{info.getValue()}</div>
          <div className="text-xs text-gray-500 mt-1">
            Shodhanik Id: {info.row.original.shodhanikId || info.row.original.supervisorId}
          </div>
        </div>
      ),
      size: 200,
    }),
    columnHelper.accessor('designation', {
      header: 'Designation',
      cell: (info) => (
        <div>
          <div className="font-medium">{info.getValue()}</div>
          <div className="text-xs text-gray-500 mt-1">
            {info.row.original.collegeName}
          </div>
        </div>
      ),
      size: 150,
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => <div className="text-sm">{info.getValue()}</div>,
      size: 150,
    }),
    columnHelper.accessor('mobileNo', {
      header: 'Contact',
      cell: (info) => <div className="text-sm">{info.getValue()}</div>,
      size: 100,
    }),
    columnHelper.accessor('action', {
      header: 'Action',
      cell: (info) => (
        <button
          onClick={() => handleViewProfile(info.row.original)}
          className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 border border-blue-300 rounded cursor-pointer"
        >
          View Profile
        </button>
      ),
      size: 100,
    }),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading faculties and subjects...</p>
            </div>
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
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={fetchFacultiesWithSubjects}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
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
        <h1 className="text-1xl text-[#0066cc] mb-6">Supervisors of Affiliated Colleges</h1>

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
                      <span>Faculty of {facultyData.faculty}</span>
                      <span className="text-xl">{expandedFaculties[facultyData.faculty] ? '−' : '+'}</span>
                    </button>
                    {expandedFaculties[facultyData.faculty] && (
                      <ul className="space-y-1 text-sm ml-4 mt-2">
                        {facultyData.subjects.map((subject) => (
                          <li
                            key={subject.subjectId}
                            onClick={() => handleSubjectClick(subject)}
                            className={`hover:text-blue-600 cursor-pointer px-2 py-1 rounded ${
                              selectedSubject?.subjectId === subject.subjectId 
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

            {/* Main content - Supervisor data */}
            <div className="lg:w-3/4 w-full p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 border-gray-300">Supervisor Details</h2>
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-700">Selected Subject: </span>
                  <span className="text-sm text-blue-600 font-medium">
                    {selectedSubject ? selectedSubject.subjectName : 'None selected'}
                  </span>
                </div>
              </div>

              {supervisorsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading supervisors...</p>
                  </div>
                </div>
              ) : (
                <TableService
                  ref={tableRef}
                  columns={columns}
                  data={supervisorsData}
                  onRowClick={(row) => handleViewProfile(row.original)}
                />
              )}
            </div>
          </div>
        </div>

        {!supervisorsLoading && supervisorsData.length === 0 && selectedSubject && (
          <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
            <p className="text-gray-700 text-sm">
              <span className="font-semibold">Info:</span> No supervisors have been recorded for this subject yet. Supervisor data will be updated periodically.
            </p>
          </div>
        )}
      </main>
      <Footer />

      {/* Modal for Supervisor Profile */}
      {showModal && selectedSupervisor && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0099cc] text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1">
                  {selectedSupervisor.profileData?.universityLogo ? (
                    <img 
                      src={`${getBaseFileURL()}/${selectedSupervisor.profileData.universityLogo}`} 
                      alt="University Logo" 
                      className="w-full h-full object-contain rounded-full" 
                      onError={(e) => {
                        console.error('University logo failed to load:', `${getBaseFileURL()}/${selectedSupervisor.profileData.universityLogo}`);
                        e.target.src = "/university/logo.png";
                      }}
                    />
                  ) : headerSettings?.logo ? (
                    <img 
                      src={`${getBaseFileURL()}/${headerSettings.logo}`} 
                      alt="University Logo" 
                      className="w-full h-full object-contain rounded-full" 
                    />
                  ) : (
                    <img 
                      src="/university/logo.png" 
                      alt="University Logo" 
                      className="w-full h-full object-contain rounded-full" 
                    />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {selectedSupervisor.profileData?.universityName || 
                     headerSettings?.universityFullNameEnglish || 
                     headerSettings?.universityNameEnglish || 
                     'Directorate of Research, Nehru Kendra'}
                  </h2>
                  <p className="text-sm">
                    {selectedSupervisor.profileData?.universityNameHindi || 
                     headerSettings?.universityFullNameHindi || 
                     headerSettings?.universityNameHindi || 
                     'Mahatama Jyotiba Phule Rohilkhand University, Bareilly'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-gray-800 mb-2">RESEARCH SUPERVISOR PROFILE</h1>
                <div className="border-t-2 border-gray-600 w-24 mx-auto"></div>
              </div>

              <div className="flex flex-col md:flex-row mb-6 bg-gray-50 p-4 rounded gap-6">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-800">{selectedSupervisor.name}</h2>
                  <p className="text-gray-600">{selectedSupervisor.designation}</p>
                  <p className="text-sm text-gray-500">{selectedSupervisor.department}</p>
                  <p className="text-sm text-gray-500">{selectedSupervisor.college}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Contact: {selectedSupervisor.contact} | Email: {selectedSupervisor.email}
                  </p>
                  {selectedSupervisor.profileData && (
                    <div className="mt-2 text-sm text-gray-500">
                      <p>Shodhanik ID: {selectedSupervisor.shodhanikId}</p>
                     
                      <p>Year: {selectedSupervisor.profileData.year}</p>
                      {selectedSupervisor.profileData.gender && (
                        <p>Gender: {selectedSupervisor.profileData.gender}</p>
                      )}
                      {selectedSupervisor.profileData.nationality && (
                        <p>Nationality: {selectedSupervisor.profileData.nationality}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex justify-center md:justify-end">
                  <div className="w-32 h-40 bg-gray-300 rounded-lg flex items-center justify-center border-2 border-gray-400 shadow-md overflow-hidden">
                    {selectedSupervisor.profileData?.photoPath ? (
                      <img 
                        src={`${getBaseFileURL()}/${selectedSupervisor.profileData.photoPath}`} 
                        alt="Supervisor Photo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Supervisor photo failed to load:', `${getBaseFileURL()}/${selectedSupervisor.profileData.photoPath}`);
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<div class="text-2xl font-bold text-gray-600 text-center">${selectedSupervisor.name.split(' ').map(n => n[0]).join('')}</div>`;
                        }}
                      />
                    ) : (
                      <div className="text-2xl font-bold text-gray-600 text-center">
                        {selectedSupervisor.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              

              {/* Academic Information */}
              {selectedSupervisor.profileData && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2 rounded-t">
                    Academic Information
                  </h3>
                  <div className="border border-gray-300 p-3 rounded-b">
                    {selectedSupervisor.profileData.primarySubject && (
                      <div className="mb-2">
                        <p className="font-medium text-gray-700">Primary Subject:</p>
                        <p className="text-gray-600 text-sm">
                          {selectedSupervisor.profileData.primarySubject.name} / {selectedSupervisor.profileData.primarySubject.faculty}
                        </p>
                      </div>
                    )}
                    {selectedSupervisor.profileData.secondarySubject1 && (
                      <div className="mb-2">
                        <p className="font-medium text-gray-700">Secondary Subject 1:</p>
                        <p className="text-gray-600 text-sm">
                          {selectedSupervisor.profileData.secondarySubject1.name} / {selectedSupervisor.profileData.secondarySubject1.faculty}
                        </p>
                      </div>
                    )}
                    {selectedSupervisor.profileData.secondarySubject2 && (
                      <div>
                        <p className="font-medium text-gray-700">Secondary Subject 2:</p>
                        <p className="text-gray-600 text-sm">
                          {selectedSupervisor.profileData.secondarySubject2.name} / {selectedSupervisor.profileData.secondarySubject2.faculty}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {selectedSupervisor.profileData && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2 rounded-t">
                    Contact Information
                  </h3>
                  <div className="border border-gray-300 p-3 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p><span className="font-medium">Mobile:</span> {selectedSupervisor.profileData.mobileNo}</p>
                        {selectedSupervisor.profileData.alternateMobileNo && (
                          <p><span className="font-medium">Alternate Mobile:</span> {selectedSupervisor.profileData.alternateMobileNo}</p>
                        )}
                        <p><span className="font-medium">Email:</span> {selectedSupervisor.profileData.email}</p>
                      </div>
                      <div>
                        {selectedSupervisor.profileData.universityDomainEmail && (
                          <p><span className="font-medium">University Email:</span> {selectedSupervisor.profileData.universityDomainEmail}</p>
                        )}
                        {selectedSupervisor.profileData.twitterID && (
                          <p><span className="font-medium">Twitter:</span> {selectedSupervisor.profileData.twitterID}</p>
                        )}
                        {selectedSupervisor.profileData.linkedinID && (
                          <p><span className="font-medium">LinkedIn:</span> {selectedSupervisor.profileData.linkedinID}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2 rounded-t">
                  Research Interests / Specialization
                </h3>
                <div className="border border-gray-300 p-3 rounded-b">
                  <p className="text-gray-600">{selectedSupervisor.researchInterests || 'Not specified'}</p>
                  <p className="text-sm text-gray-500 mt-1">Experience: {selectedSupervisor.experience}</p>
                  {selectedSupervisor.educationDetails?.areaOfSpec && (
                    <p className="text-sm text-gray-500 mt-1">Area of Specialization: {selectedSupervisor.educationDetails.areaOfSpec}</p>
                  )}
                </div>
              </div>

              {/* PhD Education Details */}
              {selectedSupervisor.educationDetails && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2 rounded-t">
                    PhD Education Details
                  </h3>
                  <div className="border border-gray-300 p-3 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        {selectedSupervisor.educationDetails.phdSubject && (
                          <p><span className="font-medium">PhD Subject:</span> {selectedSupervisor.educationDetails.phdSubject}</p>
                        )}
                        {selectedSupervisor.educationDetails.phdUniversity && (
                          <p><span className="font-medium">PhD University:</span> {selectedSupervisor.educationDetails.phdUniversity}</p>
                        )}
                        {selectedSupervisor.educationDetails.monthAndYear && (
                          <p><span className="font-medium">Completion:</span> {selectedSupervisor.educationDetails.monthAndYear}</p>
                        )}
                      </div>
                      <div>
                        {selectedSupervisor.educationDetails.supervisorName && (
                          <p><span className="font-medium">PhD Supervisor:</span> {selectedSupervisor.educationDetails.supervisorName}</p>
                        )}
                        {selectedSupervisor.educationDetails.collegeName && (
                          <p><span className="font-medium">College:</span> {selectedSupervisor.educationDetails.collegeName}</p>
                        )}
                      </div>
                    </div>
                    {selectedSupervisor.educationDetails.thesisTitle && (
                      <div className="mt-3">
                        <p><span className="font-medium">Thesis Title:</span> {selectedSupervisor.educationDetails.thesisTitle}</p>
                      </div>
                    )}
                    {selectedSupervisor.educationDetails.researchDesc && (
                      <div className="mt-3">
                        <p><span className="font-medium">Research Description:</span> {selectedSupervisor.educationDetails.researchDesc}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  EDUCATIONAL QUALIFICATIONS
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Course / Degree</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Institution & Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupervisor.educationalQualifications.length > 0 ? (
                        selectedSupervisor.educationalQualifications.map((qual, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.course}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.year}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.institution}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No educational qualifications listed
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  CAREER PROFILE
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Organization</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Designation</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Duration & Duties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupervisor.careerProfile.length > 0 ? (
                        selectedSupervisor.careerProfile.map((career, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{career.organization}</td>
                            <td className="border border-gray-300 px-3 py-2">{career.designation}</td>
                            <td className="border border-gray-300 px-3 py-2">{career.duration}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No career profile information
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  NO. OF RESEARCH SCHOLARS SUCCESSFULLY GUIDED
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Programme</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Awarded</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Under Supervision</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={0 % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-3 py-2">1</td>
                        <td className="border border-gray-300 px-3 py-2">Ph. D.</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.phd}</td>
                        <td className="border border-gray-300 px-3 py-2">-</td>
                      </tr>
                      <tr className={1 % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-3 py-2">2</td>
                        <td className="border border-gray-300 px-3 py-2">M. Phill.</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.mphil}</td>
                        <td className="border border-gray-300 px-3 py-2">-</td>
                      </tr>
                      <tr className={2 % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-3 py-2">3</td>
                        <td className="border border-gray-300 px-3 py-2">Dissertation (M.Ed. / M.A.)</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.dissertation}</td>
                        <td className="border border-gray-300 px-3 py-2">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  RESEARCH PUBLICATION IDs
                </h3>
                <div className="border border-gray-300 p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p><span className="font-medium">Scopus:</span> {selectedSupervisor.researchIds.scopus || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Publons:</span> {selectedSupervisor.researchIds.publons || '-'}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Orchid:</span> {selectedSupervisor.researchIds.orchid || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Vidwan:</span> {selectedSupervisor.researchIds.vidwan || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Google Scholar:</span> {selectedSupervisor.researchIds.googleScholar || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  AWARDS AND FELLOWSHIPS
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Name of Award</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Agency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupervisor.awards.length > 0 ? (
                        selectedSupervisor.awards.map((award, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.name}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.year}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.agency}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No awards or fellowships listed
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  Publications / Academic Activities
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Type</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 1, type: 'Authored Books & Monographs.', count: selectedSupervisor.publications.authoredBooks },
                        { id: 2, type: 'Edited Books.', count: selectedSupervisor.publications.editedBooks },
                        { id: 3, type: 'Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals.', count: selectedSupervisor.publications.ugcPapers },
                        { id: 4, type: 'Chapters / Papers in Edited Books.', count: selectedSupervisor.publications.chapters },
                        { id: 5, type: 'Invited as Resource Lectures Person / Examiner/Expert.', count: selectedSupervisor.publications.resourcePerson },
                        { id: 6, type: 'Seminars / Conferences / Workshops Organized.', count: selectedSupervisor.publications.organizedEvents },
                        { id: 7, type: 'Projects.', count: selectedSupervisor.publications.projects },
                        { id: 8, type: 'Administrative Positions / Assignments Held.', count: selectedSupervisor.publications.adminPositions },
                        { id: 9, type: 'Seminars / Conference Presentations.', count: selectedSupervisor.publications.presentations },
                        { id: 10, type: 'Memberships of Academic / Professional Bodies.', count: selectedSupervisor.publications.memberships },
                        { id: 11, type: 'Participation in Community Service / Exchange Programs / Consulting Activity.', count: selectedSupervisor.publications.communityService },
                        { id: 12, type: 'Patent', count: selectedSupervisor.publications.patents }
                      ].map((item) => (
                        <tr key={item.id} className={item.id % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 px-3 py-2">{item.id}</td>
                          <td className="border border-gray-300 px-3 py-2">{item.type}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed UGC Papers Section */}
              {selectedSupervisor.detailedPublications?.ugcPapers?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals.
                  </h3>
                  <div className="overflow-x-auto border border-gray-300">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Title</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.detailedPublications.ugcPapers.map((paper, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{paper.title}</td>
                            <td className="border border-gray-300 px-3 py-2">{paper.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resource Person Section */}
              {selectedSupervisor.detailedPublications?.resourcePerson?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    Invited as Resource Lectures Person / Examiner/Expert.
                  </h3>
                  <div className="overflow-x-auto border border-gray-300">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Type of Event</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.detailedPublications.resourcePerson.map((event, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{event.type}</td>
                            <td className="border border-gray-300 px-3 py-2">{event.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Administrative Positions Section */}
              {selectedSupervisor.detailedPublications?.adminPositions?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    Administrative Positions / Assignments Held.
                  </h3>
                  <div className="overflow-x-auto border border-gray-300">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Type</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.detailedPublications.adminPositions.map((position, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{position.position}</td>
                            <td className="border border-gray-300 px-3 py-2">{position.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  EDUCATIONAL QUALIFICATIONS
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Course / Degree</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Institution & Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupervisor.educationalQualifications.length > 0 ? (
                        selectedSupervisor.educationalQualifications.map((qual, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.course}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.year}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.institution} - {qual.details}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No educational qualifications listed
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  CAREER PROFILE
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Organization</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Designation</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Duration & Duties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupervisor.careerProfile.length > 0 ? (
                        selectedSupervisor.careerProfile.map((career, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{career.organizationName}</td>
                            <td className="border border-gray-300 px-3 py-2">{career.designation}</td>
                            <td className="border border-gray-300 px-3 py-2">
                              {career.dateFrom} {career.dateTo ? `to ${career.dateTo}` : 'to Present'}
                              {career.natureOfDuties && <div className="mt-1 text-xs text-gray-600">{career.natureOfDuties}</div>}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No career profile information
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  NO. OF RESEARCH SCHOLARS SUCCESSFULLY GUIDED
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Programme</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Awarded</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Under Supervision</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2">1</td>
                        <td className="border border-gray-300 px-3 py-2">Ph. D.</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.phd}</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.phdUnderSupervision}</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="border border-gray-300 px-3 py-2">2</td>
                        <td className="border border-gray-300 px-3 py-2">M. Phill.</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.mphil}</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.mphilUnderSupervision}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2">3</td>
                        <td className="border border-gray-300 px-3 py-2">Dissertation (M.Ed. / M.A.)</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.dissertation}</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.scholarsGuided.dissertationUnderSupervision}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  RESEARCH PUBLICATION IDs
                </h3>
                <div className="border border-gray-300 p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p><span className="font-medium">Scopus:</span> {selectedSupervisor.researchIds.scopus || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Publons:</span> {selectedSupervisor.researchIds.publons || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Vidwan:</span> {selectedSupervisor.researchIds.vidwan || '-'}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Orchid:</span> {selectedSupervisor.researchIds.orchid || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Google Scholar:</span> {selectedSupervisor.researchIds.googleScholar || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  AWARDS AND FELLOWSHIPS
                </h3>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Name of Award</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Agency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupervisor.awards.length > 0 ? (
                        selectedSupervisor.awards.map((award, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.fellowship}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.year}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.agency}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No awards or fellowships listed
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Research Publications Section */}
              {selectedSupervisor.detailedPublications?.ugcPapers?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals
                  </h3>
                  <div className="overflow-x-auto border border-gray-300">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Title</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Journal</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Impact Factor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.detailedPublications.ugcPapers.map((paper, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{paper.titleOfPaper}</td>
                            <td className="border border-gray-300 px-3 py-2">{paper.journalName}</td>
                            <td className="border border-gray-300 px-3 py-2">{paper.pubYear}</td>
                            <td className="border border-gray-300 px-3 py-2">{paper.impactFactor || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-center mt-6">
                <button
                  onClick={closeModal}
                  className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliatedColleges;
