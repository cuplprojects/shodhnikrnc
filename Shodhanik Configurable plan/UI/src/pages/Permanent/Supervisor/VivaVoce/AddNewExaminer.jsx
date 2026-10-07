import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';

const AddNewExaminer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getSupId } = useSupervisorAuthStore();
  
  // Get submission data from location state only
  const submissionData = location.state?.submissionData;
  const shodhanikId = submissionData?.shodhanikId;
  const supervisorId = getSupId();
  const[examiner,setExaminer] = useState([]);
  // Check if in edit mode
  const editMode = location.state?.editMode || false;
  const examinerData = location.state?.examinerData;
  
  // Initial form state
  const getInitialFormState = () => ({
    name: '',
    email: '',
    contactNo: '',
    address: '',
    designation: 0,
    state: 'Uttar Pradesh',
    departmentId: submissionData?.subject_ID || 1,
    institution: '',
    sid: submissionData?.sid || 0,
    addedBy: supervisorId || 0,
    examinerStatus: 0,
    status: 0,
    isAddedBySupervisor: true,
  });

  const [formData, setFormData] = useState(getInitialFormState());
  const [loading, setLoading] = useState(false);
  const [loadingDesignations, setLoadingDesignations] = useState(false);
  const [designations, setDesignations] = useState([]);
  const [selectedExaminerId, setSelectedExaminerId] = useState('');

  // Function to reset form
  const resetForm = () => {
    setFormData(getInitialFormState());
    notification().success('Exaniner added successfully');
  };

  // Fetch designations, roles, and departments from API
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch designations
        setLoadingDesignations(true);
        const designationsResponse = await API.get('/Designations');
        if (designationsResponse.data && Array.isArray(designationsResponse.data)) {
          setDesignations(designationsResponse.data);
        }
      } catch (error) {
        console.error('Error fetching designations:', error);
        setDesignations([]);
      } finally {
        setLoadingDesignations(false);
      }
    };

    const getExaminers = async()=>{
      try{
        const departmentId = submissionData?.departmentId || submissionData?.subject_ID || submissionData?.subjectId;
        if (!departmentId) {
          console.warn('Department ID not available');
          return;
        }
        const response = await API.get(`/Viva/Examiner/?id=${departmentId}`);
        setExaminer(response.data || []);
      }
      catch(error){
        console.error("Failed to fetch examiners:", error);
      }
    }
    fetchDropdownData();
    getExaminers();
  }, [submissionData?.departmentId, submissionData?.subject_ID, submissionData?.subjectId]);

  // Update addedBy when supervisorId changes
  useEffect(() => {
    if (supervisorId) {
      setFormData(prev => ({
        ...prev,
        addedBy: supervisorId
      }));
    }
  }, [supervisorId]);

  // Populate form data if in edit mode
  useEffect(() => {
    if (editMode && examinerData) {
      let matchedDesignation = examinerData.designationId || 0;
      if (!matchedDesignation && typeof examinerData.designation === 'number') {
        matchedDesignation = examinerData.designation;
      } else if (!matchedDesignation && designations.length > 0 && typeof examinerData.designation === 'string') {
        const found = designations.find(d => d.designationName?.toLowerCase() === examinerData.designation?.toLowerCase());
        if (found) matchedDesignation = found.designationID;
      }

      setFormData(prev => ({
        ...prev,
        name: examinerData.name || '',
        email: examinerData.email || '',
        contactNo: examinerData.phone || '',
        address: examinerData.address || '',
        designation: matchedDesignation || examinerData.designationId || (typeof examinerData.designation === 'number' ? examinerData.designation : 0),
        state: examinerData.state || 'Uttar Pradesh',
        institution: examinerData.institution || '',
        departmentId: submissionData?.departmentId || submissionData?.subject_ID || submissionData?.subjectId || prev.departmentId || 1,
        sid: examinerData.sid || submissionData?.sid || 0,
        addedBy: supervisorId || 0,
        examinerStatus: examinerData.examinerStatus || 0,
        status: examinerData.status || 0,
        id: examinerData.id,
        examinerId: examinerData.examinerId
      }));
    }
  }, [editMode, examinerData, supervisorId, submissionData, designations]);

  const handleSelectExaminer = (e) => {
    const examinerId = e.target.value;
    setSelectedExaminerId(examinerId);
    
    if (examinerId) {
      const selectedExaminer = examiner.find(ex => ex.id === parseInt(examinerId));
      if (selectedExaminer) {
        setFormData(prev => ({
          ...prev,
          name: selectedExaminer.name || '',
          email: selectedExaminer.email || '',
          contactNo: selectedExaminer.contactNo || '',
          address: selectedExaminer.address || '',
          designation: selectedExaminer.designation || 0,
          state: selectedExaminer.state || 'Uttar Pradesh',
          institution: selectedExaminer.institution || '',
          departmentId: selectedExaminer.departmentId || 1
        }));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for contact number - only allow digits
    if (name === 'contactNo') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }));
      }
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'designation' || name === 'departmentId'|| name === 'sid' || name === 'addedBy' || name === 'status' 
        ? parseInt(value) || 0 
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      notification().error('Please enter examiner name');
      return;
    }
    if (!formData.email.trim()) {
      notification().error('Please enter email address');
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      notification().error('Please enter a valid email address');
      return;
    }
    if (!formData.contactNo.trim()) {
      notification().error('Please enter contact number');
      return;
    }
    // Validate contact number (should be 10 digits)
    if (formData.contactNo.length !== 10) {
      notification().error('Contact number must be exactly 10 digits');
      return;
    }
    if (!formData.address.trim()) {
      notification().error('Please enter address');
      return;
    }
    if (!formData.designation || formData.designation === 0) {
      notification().error('Please select designation');
      return;
    }
    if (!formData.institution.trim()) {
      notification().error('Please enter institution');
      return;
    }
    
    // Check examiner limit for new additions (not for edits)
    if (!editMode) {
      // This check should ideally be done by fetching current examiner count
      // For now, we'll rely on the navigation validation
    }
    
    setLoading(true);

    try {
      let response;
      
      if (editMode && formData.id) {
        // Update existing examiner
        response = await API.put(`/Confidential/${formData.id}`, formData);
        console.log('Examiner updated successfully:', response.data);
        notification().success('Examiner updated successfully!');
      } else {
        // Create new examiner
        response = await API.post('/Confidential', formData);
        console.log('Examiner added successfully:', response.data);
        notification().success('Examiner added successfully!');
        
        // Reset form only for new additions (not edits)
        resetForm();
      }

      if (response.data) {
        // Navigate back to examiner list after a short delay
        setTimeout(() => {
          navigate('/supervisor-dashboard/examinerlist', {
            state: { submissionData }
          });
        }, 1500);
      } else {
        throw new Error(`Failed to ${editMode ? 'update' : 'add'} examiner`);
      }
    } catch (error) {
      console.error(`Error ${editMode ? 'updating' : 'adding'} examiner:`, error);
      
      // Enhanced error handling with HTTP status codes
      let errorMessage = `Failed to ${editMode ? 'update' : 'add'} examiner. Please try again.`;
      
      if (error.response) {
        switch (error.response.status) {
          case 400:
            errorMessage = 'Invalid data provided. Please check all fields.';
            break;
          case 401:
            errorMessage = 'You are not authorized to perform this action.';
            break;
          case 403:
            errorMessage = 'Access denied. Please contact administrator.';
            break;
          case 404:
            errorMessage = 'Examiner not found.';
            break;
          case 409:
            errorMessage = 'Examiner with this email already exists.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = error.response.data?.message || errorMessage;
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      notification().error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/supervisor-dashboard/examinerlist', {
      state: { submissionData }
    });
  };

  if (!shodhanikId || !submissionData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No candidate selected</p>
          <button
            onClick={() => navigate('/supervisor-dashboard/thesissubmittedlist')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Thesis Submitted List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={20} />
          Back to Examiner List
        </button>
        <div className="h-6 w-px bg-gray-300"></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {editMode ? 'Edit Examiner' : 'Add New Examiner'}
          </h1>
          <p className="text-gray-600">
            {editMode ? 'Update examiner details for' : 'Adding examiner for'} candidate: <span className="font-medium text-blue-600">{shodhanikId}</span>
            {submissionData && (
              <span className="ml-2">({submissionData.candidateName})</span>
            )}
            {supervisorId && (
              <span className="ml-4 text-sm text-gray-500">Supervisor ID: {supervisorId}</span>
            )}
          </p>
        </div>
      </div>

      {/* Candidate Info Card */}
      {submissionData && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Candidate Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{submissionData.candidateName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="font-medium text-gray-900">{submissionData.department}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Subject</p>
              <p className="font-medium text-gray-900">{submissionData.subject}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Examiner Form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {editMode ? 'Update Examiner Details' : 'Examiner Details'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {editMode ? 'Update the examiner\'s information' : 'Fill in the examiner\'s information'}
          </p>
          {!editMode && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                📋 <strong>Requirements:</strong> You have to add 6 examiners.
              </p>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {/* Select Existing Examiner Section */}
          {!editMode && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Select from Existing Examiners</h4>
              <select
                value={selectedExaminerId}
                onChange={handleSelectExaminer}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select an examiner to auto-fill --</option>
                {examiner.map((ex, idx) => (
                  <option key={`examiner-${ex.id}-${idx}`} value={ex.id}>
                    {ex.name} ({ex.email}) - {ex.institution}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                💡 Select an examiner from the list to auto-fill the form, or fill in manually to add a new examiner.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Designation <span className="text-red-500">*</span>
              </label>
              <select
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                required
                disabled={loadingDesignations}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value={0}>
                  {loadingDesignations ? 'Loading designations...' : 'Select Designation'}
                </option>
                {designations.map((designation, idx) => (
                  <option key={`desig-${designation.designationID}-${idx}`} value={designation.designationID}>
                    {designation.designationName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Institution <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="institution"
                value={formData.institution}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="University / Institute Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <select
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="examiner@university.edu"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="contactNo"
                value={formData.contactNo}
                onChange={handleInputChange}
                required
                maxLength={10}
                pattern="[0-9]{10}"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234567890"
              />
              <p className="text-xs text-gray-500 mt-1">Enter 10-digit mobile number</p>
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Complete address"
              />
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                loading
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Save size={16} />
              {loading 
                ? (editMode ? 'Updating...' : 'Adding...') 
                : (editMode ? 'Update Examiner' : 'Add Examiner')
              }
            </button>
            
            {!editMode && (
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={16} />
                Clear Form
              </button>
            )}
            
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewExaminer;