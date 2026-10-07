import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Radio, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';

const MembershipOfAcademicProff = () => {
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
      // Replace with actual API endpoint for membership
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=10`);
      const publications = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(publications);
    } catch (error) {
      console.error('Error fetching membership data:', error);
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
      title: 'Name of Academic/Professional Bodies',
      dataIndex: 'academicName',
      key: 'academicName',
      width: 600,
    },
    {
      title: 'Member Type',
      dataIndex: 'memberType',
      key: 'memberType',
      width: 150,
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
      academicName: record.academicName,
      memberType: record.memberType,
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
        categoryId: 10, // Membership category ID
        supId: supId || 0,
        // Only send the fields that are actually used in the UI
        academicName: values.academicName,
        memberType: values.memberType
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
            Membership of Academic / Professional Bodies
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
            name="academicName"
            label={<span>Name of Academic/Professional Body <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the name of academic/professional body' }]}
          >
            <Input placeholder="Enter name of academic/professional body" />
          </Form.Item>

          <Form.Item
            name="memberType"
            label={<span>Member Type <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please select the member type' }]}
          >
            <Radio.Group>
              <Radio value="Life Member">Life Member</Radio>
              <Radio value="Annual">Annual</Radio>
            </Radio.Group>
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

export default MembershipOfAcademicProff;