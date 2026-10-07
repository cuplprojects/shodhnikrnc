import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import API from '@/services/API';
import useStaffAuthStore from '@/store/staffAuthStore';
import notification from '@/services/NotificationService';

const AddExaminer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const notify = notification();
  
  // Get submission data from location state only
  const submissionData = location.state?.submissionData;
  const shodhanikId = submissionData?.shodhanikId;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactNo: '',
    address: '',
    designation: 0,
    state: '',
    departmentId: submissionData?.subject_ID || 1,
    institution: '',
    sid: submissionData?.sid || 0,
    addedBy: user?.id || 0,
    recommendedBy: 0,
    status: 0,
    examinerStatus:0,
    isAddedBySupervisor:false,
  });

  const [loading, setLoading] = useState(false);
  const [designations, setDesignations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [states] = useState([
   'Others','Uttar Pradesh'
  ]);
  const [examiners, setExaminers] = useState([]);
  const [selectedExaminerId, setSelectedExaminerId] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'designation' || name === 'recommendedBy' || name === 'departmentId' || name === 'sid' 
        ? parseInt(value) || 0 
        : value
    }));
  };

  const handleSelectExaminer = (e) => {
    const examinerId = e.target.value;
    setSelectedExaminerId(examinerId);
    
    if (examinerId) {
      const selectedExaminer = examiners.find(ex => ex.id === parseInt(examinerId));
      if (selectedExaminer) {
        setFormData(prev => ({
          ...prev,
          name: selectedExaminer.name || '',
          email: selectedExaminer.email || '',
          contactNo: selectedExaminer.contactNo || '',
          address: selectedExaminer.address || '',
          designation: selectedExaminer.designation || 0,
          state: selectedExaminer.state || '',
          institution: selectedExaminer.institution || '',
          departmentId: selectedExaminer.departmentId || 1
        }));
      }
    }
  };

  useEffect(() => {
    handleGetDesignation();
    handleGetRoles();
    if (submissionData?.departmentId) {
      handleGetExaminers();
    }
  }, [submissionData?.departmentId]);

  const handleGetExaminers = async () => {
    try {
      const departmentId = submissionData?.departmentId;
      if (!departmentId) {
        console.warn('Department ID not available');
        return;
      }
      const response = await API.get(`/Viva/Examiner/?id=${departmentId}`);
      setExaminers(response.data || []);
    } catch (error) {
      console.error('Error fetching examiners:', error);
    }
  };

  // Update sid when submissionData changes
  useEffect(() => {
    if (submissionData?.sid) {
      setFormData(prev => ({
        ...prev,
        sid: submissionData.sid
      }));
    }
  }, [submissionData?.sid]);

  const handleGetDesignation = async () => {
    try {
      const response = await API.get('/Designations');
      setDesignations(response.data || []);
    } catch (error) {
      console.error('Error fetching designations:', error);
      notify.error('Failed to load designations');
    }
  };

  const handleGetRoles = async () => {
    try {
      const response = await API.get('/admin/roles');
      setRoles(response.data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      notify.error('Failed to load roles');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('DoR - AddExaminer formData:', formData);
      console.log('DoR - Submission Data:', submissionData);
      
      // Validate required fields
      if (!formData.name || !formData.email || !formData.contactNo || !formData.designation || !formData.state || !formData.recommendedBy) {
        notify.error('Please fill in all required fields');
        return;
      }

      // Ensure sid is set
      if (!formData.sid || formData.sid === 0) {
        notify.error('Invalid submission ID. Please try again.');
        return;
      }

      // Make API call to save the examiner
      const response = await API.post('/Confidential', formData);

      if (response.data) {
        notify.success('Examiner added successfully!');
        
        // Navigate back to examiner list
        navigate('/director_panel/examinerslist', {
          state: { submissionData }
        });
      }
    } catch (error) {
      console.error('DoR - Error adding examiner:', error);
      notify.error('Failed to add examiner. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/director_panel/examinerslist', {
      state: { submissionData }
    });
  };

  if (!shodhanikId || !submissionData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No candidate selected</p>
          <button
            onClick={() => navigate('/director_panel/thesis')}
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
          <h1 className="text-2xl font-bold text-gray-800">Add New Examiner</h1>
          <p className="text-gray-600">
            Adding examiner for candidate: <span className="font-medium text-blue-600">{shodhanikId}</span>
            {submissionData && (
              <span className="ml-2">({submissionData.candidateName})</span>
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
          <h3 className="text-lg font-semibold text-gray-800">Examiner Details</h3>
          <p className="text-sm text-gray-600 mt-1">Fill in the examiner's information</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {/* Select Existing Examiner Section */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Select from Existing Examiners</h4>
            <select
              value={selectedExaminerId}
              onChange={handleSelectExaminer}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select an examiner to auto-fill --</option>
              {examiners.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.email}) - {ex.institution}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-2">
              💡 Select an examiner from the list to auto-fill the form, or fill in manually to add a new examiner.
            </p>
          </div>

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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+91 9876543210"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Select Designation</option>
                {designations.map((designation) => (
                  <option key={designation.designationID} value={designation.designationID}>
                    {designation.designationName}
                  </option>
                ))}
              </select>
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
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recommended By <span className="text-red-500">*</span>
              </label>
              <select
                name="recommendedBy"
                value={formData.recommendedBy}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Select Recommender</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
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
              {loading ? 'Adding...' : 'Add Examiner'}
            </button>
            
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

export default AddExaminer;