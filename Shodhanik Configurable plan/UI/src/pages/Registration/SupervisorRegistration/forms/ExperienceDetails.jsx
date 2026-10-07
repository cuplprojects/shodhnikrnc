import { useEffect, useState } from 'react';
import { Table, Input, DatePicker, Checkbox, Select, Button, Upload } from 'antd';
import { ChevronDown, ChevronUp, Edit2, Trash2, UploadCloud, ChevronRight, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import API from '@/services/API';
import { useFileViewer } from '@/services/FileViewerService';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import useStepSupStore from '../components/stepStore';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import useStepsSup from '@/hooks/useStepsSup';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';

const { TextArea } = Input;
const { Option } = Select;

const ExperienceDetails = () => {
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  const isStepReadOnly = useStepSupStore(state => state.isStepReadOnly);
  const checkScreeningStatus = useStepSupStore(state => state.checkScreeningStatus);
  const navigate = useNavigate();
  const { saveStep } = useStepsSup();
  const { openFile, FileViewerModal } = useFileViewer();
  const [supervisorData, setSupervisorData] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [isPresentlyWorking, setIsPresentlyWorking] = useState(false);
  const [ExperienceData, setExperienceData] = useState([]);
  const [totalExperience, setTotalExperience] = useState('');
  const [formData, setFormData] = useState({
    supId,
    organizationName: '',
    designation: '',
    dateFrom: '',
    dateTo: '',
    natureOfDuties: '',
    resExperience: '',
    category: '', // "Aided" | "Self-Financed" | "Government"
    areaOfSpec: '',
    experienceDoc: null,
  });
  const [dob, setDob] = useState(null);
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
      handleGetRegWithPers();
    }
  }, [supId, checkScreeningStatus]);

  // Calculate isReadOnly after supervisorData is available
  const isReadOnly = supervisorData ? isStepReadOnly(3, supervisorData) : false; // Step 3 = Experience Details

  // Function to parse total experience string and check if >= 10 years
  const hasMinimumExperience = (experienceString) => {
    if (!experienceString || typeof experienceString !== 'string') return false;

    // Parse the experience string like "11 years 11 months 24 days"
    const yearMatch = experienceString.match(/(\d+)\s+years?/);
    const years = yearMatch ? parseInt(yearMatch[1]) : 0;

    return years >= 10;
  };
  const handleGetRegWithPers = async () => {
    try {
      if (!supId) return;

      const response = await API.get(`/SupervisorPersonals/RegWithPers?id=${supId}`);
      const data = response.data;

      const dobValue = data.dateOfBirth
        ? dayjs(data.dateOfBirth.split(' ')[0], 'YYYY-MM-DD') // only take the date part
        : null;
      setDob(dobValue); // Store DOB for datepicker
      setFormData(prev => ({
        ...prev,
        dateOfBirth: dobValue,
        // ...other fields
      }));
    } catch (error) {
      console.log(error);
    }
  };
  // Function to calculate experience in years, months, and days
  const calculateExperience = (startDate, endDate) => {
    if (!startDate) return '';

    const start = dayjs(startDate);
    const end = endDate ? dayjs(endDate) : dayjs(); // Use current date if presently working

    // Calculate the difference
    let years = end.diff(start, 'year');
    let months = end.diff(start.add(years, 'year'), 'month');
    let days = end.diff(start.add(years, 'year').add(months, 'month'), 'day');

    // Build the result string
    const parts = [];

    if (years > 0) {
      parts.push(`${years} year${years > 1 ? 's' : ''}`);
    }

    if (months > 0) {
      parts.push(`${months} month${months > 1 ? 's' : ''}`);
    }

    if (days > 0) {
      parts.push(`${days} day${days > 1 ? 's' : ''}`);
    }

    // Handle edge cases
    if (parts.length === 0) {
      return '0 days';
    } else if (parts.length === 1) {
      return parts[0];
    } else if (parts.length === 2) {
      return parts.join(' ');
    } else {
      // years, months, and days
      return parts.join(' ');
    }
  };

  // Calculate experience whenever dates change
  useEffect(() => {
    const experience = calculateExperience(formData.dateFrom, isPresentlyWorking ? null : formData.dateTo);
    setFormData(prev => ({ ...prev, resExperience: experience }));
  }, [formData.dateFrom, formData.dateTo, isPresentlyWorking]);

  /** ------------------ HANDLERS ------------------ */

  const handleFileChange = (info) => {
    const { fileList } = info;

    if (fileList.length > 0) {
      const file = fileList[0].originFileObj || fileList[0];
      setFormData(prev => ({ ...prev, experienceDoc: file }));
      notification().success('Document uploaded successfully!');
    } else {
      setFormData(prev => ({ ...prev, experienceDoc: null }));
    }
  };

  const handleSaveAndNext = async (e) => {
    if (isReadOnly) {
      return; // Silently prevent submission when read-only
    }

    if (!hasMinimumExperience(totalExperience)) {
      notification().warning(`You need to have at least 10 years of total experience to proceed. Currently you have: ${totalExperience || 'No experience calculated'}`);
      return;
    }

    notification().success("Experience section completed successfully!");
    setTimeout(async () => {
      const stepSaved = await saveStep(3);
      if (stepSaved) {
        navigate(SUPERVISOR_REGISTRATION_ROUTES.RESEARCH_PAPER);
      } else {
        notification().error("Failed to update step progress. Please try again.");
      }
    }, 1500);
  };


  const handleRemoveFile = () => {
    setFormData(prev => ({ ...prev, experienceDoc: null }));
    notification().info('Document removed successfully!');
  };

  const handleAddNew = () => {
    setIsFormVisible(prev => !prev);
    setEditingKey(null);
    setFormData({
      supId,
      organizationName: '',
      designation: '',
      dateFrom: '',
      dateTo: '',
      natureOfDuties: '',
      resExperience: '',
      category: '',
      areaOfSpec: '',
      experienceDoc: null,
    });
    setIsPresentlyWorking(false);
  };

  // Function to check if date ranges overlap
  const checkDateOverlap = (newStart, newEnd, existingRecords, currentEditingId) => {
    try {
      if (!newStart || !newEnd || !existingRecords || existingRecords.length === 0) {
        return false;
      }

      // Parse new dates
      const newStartDate = dayjs(newStart);
      const newEndDate = dayjs(newEnd);

      // Early return if dates are invalid
      if (!newStartDate.isValid() || !newEndDate.isValid()) {
        return false;
      }

      // Check each existing record for overlap
      for (const record of existingRecords) {
        if (currentEditingId && record.id === currentEditingId) {
          continue;
        }

        try {
          const existingStart = dayjs(record.dateFrom);
          const existingEnd = record.dateTo ? dayjs(record.dateTo) : dayjs();

          if (!existingStart.isValid() || !existingEnd.isValid()) {
            continue;
          }

          // Check for overlap
          if (newStartDate.isSameOrBefore(existingEnd, 'day') && newEndDate.isSameOrAfter(existingStart, 'day')) {
            return true;
          }
        } catch (recordError) {
          // Skip this record if there's an error parsing it
          continue;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking date overlap:', error);
      return false;
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Validate that dates are provided
    if (!formData.dateFrom) {
      notification().error('Please select a start date');
      return;
    }

    if (!formData.natureOfDuties) {
      notification().error('Please enter nature Of duties');
      return;
    }
    if (!isPresentlyWorking && !formData.dateTo) {
      notification().error('Please select an end date or check "Presently Working"');
      return;
    }

    // Validate document upload for new entries
    if (!editingKey && !formData.experienceDoc) {
      notification().error('Please upload an experience document');
      return;
    }

    // Check for date overlap with existing records
    if (checkDateOverlap(formData.dateFrom, formData.dateTo, ExperienceData, editingKey)) {
      notification().error('Experience dates overlap with an existing record. Please adjust the dates.');
      return;
    }

    try {
      // Create FormData for file upload
      const formDataPayload = new FormData();

      // Append all form fields
      formDataPayload.append('supId', formData.supId);
      formDataPayload.append('organizationName', formData.organizationName);
      formDataPayload.append('designation', formData.designation);
      formDataPayload.append('dateFrom', formData.dateFrom ? dayjs(formData.dateFrom).toISOString() : '');
      formDataPayload.append('dateTo', isPresentlyWorking ? '' : (formData.dateTo ? dayjs(formData.dateTo).toISOString() : ''));
      formDataPayload.append('natureOfDuties', formData.natureOfDuties);
      formDataPayload.append('resExperience', formData.resExperience);
      formDataPayload.append('category', formData.category);
      formDataPayload.append('areaOfSpec', formData.areaOfSpec);

      // Append file if exists
      if (formData.experienceDoc) {
        formDataPayload.append('experienceDoc', formData.experienceDoc);
      }

      if (editingKey) {
        formDataPayload.append('id', editingKey);
        await API.put(`/SupervisorExperience/${editingKey}`, formDataPayload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notification().success('Experience details updated successfully!');
      } else {
        await API.post('/SupervisorExperience', formDataPayload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notification().success('Experience details added successfully!');
      }

      fetchExperienceData();
      setIsFormVisible(false);
      setEditingKey(null);
    } catch (error) {
      console.error(error);
      notification().error('Error saving experience details. Please try again.');
    }
  };

  const fetchExperienceData = async () => {
    try {
      const res = await API.get(`/SupervisorExperience/BySupervisor?supId=${supId}`);
      setExperienceData(res.data.experiences || res.data);
      setTotalExperience(res.data.totalExperience || '');
    } catch (error) {
      console.error(error);
      notification().error('Failed to load experience data. Please refresh the page.');
    }
  };

  const handleEdit = (record) => {
    setIsFormVisible(true);
    setEditingKey(record.id);
    const isPresentlyWorkingRecord = !record.dateTo;
    setIsPresentlyWorking(isPresentlyWorkingRecord);

    setFormData({
      supId,
      organizationName: record.organizationName,
      designation: record.designation,
      dateFrom: record.dateFrom,
      dateTo: record.dateTo,
      natureOfDuties: record.natureOfDuties,
      resExperience: record.resExperience, // This will be recalculated by useEffect
      category: record.category,
      areaOfSpec: record.areaOfSpec,
      experienceDoc: null, // Reset file for editing - user can upload new one
      existingDoc: record.doc, // Store existing doc path for reference
    });
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/SupervisorExperience/${id}`);
      notification().success('Experience record deleted successfully!');
      fetchExperienceData();
    } catch (error) {
      console.error(error);
      notification().error('Failed to delete experience record. Please try again.');
    }
  };

  /** ------------------ TABLE COLUMNS ------------------ */
  const columns = [
    {
      title: 'Organization Name',
      dataIndex: 'organizationName',
      key: 'organizationName',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
    },
    {
      title: 'Area of Specialization',
      dataIndex: 'areaOfSpec',
      key: 'areaOfSpec',
    },
    {
      title: 'Experience (Years, Months, Days)',
      dataIndex: 'resExperience',
      key: 'resExperience',
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => `${record.dateFrom ? dayjs(record.dateFrom).format('DD-MM-YYYY') : ''} to ${record.dateTo ? dayjs(record.dateTo).format('DD-MM-YYYY') : 'Present'}`,
    },
    {
      title: 'Document',
      key: 'doc',
      render: (_, record) =>
        record.doc ? (
          <div className="flex gap-2">
            <Button 
              type="primary" 
              size="small"
              onClick={() => {
                const fileUrl = `${getBaseFileURL()}/${record.doc}`;
                const fileName = record.doc.split('/').pop() || 'document';
                openFile(fileUrl, fileName);
              }}
            >
              <Eye size={14} />
              View
            </Button>
          </div>
        ) : 'No Document',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        !isReadOnly && (
          <div className="flex gap-2">
            <Button type="primary" size="small" onClick={() => handleEdit(record)}>
              <Edit2 size={14} />
            </Button>
            <Button type="danger" size="small" onClick={() => handleDelete(record.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        )
      ),
    },
  ];

  useEffect(() => {
    fetchExperienceData();
  }, []);

  /** ------------------ JSX ------------------ */
  return (
    <div className="p-4 md:p-5">
      {FileViewerModal}

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-[#111827] pb-2 border-b-2 border-[#1e40af] flex-1">
          Experience Details
        </h2>
        {!isReadOnly && (
          <Button type="primary" onClick={handleAddNew}>
            {isFormVisible && !editingKey ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            Add Experience
          </Button>
        )}
      </div>

      {/* Form */}
      {isFormVisible && !isReadOnly && (
        <div className="mb-6 border border-[#d1d5db] rounded-lg p-4 bg-white shadow-sm">
          <form onSubmit={handleSave} className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.organizationName}
                  onChange={(e) => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
                  placeholder="Enter organization name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.category}
                  onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                  placeholder="Select Category"
                  style={{ width: '100%' }}
                  required
                >
                  <Option value="Aided">Aided</Option>
                  <Option value="Self-Financed">Self-Financed</Option>
                  <Option value="Government">Government</Option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Designation <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                  placeholder="Enter designation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area of Specialization <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.areaOfSpec}
                  onChange={(e) => setFormData(prev => ({ ...prev, areaOfSpec: e.target.value }))}
                  placeholder="Enter area of specialization"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  className="w-full"
                  format="DD-MM-YYYY"
                  value={formData.dateFrom ? dayjs(formData.dateFrom) : null}
                  onChange={(date) => setFormData(prev => ({ ...prev, dateFrom: date ? date.toISOString() : '' }))}
                  placeholder="Select start date"
                  disabledDate={(current) => {
                    const today = dayjs();
                    // Disable future dates and dates before DOB
                    if (dob) {
                      return current && (current.isAfter(today, 'day') || current.isBefore(dob, 'day'));
                    }
                    return current && current.isAfter(today, 'day');
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date {!isPresentlyWorking && <span className="text-red-500">*</span>}
                </label>
                <DatePicker
                  className="w-full"
                  format="DD-MM-YYYY"
                  value={formData.dateTo ? dayjs(formData.dateTo) : null}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, dateTo: date ? date.toISOString() : '' }));
                    if (date) setIsPresentlyWorking(false);
                  }}
                  disabled={isPresentlyWorking || !formData.dateFrom}
                  placeholder="Select end date"
                  disabledDate={(current) => {
                    const today = dayjs();
                    // Disable future dates and dates before start date
                    if (formData.dateFrom) {
                      return current && (current.isAfter(today, 'day') || current.isBefore(dayjs(formData.dateFrom), 'day'));
                    }
                    return current && current.isAfter(today, 'day');
                  }}
                />
                <Checkbox
                  className="mt-2"
                  checked={isPresentlyWorking}
                  onChange={(e) => {
                    setIsPresentlyWorking(e.target.checked);
                    if (e.target.checked) setFormData(prev => ({ ...prev, dateTo: '' }));
                  }}
                >
                  Presently Working
                </Checkbox>
                {formData.dateFrom && formData.dateTo && !isPresentlyWorking && (() => {
                  try {
                    return checkDateOverlap(formData.dateFrom, formData.dateTo, ExperienceData, editingKey);
                  } catch (err) {
                    console.error('Date overlap check error:', err);
                    return false;
                  }
                })() && (
                  <div className="text-xs text-red-600 mt-1">
                    ⚠️ Warning: These dates overlap with an existing experience record
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience
                </label>
                <Input
                  value={formData.resExperience}
                  placeholder="Experience will be calculated from dates"
                  disabled
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nature of Duties <span className="text-red-500">*</span>
              </label>
              <TextArea
                rows={3}
                value={formData.natureOfDuties}
                onChange={(e) => setFormData(prev => ({ ...prev, natureOfDuties: e.target.value }))}
                placeholder="Describe your responsibilities and duties"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Document (PDF) <span className="text-red-500">*</span>
              </label>
              <Upload
                onChange={handleFileChange}
                fileList={formData.experienceDoc ? [{
                  uid: formData.experienceDoc.uid || Date.now().toString(),
                  name: formData.experienceDoc.name || 'experienceDocument.pdf',
                  status: 'done',
                  originFileObj: formData.experienceDoc
                }] : []}
                maxCount={1}
                accept=".pdf"
                onRemove={handleRemoveFile}
                beforeUpload={() => false}
              >
                <Button>
                  <UploadCloud size={16} style={{ marginRight: '6px' }} />
                  Upload PDF
                </Button>
              </Upload>
              <div className="text-xs text-gray-500 mt-1">
                Accepted format: PDF only (Max size: 5MB)
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              {editingKey && (
                <Button onClick={handleAddNew} danger>
                  Cancel
                </Button>
              )}
              <Button type="primary" htmlType="submit">
                {editingKey ? 'Update' : 'Save'}
              </Button>
            </div>

          </form>
        </div>
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={ExperienceData}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        bordered
        size="small"
      />

      {/* Total Experience Display */}
      {totalExperience && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Total Experience: </span>
              <span className="text-sm font-semibold text-blue-700">{totalExperience}</span>
            </div>
            {/* <div className={`text-xs px-2 py-1 rounded-full ${hasMinimumExperience(totalExperience)
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
              }`}>
              {hasMinimumExperience(totalExperience) ? '✓ Meets Requirement' : '✗ Minimum 10 years required'}
            </div> */}
          </div>
        </div>
      )}
      <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
        <button
          type="button"
          onClick={handleSaveAndNext}
          disabled={isReadOnly || !hasMinimumExperience(totalExperience)}
          className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${isReadOnly || !hasMinimumExperience(totalExperience)
            ? 'bg-amber-200 text-amber-800 cursor-not-allowed border border-amber-300'
            : 'bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] hover:shadow-lg'
            }`}
          title={
            !hasMinimumExperience(totalExperience)
              ? `Minimum 10 years experience required. Current: ${totalExperience || 'No experience calculated'}`
              : ''
          }
        >
          Save & Next
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default ExperienceDetails;
