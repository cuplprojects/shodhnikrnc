import { useState, useEffect, useMemo } from 'react';
import { User, Phone, MapPin, Edit, Save, X, IdCard, Loader } from 'lucide-react';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';
import notification from '@/services/NotificationService';

// Moved outside to prevent re-creation on every render (fixes focus loss)
const InputField = ({ label, name, type = 'text', required = false, isEditing, editData, personalData, handleInputChange, nonEditableFields }) => {
  const isNonEditable = nonEditableFields.includes(name);
  const isFieldEditable = isEditing && !isNonEditable;
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={isEditing ? (editData[name] || '') : (personalData[name] || '')}
        onChange={handleInputChange}
        className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isFieldEditable 
            ? 'border-gray-300 bg-white' 
            : 'border-gray-200 bg-gray-50 cursor-default'
        }`}
        required={required}
        readOnly={!isFieldEditable}
        disabled={isEditing && isNonEditable}
      />
    </div>
  );
};

const SelectField = ({ label, name, options, required = false, isEditing, editData, personalData, handleInputChange, designationsLoading, departmentsLoading, nonEditableFields = [] }) => {
  const isLoading = (designationsLoading && name === 'designation') || 
                    (departmentsLoading && (name.includes('Subject') || name.includes('supervise')));
  
  const isNonEditable = nonEditableFields.includes(name);
  const isFieldEditable = isEditing && !isNonEditable;
  
  const currentValue = isEditing ? (editData[name]?.toString() || '') : (personalData[name]?.toString() || '');
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={currentValue}
        onChange={handleInputChange}
        className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isFieldEditable 
            ? 'border-gray-300 bg-white' 
            : 'border-gray-200 bg-gray-50 cursor-default'
        }`}
        required={required}
        disabled={!isFieldEditable}
      >
        <option value="">{isLoading ? `Loading ${label.toLowerCase()}...` : `Select ${label}`}</option>
        {options.map(option => {
          const value = typeof option === 'object' ? option.value?.toString() : option.toString();
          const optLabel = typeof option === 'object' ? option.label : option;
          return (
            <option key={value} value={value}>{optLabel}</option>
          );
        })}
      </select>
    </div>
  );
};

