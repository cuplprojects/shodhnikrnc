import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Row, Col, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';

const AdminPosition = () => {
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
      // Replace with actual API endpoint for admin positions
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=8`);
      const publications = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(publications);
    } catch (error) {
      console.error('Error fetching admin position data:', error);
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
      title: 'Post / Assignment',
      dataIndex: 'post',
      key: 'post',
      width: 250,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div>
          <div><strong>Duration:</strong> {record.from} to {record.to}</div>
          <div><strong>Organization:</strong> {record.organization}</div>
        </div>
      ),
      width: 500,
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
      post: record.post,
      organization: record.organization,
      from: record.from,
      to: record.to,
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
        categoryId: 8, // Admin Position category ID
        supId: supId || 0,
        // Only send the fields that are actually used in the UI
        post: values.post,
        organization: values.organization,
        from: values.from,
        to: values.to
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
            Administrative Positions / Assignments Held
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
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="post"
            label={<span>Post <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the post' }]}
          >
            <Input placeholder="Enter post/assignment" />
          </Form.Item>

          <Form.Item
            name="organization"
            label={<span>Organization <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the organization' }]}
          >
            <Input placeholder="Enter organization" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="from"
                label={<span>From <span style={{ color: 'red' }}>*</span></span>}
                rules={[{ required: true, message: 'Please enter the from date' }]}
              >
                <Input placeholder="Enter from date (MM-DD-YYYY)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="to"
                label={<span>To <span style={{ color: 'red' }}>*</span></span>}
                rules={[{ required: true, message: 'Please enter the to date' }]}
              >
                <Input placeholder="Enter to date (MM-DD-YYYY)" />
              </Form.Item>
            </Col>
          </Row>

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

export default AdminPosition;