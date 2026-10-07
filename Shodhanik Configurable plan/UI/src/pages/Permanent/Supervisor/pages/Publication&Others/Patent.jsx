import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, DatePicker, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';

const { Option } = Select;
const { TextArea } = Input;

const Patent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Replace with actual API endpoint for patents
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=12`);
      const publications = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(publications);
    } catch (error) {
      console.error('Error fetching patent data:', error);
      
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srno',
      render: (_, __, index) => index + 1,
      width: 80,
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => (
        <div>
          <div><strong>Application Number:</strong> {record.applicationNumber}</div>
          <div><strong>Application Name:</strong> {record.applicationName}</div>
          <div><strong>Title/Name:</strong> {record.title}</div>
        </div>
      ),
      width: 300,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div>
          <div><strong>Brief Description:</strong> {record.detailsOfEvent}</div>
          <div><strong>Category:</strong> {record.category}</div>
          <div><strong>Status:</strong> {record.category}</div>
          <div><strong>Date of Award/Granted:</strong> {record.date}</div>
        </div>
      ),
      width: 400,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />} 
            size="small"
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
      width: 100,
    },
  ];

  const handleBack = () => {
    navigate('/supervisor-dashboard/publications-papers');
  };

  const handleAddNew = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      applicationNumber: record.applicationNumber,
      applicationName: record.applicationName,
      titleName: record.title,
      briefDescription: record.detailsOfEvent,
      category: record.category,
      status: record.activityType,
      dateOfAward: record.date ? dayjs(record.date) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`SupervisorCategories/${id}`);
      notification().success('Record deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting record:', error);
      notification().error('Failed to delete record');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        id: editingRecord?.id || 0,
        categoryId: 12, // Patent category ID
        supId: supId || 0,
        // Only send the fields that are actually used in the UI
        applicationNumber: values.applicationNumber,
        applicationName: values.applicationName,
        title: values.titleName,
        category: values.category,
        activityType: values.status,
        date: values.dateOfAward ? values.dateOfAward.format('YYYY-MM-DD') : '',
        detailsOfEvent: values.briefDescription
      };

      if (editingRecord) {
        await API.put(`SupervisorCategories/${editingRecord.id}`, payload);
        notification().success('Record updated successfully');
      } else {
        await API.post('SupervisorCategories', payload);
        notification().success('Record added successfully');
      }

      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Error saving record:', error);
      notification().error('Failed to save record');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          onClick={handleBack} 
          icon={<ArrowLeftOutlined />}
          className="mb-4"
        >
          Back to Publications
        </Button>
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 m-0">
            Patent
          </h2>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAddNew}
          >
            Add New
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `Showing ${range[0]} to ${range[1]} of ${total} entries`,
          pageSizeOptions: ['10', '25', '50', '100'],
        }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingRecord ? "Edit Record" : "Add New Record"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="applicationNumber"
            label={<span>Application Number <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the application number' }]}
          >
            <Input placeholder="Enter application number" />
          </Form.Item>

          <Form.Item
            name="applicationName"
            label={<span>Application Name <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the application name' }]}
          >
            <Input placeholder="Enter application name" />
          </Form.Item>

          <Form.Item
            name="titleName"
            label={<span>Title/Name <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the title/name' }]}
          >
            <Input placeholder="Enter title/name" />
          </Form.Item>

          <Form.Item
            name="briefDescription"
            label={<span>Brief Description <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the brief description' }]}
          >
            <TextArea 
              placeholder="Enter brief description" 
              rows={4}
            />
          </Form.Item>

          <Form.Item
            name="category"
            label={<span>Category <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please select the category' }]}
          >
            <Select placeholder="Select category">
              <Option value="National">National</Option>
              <Option value="International">International</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label={<span>Status <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please select the status' }]}
          >
            <Select placeholder="Select status">
              <Option value="Published">Published</Option>
              <Option value="Awarded">Awarded</Option>
              <Option value="Granted">Granted</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dateOfAward"
            label={<span>Date of Award/Granted <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please select the date of award/granted' }]}
          >
            <DatePicker 
              style={{ width: '100%' }}
              placeholder="Select date of award/granted"
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalVisible(false)}>
              Close
            </Button>
            <Button type="primary" htmlType="submit">
              {editingRecord ? 'Update' : 'Submit'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Patent;