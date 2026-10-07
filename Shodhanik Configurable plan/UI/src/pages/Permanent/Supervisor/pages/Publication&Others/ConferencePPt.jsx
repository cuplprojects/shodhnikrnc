import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Table, Modal, Form, Input, DatePicker, Select, message, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';
import dayjs from 'dayjs';

const { Option } = Select;

const ConferencePPt = () => {
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
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=9`);
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching seminars/conferences:', error);
      notification().error('Failed to load seminars/conferences');
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
      category: record.category,
      date: record.date ? dayjs(record.date) : null,
      title: record.title,
      institution: record.institution,
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
      
      const payload = {
        ...values,
        date: values.date ? values.date.format('YYYY-MM-DD') : null,
        supId: supId,
        categoryId: 9, // categoryId for seminars/conferences
      };

      if (editingRecord) {
        // Update existing record - include id in payload
        payload.id = editingRecord.id;
        await API.put(`/SupervisorCategories/${editingRecord.id}`, payload);
        notification().success('Seminar/Conference updated successfully');
      } else {
        // Create new record
        await API.post('/SupervisorCategories', payload);
        notification().success('Seminar/Conference added successfully');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error saving seminar/conference:', error);
      notification().error('Failed to save seminar/conference');
    }
  };

  const handleDelete = async (record) => {
    try {
      await API.delete(`/SupervisorCategories/${record.id}`);
      notification().success('Seminar/Conference deleted successfully');
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting seminar/conference:', error);
      notification().error('Failed to delete seminar/conference');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('DD-MM-YYYY');
  };

  const getCategoryLabel = (category) => {
    switch(category) {
      case 'state': return 'State';
      case 'national': return 'National';
      case 'international': return 'International';
      default: return category || 'N/A';
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
      title: 'Title / Topic',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div className="space-y-1">
          <div><strong>Date:</strong> {formatDate(record.date)}</div>
          <div><strong>Category:</strong> {getCategoryLabel(record.category)}</div>
          <div><strong>Institution:</strong> {record.institution || 'N/A'}</div>
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
            title="Are you sure you want to delete this seminar/conference?"
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
            Seminars & Conferences
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
        title={editingRecord ? 'Edit Seminar/Conference' : 'Add New Seminar/Conference'}
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
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select category">
              <Option value="state">State</Option>
              <Option value="national">National</Option>
              <Option value="international">International</Option>
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
            name="title"
            label="Title / Topic"
            rules={[{ required: true, message: 'Please enter title/topic' }]}
          >
            <Input placeholder="Enter title or topic" />
          </Form.Item>

          <Form.Item
            name="institution"
            label="Institution"
            rules={[{ required: true, message: 'Please enter institution' }]}
          >
            <Input placeholder="Enter institution name" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConferencePPt;