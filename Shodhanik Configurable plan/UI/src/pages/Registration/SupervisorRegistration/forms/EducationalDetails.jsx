import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import API from '@/services/API';
import useStepSupStore from '../components/stepStore';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import dayjs from 'dayjs';

const EducationalDetails = () => {
  const navigate = useNavigate();
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  const fetchSteps = useStepSupStore(state => state.fetchSteps);
  const isStepReadOnly = useStepSupStore(state => state.isStepReadOnly);
  const checkScreeningStatus = useStepSupStore(state => state.checkScreeningStatus);
  const [supervisorData, setSupervisorData] = useState(null);

  // Check screening status and set supervisor data
  useEffect(() => {
    const fetchScreeningStatus = async () => {
      try {
        const screeningResult = await checkScreeningStatus(supId);
        setSupervisorData({
          supId,
          hasRejectedScreening: screeningResult?.hasRejectedScreening || false,
          screeningData: screeningResult?.screeningData || null
        });
      } catch (error) {
        console.error('Error fetching screening status:', error);
        setSupervisorData({ supId, hasRejectedScreening: false });
      }
    };

    if (supId) {
      fetchScreeningStatus();
    }
  }, [supId, checkScreeningStatus]);

  // Calculate isReadOnly after supervisorData is available
  const isReadOnly = supervisorData ? isStepReadOnly(2, supervisorData) : false; // Step 2 is Educational Details
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState(null);
  const [formData, setFormData] = useState({
    universityId: '',
    universityName: '',
    collegeId: '',
    collegeType: '',
    collegeName: '',
    subject: '',
    researchExperience: '',
    yearOfEstablishment: null,
    researchCenter: '',
    phdUniversityName: '',
    phdSubject: '',
    phdMonthYear: '',
    supervisorName: '',
    areaOfSpecialization: '',
    thesisTitle: '',
    description: '',
  });

  const [existingDocument, setExistingDocument] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [educationData, setEducationData] = useState(null);
  const [showResearchCenterInput, setShowResearchCenterInput] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await fetchDepartments();
      await fetchUniversities();
      await fetchSupervisorData();
      await handleGetEducationData();
      setIsDataLoaded(true);
    };
    loadData();
  }, []);

  // Effect to handle college selection after colleges are loaded
  useEffect(() => {
    // Since the API now provides collegeId directly, we don't need to match by name
    // The collegeId is already set in the initial form data
    if (educationData && colleges.length > 0 && educationData.universityId === 1 && educationData.collegeId) {
      console.log("College ID already set from API:", educationData.collegeId);
      // Verify the college exists in the list
      const collegeExists = colleges.find(college => college.collegeId === educationData.collegeId);
      if (collegeExists) {
        console.log("College found in list:", collegeExists);
      } else {
        console.log("College ID not found in colleges list");
      }
    }
  }, [colleges, educationData]);

  // Effect to handle department selection after departments are loaded
  useEffect(() => {
    if (educationData && departments.length > 0) {
      // Check if we have a subject ID (number) or subject name (string)
      let departmentIdToSet = '';

      if (educationData.subject && typeof educationData.subject === 'number') {
        // If subject is already a department ID, use it directly
        departmentIdToSet = educationData.subject.toString();
        console.log("Using department ID directly:", departmentIdToSet);
      } else if (educationData.subjets || educationData.subject) {
        // If we have subject name, find matching department
        const subjectName = educationData.subjets || educationData.subject;
        const matchingDept = departments.find(dept =>
          dept.subject === subjectName ||
          dept.subject.toLowerCase().includes(subjectName.toLowerCase()) ||
          subjectName.toLowerCase().includes(dept.subject.toLowerCase())
        );
        if (matchingDept && matchingDept.departmentID) {
          departmentIdToSet = matchingDept.departmentID.toString();
          console.log("Found matching department by name:", matchingDept);
        } else {
          console.log("No matching department found for:", subjectName);
          console.log("Available departments:", departments.map(d => d.subject));
        }
      }

      if (departmentIdToSet) {
        console.log("Setting department ID:", departmentIdToSet);
        setFormData(prev => ({
          ...prev,
          subject: departmentIdToSet
        }));
      }
    }
  }, [departments, educationData]);

  const fetchSupervisorData = async () => {
    try {
      const response = await API.get(`/SupervisorRegistration/${supId}`);
      setSupervisorData(response.data);
    } catch (error) {
      console.log('Error fetching supervisor data:', error);
    }
  };

  const fetchUniversities = async () => {
    try {
      const response = await API.get('/Universities/Universities');
      setUniversities(response.data);
    } catch (error) {
      console.log('Error fetching universities:', error);
    }
  };

  const fetchColleges = async (universityId) => {
    try {
      const response = await API.get(`/Universities/Colleges?UniId=${universityId}`);
      setColleges(response.data);
      console.log("Colleges API response:", response.data);
      console.log("First college object:", response.data[0]);
    } catch (error) {
      console.log('Error fetching colleges:', error);
      setColleges([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await API.get('/Department');
      // Filter only active departments
      const activeDepartments = response.data.filter(dept => dept.status === 'Y');
      setDepartments(activeDepartments);
      console.log("Departments loaded:", activeDepartments.map(d => ({ id: d.departmentID, subject: d.subject })));
    } catch (error) {
      console.error('Error fetching departments:', error);
      // Set fallback departments if API fails

    }
  };

  const handleGetEducationData = async () => {
    try {
      if (!supId) return;

      const response = await API.get(
        `/SupervisorEducation/BySupervisor?id=${supId}`
      );
      const data = response.data;
      console.log("Education data received:", data);

      // Store the education data for later use
      setEducationData(data);

      // Set existing document if available
      if (data.docUpload) {
        setExistingDocument(data.docUpload);
      }

      // Find matching department for subject
      let subjectId = '';
      if (data.subjects && typeof data.subjects === 'string') {
        const matchingDept = departments.find(dept =>
          dept.subject === data.subjects ||
          dept.subjects.toLowerCase().includes(data.subjects.toLowerCase()) ||
          data.subjects.toLowerCase().includes(dept.subjects.toLowerCase())
        );
        if (matchingDept) {
          subjectId = matchingDept.departmentID;
          console.log("Found matching department:", matchingDept);
        } else {
          console.log("No matching department found for:", data.subject);
          // If no exact match, keep the original subject string for now
          subjectId = data.subject;
        }
      }

      // Set selected university ID first
      if (data.universityId) {
        setSelectedUniversityId(data.universityId);
        console.log("Setting selectedUniversityId to:", data.universityId);
        if (data.universityId === 1) {
          await fetchColleges(data.universityId);
        }
      }

      // Get university name - only use universityName for non-ID-1 universities
      let universityNameForInput = '';
      if (data.universityId !== 1) {
        universityNameForInput = data.universityName || '';
      }

      // Get college name based on universityId
      let collegeNameForInput = '';
      let collegeIdForDropdown = '';

      if (data.universityId === 1) {
        // For universityId=1, use collegeId for dropdown and collegeNames for display
        collegeIdForDropdown = data.collegeId || '';
        collegeNameForInput = data.collegeNames || '';
      } else {
        // For other universities, college input should show collegeName, no collegeId
        collegeNameForInput = data.collegeName || '';
        collegeIdForDropdown = ''; // No college ID for other universities
      }

      console.log("University name for input:", universityNameForInput);
      console.log("College name for input:", collegeNameForInput);
      console.log("Final form data being set:", {
        universityId: data.universityId ? data.universityId.toString() : '',
        universityName: universityNameForInput,
        collegeId: collegeIdForDropdown ? collegeIdForDropdown.toString() : '',
        collegeName: collegeNameForInput,
        subject: data.subject ? data.subject.toString() : '',
        subjectName: data.subjets || 'Not provided',
        selectedUniversityId: data.universityId
      });

      // Set form data
      setFormData((prev) => ({
        ...prev,
        universityId: data.universityId ? data.universityId.toString() : 0, // Convert to string for select value
        universityName: universityNameForInput,
        collegeId: collegeIdForDropdown ? collegeIdForDropdown.toString() : 0, // Convert to string for select value
        collegeType: data.collegeType || '',
        collegeName: collegeNameForInput,
        subject: data.primarySuperviseSubject ? data.primarySuperviseSubject.toString() : 0, // Set subject ID directly if available
        researchExperience: data.researchExp || '',
        yearOfEstablishment: data.deptEst ? dayjs(data.deptEst, 'YYYY') : null,
        researchCenter: data.researchCenter || '',
        phdUniversityName: data.phdUniversity || '',
        phdSubject: data.phdSubject || '',
        phdMonthYear: data.monthAndYear || '',
        supervisorName: data.supervisorName || '',
        areaOfSpecialization: data.areaOfSpec || '',
        thesisTitle: data.thesisTitle || '',
        description: data.description || '',
      }));

      // Set the research center input visibility based on whether there's a research center name
      setShowResearchCenterInput(!!(data.researchCenter && data.researchCenter.trim() !== ''));

    } catch (error) {
      console.log(error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target;

    // Debug subject selection
    if (name === 'subject') {
      console.log("Department selected:", value);
    }

    // Handle university selection
    if (name === 'universityId') {
      const selectedUniversity = universities.find(uni => uni.universityId === parseInt(value));
      setSelectedUniversityId(parseInt(value));

      setFormData(prev => ({
        ...prev,
        universityId: value,
        // Only auto-fill university name for universityId = 1, leave empty for others to allow manual entry
        universityName: parseInt(value) === 1 ? (selectedUniversity ? selectedUniversity.universityName : '') : '',
        collegeId: '', // Reset college selection
        collegeName: '' // Reset college name
      }));

      // Fetch colleges if universityId is 1
      if (parseInt(value) === 1) {
        fetchColleges(value);
      } else {
        setColleges([]); // Clear colleges for other universities
      }
      return;
    }

    // Handle college selection
    if (name === 'collegeId') {
      // When selecting college from dropdown, only set collegeId, leave collegeName empty
      // The collegeName will be sent as empty in the API call
      setFormData(prev => ({
        ...prev,
        collegeId: value,
        collegeName: '' // Always empty when selecting from dropdown
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : type === 'checkbox' ? checked : value
    }));

    // Update research center input visibility when user types in the research center field
    if (name === 'researchCenter') {
      setShowResearchCenterInput(value && value.trim() !== '');
    }
  };

  // Handle research center checkbox
  const handleResearchCenterCheckbox = (e) => {
    const { checked } = e.target;
    if (checked) {
      // If checked (approved research center), clear the research center name and hide input
      setFormData(prev => ({
        ...prev,
        researchCenter: ''
      }));
      setShowResearchCenterInput(false);
    } else {
      // If unchecked (not approved), show the input field
      setShowResearchCenterInput(true);
      setTimeout(() => {
        const input = document.querySelector('input[name="researchCenter"]');
        if (input) {
          input.focus();
        }
      }, 100);
    }
  };

  const handleYearChange = (date) => {
    if (date && date.isAfter(dayjs(), 'year')) {
      notification().warning("Establishment year cannot be in the future");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      yearOfEstablishment: date
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isReadOnly) {
      return; // Silently prevent submission when read-only
    }

    setIsLoading(true);

    try {
      const fd = new FormData();
      if (!formData.subject || parseInt(formData.subject) === 0) {
        notification().error("Please select a valid department before submitting.");
        setIsLoading(false);
        return;
      }

      if (!formData.description || formData.description.trim() === '') {
        notification().error("Please provide a description before submitting.");
        setIsLoading(false);
        return;
      }

      const wordCount = formData.description.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount === 0) {
        notification().error("Description cannot be empty.");
        setIsLoading(false);
        return;
      }

      if (!supId) {
        notification().error("User session expired. Please login again.");
        return;
      }
      fd.append("SupId", supId);
      fd.append("UniversityId", formData.universityId || '');
      fd.append("CollegeType", formData.collegeType);

      // Logic: If universityId is 1, send empty universityName, otherwise send the entered name
      const universityNameToSend = parseInt(formData.universityId) === 1 ? '' : (formData.universityName || '');
      fd.append("UniversityName", universityNameToSend);

      // Logic: If collegeId is selected (universityId = 1), send empty collegeName, otherwise send the entered name
      const collegeNameToSend = formData.collegeId && formData.collegeId !== '0' ? '' : (formData.collegeName || '');
      fd.append("CollegeName", collegeNameToSend);

      // Send CollegeId as 0 if not set (for universityId !== 1 cases)
      const collegeIdToSend = formData.collegeId || '0';
      fd.append("CollegeId", collegeIdToSend);

      console.log("Form submission data:", {
        UniversityId: formData.universityId,
        UniversityName: universityNameToSend,
        CollegeId: collegeIdToSend,
        CollegeName: collegeNameToSend,
        CollegeType: formData.collegeType
      });

      fd.append("ResearchExp", formData.researchExperience);
      fd.append("DeptEst", formData.yearOfEstablishment ? formData.yearOfEstablishment.format('YYYY') : '');
      fd.append("ResearchCenter", formData.researchCenter || '');
      // Send departmentID as DeptId

      const selectedDepartment = departments.find(dept => dept.departmentID === parseInt(formData.subject));
      console.log("selectedDepartment:", selectedDepartment);

       fd.append("Subject", formData.subject);
      fd.append("PhdUniversity", formData.phdUniversityName);
      fd.append("MonthAndYear", formData.phdMonthYear);
      fd.append("PhdSubject", formData.phdSubject);
      fd.append("SupervisorName", formData.supervisorName);
      fd.append("AreaOfSpec", formData.areaOfSpecialization);
      fd.append("ThesisTitle", formData.thesisTitle);
      fd.append("Description", formData.description);

      const response = await API.post(
        "/SupervisorEducation",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      console.log("Educational details saved successfully:", response.data);
      notification().success("Educational Details Saved Successfully!");
      setTimeout(async () => {
        try {
          const steps = await fetchSteps(supId);
          if (steps) {
            navigate(SUPERVISOR_REGISTRATION_ROUTES.EXPERIENCE_DETAILS);
          } else {
            notification().error("Failed to update step progress. Please try again.");
          }
        } catch (error) {
          console.error("Error fetching steps:", error);
          notification().error("Failed to update step progress. Please try again.");
        }
      }, 1500);
    } catch (error) {
      console.error("API Error:", error);

      if (error.response?.data?.message) {
        notification().error(`Error: ${error.response.data.message}`);
      } else if (error.response?.status === 400) {
        notification().error("Invalid data provided. Please check all fields and try again.");
      } else if (error.response?.status === 500) {
        notification().error("Server error occurred. Please try again later.");
      } else {
        notification().error("Failed to save educational details. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = `w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm ${isReadOnly ? 'bg-amber-50 cursor-not-allowed border-amber-300 text-amber-800' : ''
    }`;
  const labelClass = "block text-sm font-medium text-[#374151] mb-1 font-inter";

  // Debug current form data
  console.log("Current formData at render:", {
    universityId: formData.universityId,
    collegeId: formData.collegeId,
    subject: formData.subject,
    selectedUniversityId: selectedUniversityId
  });

  return (
    <div className="p-4 md:p-5">
      {!isDataLoaded && (
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af] mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading education details...</p>
          </div>
        </div>
      )}

      {isDataLoaded && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Details of Present University / College */}
          <div>
            <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
              Details of Present University / College
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelClass}>University<span className="text-red-600">*</span></label>
                <select
                  name="universityId"
                  value={formData.universityId}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isReadOnly}
                  required
                >
                  <option value="">Select University</option>
                  {universities.map((university) => (
                    <option key={university.universityId} value={university.universityId}>
                      {university.universityName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>College Type<span className="text-red-600">*</span></label>
                <select
                  name="collegeType"
                  value={formData.collegeType}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isReadOnly}
                  required
                >
                  <option value="">--Select--</option>
                  <option value="Government">Government</option>
                  <option value="Private">Private</option>
                  <option value="Aided">Aided</option>
                </select>
              </div>

              {/* Show university name input when universityId is not 1 */}
              {selectedUniversityId && selectedUniversityId !== 1 && (
                <div>
                  <label className={labelClass}>Enter University Name <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="universityName"
                    value={formData.universityName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Enter university name"
                    disabled={isReadOnly}
                    required
                  />
                </div>
              )}

              {/* Show college dropdown when universityId is 1 */}
              {selectedUniversityId === 1 && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Select Present College<span className="text-red-600">*</span></label>
                  <select
                    name="collegeId"
                    value={formData.collegeId}
                    onChange={handleChange}
                    className={inputClass}
                    disabled={isReadOnly}
                    required
                  >
                    <option value="">Select College</option>
                    {colleges.map((college, index) => {
                      // Handle different possible property names for college ID
                      const collegeId = college.collegeId || college.id || college.CollegeId || index + 1;
                      const collegeName = college.collegeName || college.name || college.CollegeName || `College ${index + 1}`;

                      return (
                        <option key={collegeId} value={collegeId}>
                          {collegeName}
                        </option>
                      );
                    })}
                  </select>
                  {colleges.length === 0 && selectedUniversityId === 1 && (
                    <p className="text-sm text-gray-500 mt-1">Loading colleges...</p>
                  )}

                </div>
              )}

              {/* Show college name input when universityId is not 1 */}
              {selectedUniversityId && selectedUniversityId !== 1 && (
                <div>
                  <label className={labelClass}>Enter Name of the College<span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="collegeName"
                    value={formData.collegeName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Enter college name"
                    disabled={isReadOnly}
                    required
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className={labelClass}>Department / Subject / Discipline in which Recognition is sought<span className="text-red-600">*</span></label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isReadOnly}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.departmentID} value={dept.departmentID}>
                      {dept.subject}
                    </option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">Loading departments...</p>
                )}
              </div>

              {/* Research Center Section */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="isApprovedResearchCenter"
                    checked={!showResearchCenterInput}
                    onChange={handleResearchCenterCheckbox}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    disabled={isReadOnly}
                  />
                  <label htmlFor="isApprovedResearchCenter" className={labelClass + " mb-0"}>
                    Is your college/Department an approved Research Center?
                  </label>
                </div>

                {/* Show input field when checkbox is unchecked (not approved research center) */}
                {showResearchCenterInput && (
                  <div>
                    <label className={labelClass}>Research Center Name<span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      name="researchCenter"
                      value={formData.researchCenter}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Enter research center name"
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Research Experience (In Years & Months)<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="researchExperience"
                  value={formData.researchExperience}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter years"
                  disabled={isReadOnly}
                  required
                />

              </div>

              <div>
                <label className={labelClass}>Year of establishment of Department<span className="text-red-600">*</span></label>
                <DatePicker
                  picker="year"
                  name="yearOfEstablishment"
                  value={formData.yearOfEstablishment}
                  onChange={handleYearChange}
                  className={inputClass}
                  style={{ width: '100%' }}
                  placeholder="Select year"
                  maxDate={dayjs()}
                  disabledDate={(current) => current && current.isAfter(dayjs(), 'year')}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
          </div>

          {/* Details of Ph. D. Degree Obtained */}
          <div>
            <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
              Details of Ph. D. Degree Obtained
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="md:col-span-2">
                <label className={labelClass}>Name of University<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="phdUniversityName"
                  value={formData.phdUniversityName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="University Name"
                  disabled={isReadOnly}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Subject / Discipline<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="phdSubject"
                  value={formData.phdSubject}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter subject"
                  disabled={isReadOnly}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Month & Year<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="phdMonthYear"
                  value={formData.phdMonthYear}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter month & year"
                  disabled={isReadOnly}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Supervisor Name<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="supervisorName"
                  value={formData.supervisorName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter supervisor name"
                  disabled={isReadOnly}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Area of Specialization<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="areaOfSpecialization"
                  value={formData.areaOfSpecialization}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter area of specialization"
                  disabled={isReadOnly}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Title of Your Thesis (in CAPITAL Letters)<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="thesisTitle"
                  value={formData.thesisTitle}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter thesis title"
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div>
            <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
              Additional Information
            </h2>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <label className={labelClass}>
                  Description <span className="text-red-600">*</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({formData.description.split(/\s+/).filter(word => word.length > 0).length} / 5000 words)
                  </span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={(e) => {
                    const words = e.target.value.split(/\s+/).filter(word => word.length > 0);
                    if (words.length <= 5000) {
                      setFormData(prev => ({
                        ...prev,
                        description: e.target.value
                      }));
                    } else {
                      notification().warning('Maximum 5000 words allowed');
                    }
                  }}
                  className={`${inputClass} resize-none`}
                  placeholder="Enter description (maximum 5000 words)"
                  rows="6"
                  disabled={isReadOnly}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Please provide a detailed description of your research interests and academic background.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
            <button
              type="submit"
              disabled={isLoading || isReadOnly}
              className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${isLoading || isReadOnly
                ? isReadOnly
                  ? 'bg-amber-200 text-amber-800 cursor-not-allowed border border-amber-300'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] hover:shadow-lg'
                }`}
            >
              {isLoading ? 'Saving...' : 'Save & Next'}
              <ChevronRight size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EducationalDetails;
