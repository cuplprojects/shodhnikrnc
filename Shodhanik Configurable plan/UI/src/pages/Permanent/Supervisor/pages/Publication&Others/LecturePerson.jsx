import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';

const LecturePerson = () => {
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
      // Replace with actual API endpoint for lecture person
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=5`);
      const publications = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(publications);
    } catch (error) {
      console.error('Error fetching lecture person data:', error);
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
      title: 'Type of Event',
      dataIndex: 'detailsOfEvent',
      key: 'detailsOfEvent',
      width: 250,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div>
          <div><strong>Resource Person:</strong> {record.resourcePerson}, <strong>Date:</strong> {record.date}</div>
          <div><strong>Title of Lecture:</strong> {record.titleOflecture}</div>
          <div><strong>Institutions:</strong> {record.institution}</div>
        </div>
      ),
      width: 600,
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
      resourcePerson: record.resourcePerson,
      detailsOfEvent: record.detailsOfEvent,
      titleOflecture: record.titleOflecture,
      date: record.date,
      institution: record.institution,
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
        categoryId: 5, // Lecture Person category ID
        supId: supId || 0,
        // Only send the fields that are actually used in the UI
        resourcePerson: values.resourcePerson,
        detailsOfEvent: values.detailsOfEvent,
        titleOflecture: values.titleOflecture,
        date: values.date,
        institution: values.institution
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
            Invited as Resource Lectures Person / Examiner/Expert
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
            name="resourcePerson"
            label={<span>Resource Person <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the resource person' }]}
          >
            <Input placeholder="Enter resource person" />
          </Form.Item>

          <Form.Item
            name="detailsOfEvent"
            label={<span>Details of Event <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the details of event' }]}
          >
            <Input.TextArea 
              placeholder="Enter details of event" 
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="titleOflecture"
            label={<span>Title of Lecture <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the title of lecture' }]}
          >
            <Input placeholder="Enter title of lecture" />
          </Form.Item>

          <Form.Item
            name="date"
            label={<span>Date <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the date' }]}
          >
            <Input placeholder="Enter date (MM-DD-YYYY)" />
          </Form.Item>

          <Form.Item
            name="institution"
            label={<span>Institution <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the institution' }]}
          >
            <Input placeholder="Enter institution" />
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

export default LecturePerson;