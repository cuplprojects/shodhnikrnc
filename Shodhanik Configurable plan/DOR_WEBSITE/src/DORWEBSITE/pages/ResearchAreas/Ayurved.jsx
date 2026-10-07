import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useState, useRef, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useHeaderSettings } from '@/hooks/useHeaderSettings';

const Ayurved = () => {
  const [supervisorsData, setSupervisorsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const tableRef = useRef(null);

  // Get header settings for university information
  const { headerSettings } = useHeaderSettings();

  useEffect(() => {
    const fetchAyurvedSupervisors = async () => {
      try {
        setLoading(true);
        const response = await API.get('/WebsiteSupervisorDetails/FacultiesWithSubjects');
        
        const data = response.data;
        const ayurvedFaculty = data.find(faculty => 
          faculty.faculty.toLowerCase().includes('ayurved')
        );
        
        if (ayurvedFaculty && ayurvedFaculty.subjects) {
          const allSupervisors = [];
          let srNo = 1;
          
          for (const subject of ayurvedFaculty.subjects) {
            try {
              const supervisorResponse = await API.get(`/WebsiteSupervisorDetails/SubjectSupervisors/${subject.subjectId}`);
              const supervisorData = supervisorResponse.data;
              
              if (supervisorData.supervisors && supervisorData.supervisors.length > 0) {
                for (const supervisor of supervisorData.supervisors) {
                  try {
                    // Fetch detailed profile to get actual college/university information
                    const profileResponse = await API.get(`/WebsiteSupervisorDetails/SupervisorProfile/${supervisor.supervisorId}`);
                    const profileData = profileResponse.data;
                    
                    // Use actual college/university information from profile
                    let collegeName = 'Faculty of Ayurved';
                    if (profileData?.profile?.universityName) {
                      collegeName = profileData.profile.universityName;
                    } else if (profileData?.profile?.collegeName) {
                      collegeName = profileData.profile.collegeName;
                    } else if (profileData?.profile?.instituteName) {
                      collegeName = profileData.profile.instituteName;
                    } else if (supervisor.departmentInfo && supervisor.departmentInfo !== subject.subjectName) {
                      collegeName = supervisor.departmentInfo;
                    } else {
                      collegeName = `Department of ${subject.subjectName} / Faculty of Ayurved`;
                    }
                    
                    allSupervisors.push({
                      srNo: srNo++,
                      supervisorName: `${supervisor.title} ${supervisor.fullName}`,
                      subject: subject.subjectName,
                      college: collegeName,
                      link: 'Profile',
                      supervisorId: supervisor.supervisorId,
                      educationDetails: profileData.educationDetails
                    });
                  } catch (profileError) {
                    console.error(`Error fetching profile for supervisor ${supervisor.supervisorId}:`, profileError);
                    // Fallback to basic info if profile fetch fails
                    allSupervisors.push({
                      srNo: srNo++,
                      supervisorName: `${supervisor.title} ${supervisor.fullName}`,
                      subject: subject.subjectName,
                      college: supervisor.departmentInfo || 'Faculty of Ayurved',
                      link: 'Profile',
                      supervisorId: supervisor.supervisorId,
                      educationDetails: {}
                    });
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching supervisors for subject ${subject.subjectName}:`, err);
            }
          }
          
          setSupervisorsData(allSupervisors);
        }
        
      } catch (err) {
        setError(err.message || 'Failed to fetch supervisors data');
        console.error('Error fetching supervisors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAyurvedSupervisors();
  }, []);

  // Handle view profile click
  const handleViewProfile = async (supervisor) => {
    try {
      console.log('handleViewProfile called with:', supervisor);
      
      if (!supervisor) {
        console.error('No supervisor data provided');
        return;
      }

      const supervisorId = supervisor.supervisorId;
      
      if (!supervisorId) {
        console.error('No supervisor ID found in data:', supervisor);
        return;
      }

      console.log('Fetching profile for supervisor ID:', supervisorId);
      
      // First, show the modal with basic data
      const basicData = {
        id: supervisorId,
        name: supervisor.supervisorName,
        shodhanikId: supervisorId.toString(),
        rmsId: 'N/A',
        designation: 'Supervisor',
        department: supervisor.subject || 'Department',
        campus: headerSettings?.universityNameEnglish || 'University Campus',
        contact: 'N/A',
        email: 'N/A',
        researchInterests: 'Loading...',
        experience: 'Loading...',
        educationalQualifications: [],
        careerProfile: [],
        scholarsGuided: { 
          phd: 0, 
          mphil: 0, 
          dissertation: 0,
          phdUnderSupervision: 0,
          mphilUnderSupervision: 0,
          dissertationUnderSupervision: 0
        },
        researchIds: { 
          scopus: '', 
          orchid: '', 
          publons: '', 
          vidwan: '', 
          googleScholar: '' 
        },
        awards: [],
        publications: {
          authoredBooks: 0, 
          editedBooks: 0, 
          ugcPapers: 0, 
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
          ugcPapers: [],
          resourcePerson: [],
          adminPositions: []
        },
        profileData: {
          year: new Date().getFullYear(),
          gender: 'N/A',
          nationality: 'N/A'
        },
        educationDetails: {}
      };

      console.log('Setting basic data and showing modal');
      setSelectedSupervisor(basicData);
      setShowModal(true);

      // Then try to fetch detailed profile data
      try {
        const profileData = await fetchSupervisorProfile(supervisorId);
        
        if (profileData) {
          console.log('Profile data received:', profileData);
          // Transform API data to match the expected format
          const transformedData = {
            id: profileData.profile?.supervisorId || supervisorId,
            name: profileData.profile?.fullName || supervisor.supervisorName,
            shodhanikId: profileData.profile?.shodhanikId || supervisorId.toString(),
            rmsId: profileData.profile?.applicationNumber || 'N/A',
            designation: profileData.profile?.designation || 'Supervisor',
            department: supervisor.subject || 'Department',
            campus: profileData.profile?.universityName || headerSettings?.universityNameEnglish || 'University Campus',
            contact: profileData.profile?.mobileNo || 'N/A',
            email: profileData.profile?.email || 'N/A',
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
            profileData: profileData.profile || basicData.profileData,
            educationDetails: profileData.educationDetails || {}
          };
          
          console.log('Updating modal with detailed data');
          setSelectedSupervisor(transformedData);
        } else {
          console.log('No detailed profile data, keeping basic data');
        }
      } catch (profileError) {
        console.error('Error fetching detailed profile:', profileError);
        // Keep the basic data that's already showing
      }
      
    } catch (error) {
      console.error('Error in handleViewProfile:', error);
      console.error('Supervisor data:', supervisor);
    }
  };

  const fetchSupervisorProfile = async (supervisorId) => {
    try {
      const response = await API.get(`/WebsiteSupervisorDetails/SupervisorProfile/${supervisorId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supervisor profile:', error);
      return null;
    }
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor('srNo', {
      header: 'Sr. No.',
      cell: (info) => info.getValue(),
      size: 80,
    }),
    columnHelper.accessor('supervisorName', {
      header: 'Supervisor Name',
      cell: (info) => info.getValue(),
      size: 200,
    }),
    columnHelper.accessor('subject', {
      header: 'Subject',
      cell: (info) => info.getValue(),
      size: 200,
    }),
    columnHelper.accessor('college', {
      header: 'College',
      cell: (info) => {
        const supervisor = info.row.original;
        // Return college name from educationDetails if available, otherwise use the college field
        return supervisor.educationDetails?.collegeName || info.getValue();
      },
      size: 300,
    }),
    columnHelper.accessor('link', {
      header: 'Link',
      cell: (info) => (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Profile button clicked for:', info.row.original);
            handleViewProfile(info.row.original);
          }}
          className="text-blue-600 hover:text-blue-800 text-sm cursor-pointer bg-transparent border-none underline px-2 py-1"
        >
          {info.getValue()}
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
        <h1 className="text-3xl font-bold text-[#0066cc] mb-6">Faculty of Ayurved</h1>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <TableService
              ref={tableRef}
              columns={columns}
              data={supervisorsData}
            />
          </div>
        </div>
        
        {supervisorsData.length === 0 && !loading && (
          <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
            <p className="text-gray-700 text-sm">
              <span className="font-semibold">Info:</span> No supervisors have been recorded for Ayurved faculty yet. Supervisor data will be updated periodically.
            </p>
          </div>
        )}
      </main>
      <Footer />

      {/* Modal for Supervisor Profile */}
      {showModal && selectedSupervisor && (
        <div className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4">
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
                  <p className="text-sm text-gray-500">{selectedSupervisor.campus}</p>
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
                  RESEARCH IDENTIFIERS
                </h3>
                <div className="border border-gray-300 p-3 rounded-b">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p><span className="font-semibold">Scopus ID:</span> {selectedSupervisor.researchIds?.scopus || 'Not specified'}</p>
                    <p><span className="font-semibold">ORCID:</span> {selectedSupervisor.researchIds?.orchid || 'Not specified'}</p>
                    <p><span className="font-semibold">Publons:</span> {selectedSupervisor.researchIds?.publons || 'Not specified'}</p>
                    <p><span className="font-semibold">Vidwan:</span> {selectedSupervisor.researchIds?.vidwan || 'Not specified'}</p>
                    <p><span className="font-semibold">Google Scholar:</span> {selectedSupervisor.researchIds?.googleScholar || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  PUBLICATIONS
                </h3>
                <div className="border border-gray-300 p-3 rounded-b">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p><span className="font-semibold">Authored Books:</span> {selectedSupervisor.publications?.authoredBooks || 0}</p>
                    <p><span className="font-semibold">Edited Books:</span> {selectedSupervisor.publications?.editedBooks || 0}</p>
                    <p><span className="font-semibold">UGC Papers:</span> {selectedSupervisor.publications?.ugcPapers || 0}</p>
                    <p><span className="font-semibold">Chapters:</span> {selectedSupervisor.publications?.chapters || 0}</p>
                    <p><span className="font-semibold">Resource Person:</span> {selectedSupervisor.publications?.resourcePerson || 0}</p>
                    <p><span className="font-semibold">Organized Events:</span> {selectedSupervisor.publications?.organizedEvents || 0}</p>
                    <p><span className="font-semibold">Projects:</span> {selectedSupervisor.publications?.projects || 0}</p>
                    <p><span className="font-semibold">Admin Positions:</span> {selectedSupervisor.publications?.adminPositions || 0}</p>
                    <p><span className="font-semibold">Presentations:</span> {selectedSupervisor.publications?.presentations || 0}</p>
                    <p><span className="font-semibold">Memberships:</span> {selectedSupervisor.publications?.memberships || 0}</p>
                    <p><span className="font-semibold">Community Service:</span> {selectedSupervisor.publications?.communityService || 0}</p>
                    <p><span className="font-semibold">Patents:</span> {selectedSupervisor.publications?.patents || 0}</p>
                  </div>
                </div>
              </div>

              {selectedSupervisor.educationalQualifications && selectedSupervisor.educationalQualifications.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    QUALIFICATIONS
                  </h3>
                  <div className="border border-gray-300 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Course</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Institution</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.educationalQualifications.map((qual, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.course || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.year || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.institution || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.details || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedSupervisor.careerProfile && selectedSupervisor.careerProfile.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    EXPERIENCE / CAREER PROFILE
                  </h3>
                  <div className="border border-gray-300 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Organization</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Designation</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">From</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">To</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Nature of Duties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.careerProfile.map((exp, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.organizationName || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.designation || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.dateFrom ? new Date(exp.dateFrom).toLocaleDateString() : '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.dateTo ? new Date(exp.dateTo).toLocaleDateString() : 'Ongoing'}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.natureOfDuties || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedSupervisor.awards && selectedSupervisor.awards.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    AWARDS & RECOGNITION
                  </h3>
                  <div className="border border-gray-300 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Fellowship</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Agency</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.awards.map((award, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.fellowship || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.agency || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{award.year || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedSupervisor.detailedPublications?.ugcPapers && selectedSupervisor.detailedPublications.ugcPapers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    PUBLICATIONS
                  </h3>
                  <div className="border border-gray-300 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sr. No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Title of Paper</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Journal Name</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Author(s)</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Year</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Volume</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Page</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Impact Factor</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Listed In</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">UGC List No.</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Web URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupervisor.detailedPublications.ugcPapers.map((pub, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.titleOfPaper || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.journalName || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.authorName || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.pubYear || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.volume || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.page || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.impactFactor || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.listedIn || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.ugcListNo || '-'}</td>
                            <td className="border border-gray-300 px-3 py-2">
                              {pub.webUrl ? (
                                <a href={pub.webUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                                  Link
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedSupervisor.educationDetails && Object.keys(selectedSupervisor.educationDetails).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                    EDUCATION DETAILS / PHD INFORMATION
                  </h3>
                  <div className="border border-gray-300 p-3 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {selectedSupervisor.educationDetails.universityName && (
                        <p><span className="font-semibold">University Name:</span> {selectedSupervisor.educationDetails.universityName}</p>
                      )}
                      {selectedSupervisor.educationDetails.collegeName && (
                        <p><span className="font-semibold">College Name:</span> {selectedSupervisor.educationDetails.collegeName}</p>
                      )}
                      {selectedSupervisor.educationDetails.phdSubject && (
                        <p><span className="font-semibold">PhD Subject:</span> {selectedSupervisor.educationDetails.phdSubject}</p>
                      )}
                      {selectedSupervisor.educationDetails.monthAndYear && (
                        <p><span className="font-semibold">Month & Year:</span> {selectedSupervisor.educationDetails.monthAndYear}</p>
                      )}
                      {selectedSupervisor.educationDetails.supervisorName && (
                        <p><span className="font-semibold">Supervisor Name:</span> {selectedSupervisor.educationDetails.supervisorName}</p>
                      )}
                      {selectedSupervisor.educationDetails.areaOfSpec && (
                        <p><span className="font-semibold">Area of Specialization:</span> {selectedSupervisor.educationDetails.areaOfSpec}</p>
                      )}
                      {selectedSupervisor.educationDetails.thesisTitle && (
                        <p><span className="font-semibold">Thesis Title:</span> {selectedSupervisor.educationDetails.thesisTitle}</p>
                      )}
                      {selectedSupervisor.educationDetails.researchExp && (
                        <p><span className="font-semibold">Research Experience:</span> {selectedSupervisor.educationDetails.researchExp}</p>
                      )}
                      {selectedSupervisor.educationDetails.phdUniversity && (
                        <p><span className="font-semibold">PhD University:</span> {selectedSupervisor.educationDetails.phdUniversity}</p>
                      )}
                    </div>
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
export default Ayurved;
