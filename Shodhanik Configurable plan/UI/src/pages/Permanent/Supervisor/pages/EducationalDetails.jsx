import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Table, Modal, Input, DatePicker, Button, Spin } from 'antd';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import dayjs from 'dayjs';


const EducationalDetails = () => {
  const [educationData, setEducationData] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();
  const [formData, setFormData] = useState({
    degree: '',
    institution: '',
    year: null,
    supId: supId,
    details: ''
  });
  const [dob, setDob] = useState(null);

  useEffect(() => {
    getEdu();
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

  const getEdu = async () => {
    setLoading(true);
    try {
      const response = await API.get(`/SupervisorQualifications/BySupervisor?supid=${supId}`);

      // Process supervisorQualifications (editable)
      const qualificationsData = response.data.supervisorQualifications?.map(item => ({
        id: item.id,
        degree: item.course,
        year: item.year,
        institution: item.institution,
        details: item.details,
        supId: item.supId,
        isEditable: true,
        source: 'qualifications'
      })) || [];

      // Process education data (read-only PhD data)
      const educationData = response.data.education?.map(item => ({
        id: `edu_${item.id}`, // Prefix to avoid ID conflicts
        degree: 'PhD',
        year: item.monthAndYear || '',
        institution: item.phdUniversity || '',
        details: item.thesisTitle || '',
        supId: item.supId,
        isEditable: false,
        source: 'education'
      })) || [];

      // Combine both data sources
      const combinedData = [...qualificationsData, ...educationData];
      setEducationData(qualificationsData);
      setCombinedData(combinedData);

    } catch (err) {
      console.error(err);
      notification().error('Failed to fetch education records');
    } finally {
      setLoading(false);
    }
  };

  const postEducation = async (data) => {
    const response = await API.post('/SupervisorQualifications', {
      supId: data.supId,
      course: data.degree.trim(),
      year: data.year ? data.year.format('YYYY') : '',
      institution: data.institution.trim(),
      details: data.details.trim()
    });
    return response.data;
  };

  const updateEducation = async (id, data) => {
    const response = await API.put(`/SupervisorQualifications/${id}`, {
      id: id,
      supId: data.supId,
      course: data.degree.trim(),
      year: data.year ? data.year.format('YYYY') : '',
      institution: data.institution.trim(),
      details: data.details.trim()
    });
    return response.data;
  };

  const deleteEducation = async (id) => {
    await API.delete(`/SupervisorQualifications/${id}`);
  };

  const handleSubmit = async () => {
    // Validation with specific error messages
    if (!formData.degree.trim()) {
      notification().warning('Course/Degree name is required');
      return;
    }
    if (!formData.year) {
      notification().warning('Year is required');
      return;
    }
    if (!formData.institution.trim()) {
      notification().warning('Institution name is required');
      return;
    }

    // Year validation
    const currentYear = new Date().getFullYear();
    const enteredYear = parseInt(formData.year.format('YYYY'));
    if (enteredYear > currentYear) {
      notification().warning(`Please enter a valid year`);
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateEducation(editingItem.id, formData);
        notification().success('Education record updated successfully');
      } else {
        await postEducation(formData);
        notification().success('Education record added successfully');
      }

      // Close modal and reset form
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        degree: '',
        institution: '',
        year: null,
        details: '',
        supId: supId,
      });

      // Refresh the education data
      await getEdu();

    } catch (error) {
      console.error('Save failed', error);

      // Provide specific error messages
      if (error.response?.status === 400) {
        if (error.response.data?.message) {
          notification().error(`Validation Error: ${error.response.data.message}`);
        } else {
          notification().error('Please check all required fields and try again');
        }
      } else if (error.response?.status === 500) {
        notification().error('Server error occurred. Please try again later');
      } else if (error.response?.data?.message) {
        notification().error(`Error: ${error.response.data.message}`);
      } else {
        notification().error(editingItem ? 'Failed to update education record' : 'Failed to add education record');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const formDataWithYear = {
      ...item,
      year: item.year ? dayjs(item.year, 'YYYY') : null
    };
    setFormData(formDataWithYear);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Education Record',
      message: 'Are you sure you want to delete this education record? This action cannot be undone.'
    });

    if (!confirmed) return;

    try {
      await deleteEducation(id);
      notification().success('Education record deleted successfully');

      // Refresh the education data
      await getEdu();

    } catch (error) {
      console.error('Delete failed', error);

      if (error.response?.status === 404) {
        notification().error('Education record not found. It may have already been deleted.');
      } else if (error.response?.status === 403) {
        notification().error('You don\'t have permission to delete this record.');
      } else if (error.response?.data?.message) {
        notification().error(`Error: ${error.response.data.message}`);
      } else {
        notification().error('Failed to delete education record');
      }
    }
  };

  const handleYearChange = (date) => {
    setFormData(prev => ({ ...prev, year: date }));
  };

  const openModal = () => {
    setEditingItem(null);
    setFormData({ degree: '', institution: '', year: null, details: '', supId: supId });
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ degree: '', institution: '', year: null, details: '', supId: supId });
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
      title: 'Course / Degree',
      dataIndex: 'degree',
      key: 'degree',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <span className={`font-medium ${record.isEditable ? 'text-gray-800' : 'text-blue-800'}`}>
            {text}
          </span>

        </div>
      ),
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 100,
      align: 'center',
      render: (text, record) => (
        <span className={record.isEditable ? 'text-gray-800' : 'text-blue-800'}>
          {text}
        </span>
      ),
    },
    {
      title: 'Institution',
      dataIndex: 'institution',
      key: 'institution',
      render: (text, record) => (
        <span className={record.isEditable ? 'text-gray-800' : 'text-blue-800'}>
          {text}
        </span>
      ),
    },
    {
      title: 'Details / Thesis Topic',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (text, record) => (
        <span className={record.isEditable ? 'text-gray-800' : 'text-blue-800'}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          {record.isEditable ? (
            <>
              <button
                onClick={() => handleEdit(record)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDelete(record.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
              Not Editable
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Card Container */}
        <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
          {/* Header */}
          <div className=" rounded-t-lg px-6 py-4 flex items-center">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-black">Educational Details</h2>
              <p className="text-gray-600 text-sm mt-1">Manage your educational qualifications and academic background</p>
            </div>
            <Button
              type="primary"
              icon={<Plus size={18} />}
              onClick={openModal}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700"
            >
              Add Education
            </Button>
          </div>

          {/* Table */}
          <div className="p-4">
            {/* Legend */}


            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spin size="large" />
              </div>
            ) : (
              <Table
                columns={columns}
                dataSource={combinedData}
                rowKey="id"
                rowClassName={(record) => record.isEditable ? '' : 'bg-blue-50'}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`
                }}
                bordered
                size="middle"
                locale={{
                  emptyText: (
                    <div className="py-8 text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Education Records</h3>
                      <p className="text-gray-500 mb-4">Add your educational qualifications to get started</p>
                    </div>
                  )
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Ant Design Modal */}
      <Modal
        title={editingItem ? 'Edit Education Record' : 'Add Education Record'}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={handleSubmit}
        confirmLoading={saving}
        okText={editingItem ? 'Update' : 'Add'}
        cancelText="Cancel"
        width={600}
        maskClosable={false}
        destroyOnClose={true}
      >
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course / Degree Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Enter course or degree name"
                value={formData.degree}
                onChange={(e) => setFormData(prev => ({ ...prev, degree: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <DatePicker
                picker="year"
                style={{ width: '100%' }}
                placeholder="Select year"
                value={formData.year}
                onChange={handleYearChange}
                disabledDate={(current) => {
                  if (!dob) return false;
                  const birthYear = dob.year();
                  const currentYear = dayjs().year();
                  return current.year() < birthYear || current.year() > currentYear;
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institution <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Enter institution name"
              value={formData.institution}
              onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Details / Thesis Topic / Subjects
            </label>
            <Input.TextArea
              rows={3}
              placeholder="Enter details, thesis topic, or subjects"
              value={formData.details}
              onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EducationalDetails;
