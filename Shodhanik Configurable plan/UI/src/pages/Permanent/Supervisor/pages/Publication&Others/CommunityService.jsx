import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Table, Modal, Form, Input, Select, DatePicker, message, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';
import dayjs from 'dayjs';

const { Option } = Select;

const CommunityService = () => {
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
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=11`);
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching community service:', error);
      notification().error('Failed to load community service');
      setData([]);
    } finally {
      setLoading(false);
    }
  };



  const handleBack = () => {
    navigate('/supervisor-dashboard/publications-papers');
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      activityType: record.activityType,
      date: record.date ? dayjs(record.date) : null,
      detailsOfEvent: record.detailsOfEvent,
    });
    setModalVisible(true);
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // Ensure all required fields are included in payload
      const payload = {
        activityType: values.activityType, // Required
        date: values.date ? values.date.format('YYYY-MM-DD') : null, // Required
        detailsOfEvent: values.detailsOfEvent, // Required
        supId: supId,
        categoryId: 11, // categoryId for community service
      };

      if (editingRecord) {
        // Update existing record - include id in payload
        payload.id = editingRecord.id;
        await API.put(`/SupervisorCategories/${editingRecord.id}`, payload);
        notification().success('Community service updated successfully');
      } else {
        // Create new record
        await API.post('/SupervisorCategories', payload);
        notification().success('Community service added successfully');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error saving community service:', error);
      notification().error('Failed to save community service');
    }
  };

  const handleDelete = async (record) => {
    try {
      await API.delete(`/SupervisorCategories/${record.id}`);
      notification().success('Community service deleted successfully');
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting community service:', error);
      notification().error('Failed to delete community service');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('DD-MM-YYYY');
  };

  const getActivityTypeLabel = (activityType) => {
    switch(activityType) {
      case 'community_service': return 'Community Service';
      case 'exchange_programme': return 'Exchange Programme';
      case 'consulting_activity': return 'Consulting Activity';
      default: return activityType || 'N/A';
    }
  };

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srno',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Activity Type',
      dataIndex: 'activityType',
      key: 'activityType',
      width: 200,
      render: (activityType) => getActivityTypeLabel(activityType),
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div className="space-y-1">
          <div><strong>Date:</strong> {formatDate(record.date)}</div>
          <div><strong>Details:</strong> {record.detailsOfEvent || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this community service?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          onClick={handleBack} 
          icon={<ArrowLeftOutlined />}
          className="mb-4"
        >
          Back to Categories
        </Button>
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 m-0">
            Community Service
          </h2>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAdd}
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
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Add/Edit Modal */}
      <Modal
        title={editingRecord ? 'Edit Community Service' : 'Add New Community Service'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText={editingRecord ? 'Update' : 'Add'}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="activityType"
            label="Activity Type"
            rules={[{ required: true, message: 'Please select activity type' }]}
          >
            <Select placeholder="Select activity type">
              <Option value="community_service">Community Service</Option>
              <Option value="exchange_programme">Exchange Programme</Option>
              <Option value="consulting_activity">Consulting Activity</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: 'Please select date' }]}
          >
            <DatePicker 
              placeholder="Select date"
              format="DD-MM-YYYY"
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            name="detailsOfEvent"
            label="Details"
            rules={[{ required: true, message: 'Please enter details' }]}
          >
            <Input.TextArea 
              placeholder="Enter details of the activity" 
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CommunityService;