import { useEffect, useState } from 'react';
import { Table, Input, DatePicker, Checkbox, Select, Button } from 'antd';
import { ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';

const { TextArea } = Input;
const { Option } = Select;

const ExperienceDetails = () => {
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [isPresentlyWorking, setIsPresentlyWorking] = useState(false);
  const [ExperienceData, setExperienceData] = useState([]);
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
  });
  const [dob, setDob] = useState(null);

  useEffect(() => {
    fetchExperienceData();
    handleGetRegWithPers();
  }, []);

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

  const fetchExperienceData = async () => {
    try {
      const res = await API.get(`/SupervisorExperience/BySupervisor?supId=${supId}`);
      setExperienceData(res.data.experiences || res.data);
    } catch (error) {
      console.error(error);
      notification().error('Failed to load experience data. Please refresh the page.');
    }
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
    });
    setIsPresentlyWorking(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Validate that dates are provided
    if (!formData.dateFrom) {
      notification().error('Please select a start date');
      return;
    }

    if (!isPresentlyWorking && !formData.dateTo) {
      notification().error('Please select an end date or check "Presently Working"');
      return;
    }

    try {
      const form = new FormData();

      form.append("supId", formData.supId);
      form.append("organizationName", formData.organizationName);
      form.append("designation", formData.designation);
      form.append("dateFrom", formData.dateFrom);
      form.append("dateTo", isPresentlyWorking ? "" : formData.dateTo);
      form.append("natureOfDuties", formData.natureOfDuties);
      form.append("resExperience", formData.resExperience);
      form.append("category", formData.category);
      form.append("areaOfSpec", formData.areaOfSpec);
      if (editingKey) {
        await API.put(`/SupervisorExperience/${editingKey}`, form);
        notification().success('Experience details updated successfully!');
      } else {
        await API.post('/SupervisorExperience', form);
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

  const handleEdit = (record) => {
    // Don't allow editing if the record has a document
    if (record.experienceDoc) {
      notification().warning('Cannot edit experience records that have documents attached.');
      return;
    }

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

  const formatDate = (dateString) => {
    if (!dateString) return 'Present';
    return dayjs(dateString).format('DD-MM-YYYY');
  };

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
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
      title: 'Duration',
      key: 'duration',
      render: (_, record) => `${formatDate(record.dateFrom)} to ${formatDate(record.dateTo)}`,
    },
    {
      title: 'Document',
      key: 'document',
      render: (_, record) =>
        record.experienceDoc ? (
          <a href={record.experienceDoc} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            View Document
          </a>
        ) : (
          <span className="text-gray-400">No Document</span>
        ),
    },
    {
      title: 'Nature of Duties',
      dataIndex: 'natureOfDuties',
      key: 'natureOfDuties',
      ellipsis: true,
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => handleEdit(record)}
            disabled={record.experienceDoc} // Disable edit if document exists
            className={`p-1.5 rounded transition-colors ${record.experienceDoc
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-blue-600 hover:bg-blue-50'
              }`}
            title={record.experienceDoc ? 'Cannot edit records with documents' : 'Edit'}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleDelete(record.id)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-[#111827] pb-2 border-b-2 border-[#1e40af] flex-1">
          Experience Details
        </h2>
        <Button type="primary" onClick={handleAddNew}>
          {isFormVisible && !editingKey ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          Add Experience
        </Button>
      </div>

      {/* Form */}
      {isFormVisible && (
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
                Area of Specialization <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.areaOfSpec}
                onChange={(e) => setFormData(prev => ({ ...prev, areaOfSpec: e.target.value }))}
                placeholder="Enter area of specialization"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  className="w-full"
                  format="DD-MM-YYYY"
                  value={formData.dateFrom ? dayjs(formData.dateFrom) : null}
                  onChange={(date) => setFormData(prev => ({ ...prev, dateFrom: date ? date.format('YYYY-MM-DD') : '' }))}
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
                    setFormData(prev => ({ ...prev, dateTo: date ? date.format('YYYY-MM-DD') : '' }));
                    if (date) setIsPresentlyWorking(false);
                  }}
                  disabled={isPresentlyWorking || !formData.dateFrom}
                  placeholder="Select end date"
                  disabledDate={(current) => formData.dateFrom && current < dayjs(formData.dateFrom)}
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
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nature of Duties
              </label>
              <TextArea
                rows={3}
                value={formData.natureOfDuties}
                onChange={(e) => setFormData(prev => ({ ...prev, natureOfDuties: e.target.value }))}
                placeholder="Describe your responsibilities and duties"
              />
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
        pagination={{ pageSize: 10 }}
        bordered
        size="middle"
        locale={{
          emptyText: (
            <div className="py-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Experience Records</h3>
              <p className="text-gray-500 mb-4">Add your professional experience to get started</p>
            </div>
          )
        }}
      />
    </div>
  );
};

export default ExperienceDetails;