const PersonalDetails = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [designations, setDesignations] = useState([]);
  const [designationsLoading, setDesignationsLoading] = useState(true);
  const { user, getSupId } = useSupervisorAuthStore();
  const supId = useMemo(() => getSupId(), [user]);

  const [personalData, setPersonalData] = useState({
    // Basic Information
    empId: '',
    title: '',
    completeName: '',
    fatherName: '',
    dateOfBirth: '',
    retirementDate: '',
    gender: '',
    nationality: '',
    designation: '',
    designationName: '',
    primarySubjectToSupervise: '',
    primarySupervise: '',
    secondarySubject1ToSupervise: '',
    secondarySupervise1: '',
    secondarySubject2ToSupervise: '',
    secondarySupervise2: '',
    selectCollege: '',
    collegeName: '',
    
    // Address Information
    coAddress: '',
    coDistrict: '',
    coState: '',
    coPinCode: '',
    peAddress: '',
    peDistrict: '',
    peState: '',
    pePinCode: '',
    officialAddress: '',
    
    // Contact Information
    mobileNo: '',
    alternativeMobileNo: '',
    personalEmailId: '',
    universityDomainEmail: '',
    
    // Identity Information
    documentName: '',
    twitterId: '',
    linkedinId: ''
  });

  const [editData, setEditData] = useState(personalData);

  // Helper function to get subject name by ID
  const getSubjectNameById = (subjectId) => {
    if (!subjectId || departmentsLoading) return '';
    const department = departments.find(dept => dept.departmentID.toString() === subjectId.toString());
    return department ? department.subject : '';
  };

  // Helper function to get designation name by ID
  const getDesignationNameById = (designationId) => {
    if (!designationId || designationsLoading) return '';
    const designation = designations.find(d => d.designationID?.toString() === designationId.toString());
    return designation ? designation.designationName : '';
  };

  // Fetch departments for dropdowns
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setDepartmentsLoading(true);
        const response = await API.get('/Department');
        
        if (response.data && Array.isArray(response.data)) {
          setDepartments(response.data);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        notification().error('Failed to load departments');
      } finally {
        setDepartmentsLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch designations for dropdown
  useEffect(() => {
    const fetchDesignations = async () => {
      try {
        setDesignationsLoading(true);
        const response = await API.get('/Designations');
        
        if (response.data && Array.isArray(response.data)) {
          setDesignations(response.data);
        }
      } catch (error) {
        console.error('Error fetching designations:', error);
        notification().error('Failed to load designations');
      } finally {
        setDesignationsLoading(false);
      }
    };

    fetchDesignations();
  }, []);

  // Fetch supervisor personal details from API
  useEffect(() => {
    const fetchPersonalDetails = async () => {
      if (!supId) {
        setError('Supervisor ID not found. Please login again.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await API.get(`/SupervisorPersonals/RegWithPers?id=${supId}`);
        
        if (response.data) {
          const apiData = response.data;
          
          // Map API response to component state
          const mappedData = {
            // Basic Information
            empId: apiData.shodhnikId?.toString() || '',
            title: apiData.title || '',
            completeName: apiData.fullName || '',
            fatherName: apiData.fatherName || '',
            dateOfBirth: apiData.dateOfBirth ? new Date(apiData.dateOfBirth).toISOString().split('T')[0] : '',
            retirementDate: apiData.retirementDate ? new Date(apiData.retirementDate).toISOString().split('T')[0] : '',
            gender: apiData.gender || '',
            nationality: apiData.nationality || '',
            designation: apiData.designation?.toString() || '',
            designationName: apiData.designationName || '',
            primarySubjectToSupervise: apiData.primarySuperviseSubject?.toString() || '',
            primarySupervise: apiData.primarySupervise || '',
            secondarySubject1ToSupervise: apiData.secSuperviseSubject1?.toString() || '',
            secondarySupervise1: apiData.secondarySupervise1 || '',
            secondarySubject2ToSupervise: apiData.secSuperviseSubject2?.toString() || '',
            secondarySupervise2: apiData.secondarySupervise2 || '',
            selectCollege: apiData.collegeName || '',
            collegeName: apiData.collegeName || '',
            
            // Address Information
            coAddress: apiData.coAddress || '',
            coDistrict: apiData.coDistrict || '',
            coState: apiData.coState || '',
            coPinCode: apiData.coPinCode || '',
            peAddress: apiData.peAddress || '',
            peDistrict: apiData.peDistrict || '',
            peState: apiData.peState || '',
            pePinCode: apiData.pePinCode || '',
            officialAddress: apiData.officialAddress || '',
            
            // Contact Information
            mobileNo: apiData.mobileNo || '',
            alternativeMobileNo: apiData.alternateMobileNo || '',
            personalEmailId: apiData.email || '',
            universityDomainEmail: apiData.universityDomainEmail || '',
            
            // Identity Information
            documentName: apiData.documentName || '',
            universityEmpId: apiData.supId?.toString() || '',
            twitterId: apiData.twitterID || '',
            linkedinId: apiData.linkedinID || ''
          };
          
          setPersonalData(mappedData);
          setEditData(mappedData);
        }
      } catch (error) {
        console.error('Error fetching personal details:', error);
        setError('Failed to load personal details. Please try again.');
        notification().error('Failed to load personal details');
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalDetails();
  }, [supId]);

  // Non-editable fields list
  const nonEditableFields = ['empId', 'title', 'completeName', 'fatherName',
     'dateOfBirth', 'nationality', 'gender','primarySubjectToSupervise','collegeName'];

  // Required fields for validation
  const requiredFields = [
    { name: 'mobileNo', label: 'Mobile No.' },
    { name: 'officialAddress', label: 'Official Address' }
  ];

  // Email validation helper
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !email || emailRegex.test(email);
  };

  // Validate form data
  const validateForm = () => {
    // Check required fields
    for (const field of requiredFields) {
      if (!editData[field.name] || editData[field.name].toString().trim() === '') {
        notification().error(`${field.label} is required`);
        return false;
      }
    }

    // Validate email formats
    if (editData.personalEmailId && !isValidEmail(editData.personalEmailId)) {
      notification().error('Please enter a valid Personal Email ID');
      return false;
    }

    if (editData.universityDomainEmail && !isValidEmail(editData.universityDomainEmail)) {
      notification().error('Please enter a valid University Domain Email');
      return false;
    }

    // Check if university domain email and personal email are the same
    if (editData.personalEmailId && editData.universityDomainEmail && 
        editData.personalEmailId.toLowerCase().trim() === editData.universityDomainEmail.toLowerCase().trim()) {
      notification().error('University Domain Email and Personal Email cannot be the same');
      return false;
    }

    return true;
  };

  const handleEdit = () => {
    // Ensure editData has the current values, especially for designation
    const updatedEditData = {
      ...personalData,
      // Ensure designation is properly set as string for select comparison
      designation: personalData.designation?.toString() || ''
    };
    console.log('Setting edit data:', { personalData, updatedEditData });
    setEditData(updatedEditData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    // Validate form before saving
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Prepare data for API (using the specified POST format)
      const apiData = {
        supId: supId || 0,
        fullName: editData.completeName || "",
        email: editData.personalEmailId || "",
        permanentState: editData.peState || "",
        permanentPinCode: editData.pePinCode || "",
        permanentAddress: editData.peAddress || "",
        officialAddress: editData.officialAddress || "",
        primarySuperviseSubject: parseInt(editData.primarySubjectToSupervise) || 0,
        secSuperviseSubject1: parseInt(editData.secondarySubject1ToSupervise) || 0,
        secSuperviseSubject2: parseInt(editData.secondarySubject2ToSupervise) || 0,
        alternateMobileNo: editData.alternativeMobileNo || "",
        universityDomainEmail: editData.universityDomainEmail ||null,
        twitterID: editData.twitterId || "",
        linkedinID: editData.linkedinId || "",
        collegeName: editData.collegeName || "",
        designation: parseInt(editData.designation) || 0
      };

      // Make API call to update data
      await API.post(`/SupervisorPersonals/SelectedSupervisor`, apiData);
      
      setPersonalData(editData);
      setIsEditing(false);
      notification().success('Personal details updated successfully');
    } catch (error) {
      console.error('Error saving personal details:', error);
      notification().error('Failed to save personal details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData(personalData);
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Common props for InputField
  const inputFieldProps = {
    isEditing,
    editData,
    personalData,
    handleInputChange,
    nonEditableFields
  };

  // Common props for SelectField
  const selectFieldProps = {
    isEditing,
    editData,
    personalData,
    handleInputChange,
    designationsLoading,
    departmentsLoading,
    nonEditableFields
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading personal details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => {
                  notification().info("Refreshing page...");
                  window.location.reload();
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Personal Details</h1>
          <p className="text-gray-600">Manage your personal and contact information</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <X size={20} />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Edit size={20} />
              Edit Details
            </button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            Personal Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField label="Supervisor ID" name="empId" {...inputFieldProps} />
            <InputField label="Title" name="title" {...inputFieldProps} />
            <InputField label="Full Name" name="completeName" {...inputFieldProps} />
          </div>
          
          {/* College Name and Designation in one div */}
          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  College Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={personalData.collegeName || ''}
                  className="w-full border border-gray-200 bg-gray-50 cursor-default rounded px-3 py-2"
                  readOnly
                  disabled
                />
              </div>
              {isEditing ? (
                <SelectField 
                  label="Designation" 
                  name="designation" 
                  options={designationsLoading ? [] : designations.map(d => ({ value: d.designationID, label: d.designationName }))}
                  {...selectFieldProps}
                />
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={getDesignationNameById(personalData.designation) || personalData.designationName || ''}
                    className="w-full border border-gray-200 bg-gray-50 cursor-default rounded px-3 py-2"
                    readOnly
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Primary Subject to Supervise <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="primarySubjectToSupervise"
                value={getSubjectNameById(personalData.primarySubjectToSupervise) || personalData.primarySupervise || ''}
                className="w-full border border-gray-200 bg-gray-50 cursor-default rounded px-3 py-2"
                readOnly
                disabled
              />
            </div>
            {isEditing ? (
              <>
                <SelectField 
                  label="Secondary Subject 1 to Supervise" 
                  name="secondarySubject1ToSupervise" 
                  options={departmentsLoading ? [] : departments.map(dept => ({ value: dept.departmentID, label: dept.subject }))}
                  nonEditableFields={nonEditableFields}
                  {...selectFieldProps}
                />
                <SelectField 
                  label="Secondary Subject 2 to Supervise" 
                  name="secondarySubject2ToSupervise" 
                  options={departmentsLoading ? [] : departments.map(dept => ({ value: dept.departmentID, label: dept.subject }))}
                  nonEditableFields={nonEditableFields}
                  {...selectFieldProps}
                />
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Secondary Subject 1 to Supervise
                  </label>
                  <input
                    type="text"
                    value={getSubjectNameById(personalData.secondarySubject1ToSupervise) || personalData.secondarySupervise1 || ''}
                    className="w-full border border-gray-200 bg-gray-50 cursor-default rounded px-3 py-2"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Secondary Subject 2 to Supervise
                  </label>
                  <input
                    type="text"
                    value={getSubjectNameById(personalData.secondarySubject2ToSupervise) || personalData.secondarySupervise2 || ''}
                    className="w-full border border-gray-200 bg-gray-50 cursor-default rounded px-3 py-2"
                    readOnly
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-purple-600" />
            Address Information
          </h3>
          
          {/* Correspondence Address */}
          
          {/* Permanent Address */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-700 mb-3">Permanent Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Address" name="peAddress" {...inputFieldProps} />
              <InputField label="District" name="peDistrict" {...inputFieldProps} />
              <InputField label="State" name="peState" {...inputFieldProps} />
              <InputField label="PIN Code" name="pePinCode" {...inputFieldProps} />
            </div>
          </div>
          
          {/* Official Address */}
          <div>
            <InputField label="Official Address" name="officialAddress" required {...inputFieldProps} />
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Phone size={20} className="text-green-600" />
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField label="Mobile No." name="mobileNo" type="tel" required {...inputFieldProps} />
            <InputField label="Alternative Mobile No." name="alternativeMobileNo" type="tel" {...inputFieldProps} />
            <InputField label="Personal Email ID" name="personalEmailId" type="email" {...inputFieldProps} />
            <InputField label="University Domain Email" name="universityDomainEmail" type="email" {...inputFieldProps} />
          </div>
        </div>

        {/* Identity Information */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <IdCard size={20} className="text-orange-600" />
            Identity Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField label="LinkedIn ID" name="linkedinId" {...inputFieldProps} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalDetails;