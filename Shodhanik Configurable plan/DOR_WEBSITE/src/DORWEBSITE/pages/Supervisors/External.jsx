import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useState, useRef, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useHeaderSettings } from '@/hooks/useHeaderSettings';

const External = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [externalSupervisors, setExternalSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tableRef = useRef(null);

  // Get header settings for university information
  const { headerSettings } = useHeaderSettings();

  // Fetch external supervisors data
  useEffect(() => {
    fetchExternalSupervisors();
  }, []);

  const fetchExternalSupervisors = async () => {
    try {
      setLoading(true);
      const response = await API.get('/AffiliatedCollegeSupervisorDetails/ExternalSupervisors/AllExternalSupervisors');
      
      const data = response.data;
      setExternalSupervisors(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching external supervisors:', err);
      setError(err.message);
      setExternalSupervisors([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle view profile click
  const handleViewProfile = async (supervisor) => {
    try {
      const response = await API.get(`/AffiliatedCollegeSupervisorDetails/ExternalSupervisors/SupervisorProfile/${supervisor.supervisorId}`);
      
      const profileData = response.data;
      setSelectedSupervisor(profileData);
      setShowModal(true);
    } catch (err) {
      console.error('Error fetching supervisor profile:', err);
      alert('Failed to load supervisor profile. Please try again.');
    }
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  // Define table columns
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor('supervisorId', {
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
            Shodhanik Id: {info.row.original.shodhanikId}
          </div>
          {info.row.original.organization && info.row.original.organization !== "External Organization" && (
            <div className="text-xs text-gray-500 mt-1">
              {info.row.original.organization}
            </div>
          )}
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
            {info.row.original.primarySubject?.name} / {info.row.original.primarySubject?.faculty}
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        <h1 className="text-1xl  text-[#0066cc] mb-6">External Supervisors</h1>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 border-gray-300">External Supervisor Details</h2>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="text-gray-600">Loading external supervisors...</div>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                <p className="text-red-700 text-sm">
                  <span className="font-semibold">Error:</span> {error}
                </p>
              </div>
            ) : (
              <TableService
                ref={tableRef}
                columns={columns}
                data={externalSupervisors}
                onRowClick={(row) => handleViewProfile(row.original)}
              />
            )}
          </div>
        </div>

        {!loading && !error && externalSupervisors.length === 0 && (
          <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
            <p className="text-gray-700 text-sm">
              <span className="font-semibold">Info:</span> No external supervisors have been recorded yet. Supervisor data will be updated periodically.
            </p>
          </div>
        )}
      </main>
      <Footer />

      {/* Modal for Supervisor Profile */}
      {showModal && selectedSupervisor && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto md:max-w-4xl">
            <div className="bg-[#0099cc] text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1">
                  {selectedSupervisor.profile?.universityLogo ? (
                    <img 
                      src={`${getBaseFileURL()}/${selectedSupervisor.profile.universityLogo}`} 
                      alt="University Logo" 
                      className="w-full h-full object-contain rounded-full"
                      onError={(e) => {
                        console.error('University logo failed to load:', `${getBaseFileURL()}/${selectedSupervisor.profile.universityLogo}`);
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
                    {selectedSupervisor.profile?.universityName || 
                     headerSettings?.universityFullNameEnglish || 
                     headerSettings?.universityNameEnglish || 
                     'Directorate of Research, Nehru Kendra'}
                  </h2>
                  <p className="text-sm">
                    {selectedSupervisor.profile?.universityNameHindi || 
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

              <div className="flex flex-col md:flex-row mb-6 bg-gray-50 p-4 rounded gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-800">{selectedSupervisor.profile?.title} {selectedSupervisor.profile?.fullName}</h2>
                  <p className="text-gray-600">{selectedSupervisor.profile?.designation}</p>
                  <p className="text-sm text-gray-500">{selectedSupervisor.profile?.primarySubject?.name} / {selectedSupervisor.profile?.primarySubject?.faculty}</p>
                  <p className="text-sm text-gray-500">{selectedSupervisor.profile?.organization}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Contact: {selectedSupervisor.profile?.mobileNo} | Email: {selectedSupervisor.profile?.email}
                  </p>
                  <p className="text-sm text-gray-500">
                    Shodhanik ID: {selectedSupervisor.profile?.shodhanikId}
                  </p>
                </div>
                <div className="flex-shrink-0 flex justify-center md:justify-end">
                  <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-lg font-bold text-gray-600 md:w-24 md:h-24">
                    {selectedSupervisor.profile?.photoPath ? (
                      <img 
                        src={`${getBaseFileURL()}/${selectedSupervisor.profile.photoPath}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          console.error('Supervisor photo failed to load:', `${getBaseFileURL()}/${selectedSupervisor.profile.photoPath}`);
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<div class="text-lg font-bold text-gray-600 md:text-xl">${selectedSupervisor.profile?.fullName?.split(' ').map(n => n[0]).join('') || 'N/A'}</div>`;
                        }}
                      />
                    ) : (
                      selectedSupervisor.profile?.fullName?.split(' ').map(n => n[0]).join('') || 'N/A'
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              {selectedSupervisor.profile && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2 rounded-t">
                    Academic Information
                  </h3>
                  <div className="border border-gray-300 p-3 rounded-b">
                    {selectedSupervisor.profile.primarySubject && (
                      <div className="mb-2">
                        <p className="font-medium text-gray-700">Primary Subject:</p>
                        <p className="text-gray-600 text-sm">
                          {selectedSupervisor.profile.primarySubject.name} / {selectedSupervisor.profile.primarySubject.faculty}
                        </p>
                      </div>
                    )}
                    {selectedSupervisor.profile.secondarySubject1 && (
                      <div className="mb-2">
                        <p className="font-medium text-gray-700">Secondary Subject 1:</p>
                        <p className="text-gray-600 text-sm">
                          {selectedSupervisor.profile.secondarySubject1.name} / {selectedSupervisor.profile.secondarySubject1.faculty}
                        </p>
                      </div>
                    )}
                    {selectedSupervisor.profile.secondarySubject2 && (
                      <div>
                        <p className="font-medium text-gray-700">Secondary Subject 2:</p>
                        <p className="text-gray-600 text-sm">
                          {selectedSupervisor.profile.secondarySubject2.name} / {selectedSupervisor.profile.secondarySubject2.faculty}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {selectedSupervisor.profile && (
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2 rounded-t">
                    Contact Information
                  </h3>
                  <div className="border border-gray-300 p-3 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p><span className="font-medium">Mobile:</span> {selectedSupervisor.profile.mobileNo}</p>
                        {selectedSupervisor.profile.alternateMobileNo && (
                          <p><span className="font-medium">Alternate Mobile:</span> {selectedSupervisor.profile.alternateMobileNo}</p>
                        )}
                        <p><span className="font-medium">Email:</span> {selectedSupervisor.profile.email}</p>
                      </div>
                      <div>
                        {selectedSupervisor.profile.universityDomainEmail && (
                          <p><span className="font-medium">University Email:</span> {selectedSupervisor.profile.universityDomainEmail}</p>
                        )}
                        {selectedSupervisor.profile.twitterID && (
                          <p><span className="font-medium">Twitter:</span> {selectedSupervisor.profile.twitterID}</p>
                        )}
                        {selectedSupervisor.profile.linkedinID && (
                          <p><span className="font-medium">LinkedIn:</span> {selectedSupervisor.profile.linkedinID}</p>
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
                  <p className="text-gray-600">{selectedSupervisor.researchDetails?.researchArea || 'Not specified'}</p>
                  <p className="text-sm text-gray-500 mt-1">Research Year: {selectedSupervisor.researchDetails?.researchYear || 'Not specified'}</p>
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
                        { id: 1, type: 'Authored Books & Monographs.', count: 0 },
                        { id: 2, type: 'Edited Books.', count: 0 },
                        { id: 3, type: 'Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals.', count: selectedSupervisor.publications?.length || 0 },
                        { id: 4, type: 'Chapters / Papers in Edited Books.', count: 0 },
                        { id: 5, type: 'Invited as Resource Lectures Person / Examiner/Expert.', count: 0 },
                        { id: 6, type: 'Seminars / Conferences / Workshops Organized.', count: 0 },
                        { id: 7, type: 'Projects.', count: 0 },
                        { id: 8, type: 'Administrative Positions / Assignments Held.', count: 0 },
                        { id: 9, type: 'Seminars / Conference Presentations.', count: 0 },
                        { id: 10, type: 'Memberships of Academic / Professional Bodies.', count: 0 },
                        { id: 11, type: 'Participation in Community Service / Exchange Programs / Consulting Activity.', count: 0 },
                        { id: 12, type: 'Patent', count: 0 }
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

              {/* Research Publications Section */}
              {selectedSupervisor.publications && selectedSupervisor.publications.length > 0 && (
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
                        {selectedSupervisor.publications.map((pub, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.titleOfPaper}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.journalName}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.pubYear}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.impactFactor || '-'}</td>
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
                      {selectedSupervisor.qualifications && selectedSupervisor.qualifications.length > 0 ? (
                        selectedSupervisor.qualifications.map((qual, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.course}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.year}</td>
                            <td className="border border-gray-300 px-3 py-2">{qual.institution} {qual.details && `- ${qual.details}`}</td>
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
                      {selectedSupervisor.experience && selectedSupervisor.experience.length > 0 ? (
                        selectedSupervisor.experience.map((exp, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.organizationName}</td>
                            <td className="border border-gray-300 px-3 py-2">{exp.designation}</td>
                            <td className="border border-gray-300 px-3 py-2">
                              {exp.dateFrom && new Date(exp.dateFrom).toLocaleDateString()} - {exp.dateTo ? new Date(exp.dateTo).toLocaleDateString() : 'Present'}
                              {exp.natureOfDuties && <div className="text-xs text-gray-600 mt-1">{exp.natureOfDuties}</div>}
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
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.researchDetails?.phdAwarded || 0}</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.researchDetails?.phdUnderSupervision || 0}</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="border border-gray-300 px-3 py-2">2</td>
                        <td className="border border-gray-300 px-3 py-2">M. Phill.</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.researchDetails?.mPhilAwarded || 0}</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.researchDetails?.mPhilUnderSupervision || 0}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2">3</td>
                        <td className="border border-gray-300 px-3 py-2">Dissertation (M.Ed. / M.A.)</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.researchDetails?.dissertation || 0}</td>
                        <td className="border border-gray-300 px-3 py-2">{selectedSupervisor.researchDetails?.dissertationUnderSupervision || 0}</td>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p><span className="font-medium">Scopus:</span> {selectedSupervisor.researchDetails?.scopus || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Publons:</span> {selectedSupervisor.researchDetails?.publOns || '-'}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Orchid:</span> {selectedSupervisor.researchDetails?.orchid || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Vidwan:</span> {selectedSupervisor.researchDetails?.vidwan || '-'}</p>
                      <p className="mt-1"><span className="font-medium">Google Scholar:</span> {selectedSupervisor.researchDetails?.googleScholar || '-'}</p>
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
                      {selectedSupervisor.awards && selectedSupervisor.awards.length > 0 ? (
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

              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 bg-gray-600 text-white p-2">
                  RESEARCH PUBLICATIONS
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
                      {selectedSupervisor.publications && selectedSupervisor.publications.length > 0 ? (
                        selectedSupervisor.publications.map((pub, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="border border-gray-300 px-3 py-2">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.titleOfPaper}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.journalName}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.pubYear}</td>
                            <td className="border border-gray-300 px-3 py-2">{pub.impactFactor || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                            No publications listed
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

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

export default External;
