import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Row, Col, DatePicker, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import dayjs from 'dayjs';

const UGCPapers = () => {
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
      // Replace with actual API endpoint for UGC papers
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=3`);
      const publications = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(publications);
    } catch (error) {
      console.error('Error fetching UGC papers data:', error);
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
      title: 'Title of Paper',
      dataIndex: 'titleOfPaper',
      key: 'titleOfPaper',
      width: 250,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div>
          <div><strong>Year of Publication:</strong> {record.yearOfPub}, <strong>Name of Journal:</strong> {record.nameOfJournal}</div>
          <div><strong>Author(s):</strong> {record.nameOfAuthor}</div>
          <div><strong>ISSN No.:</strong> {record.issnNo}, <strong>Volume:</strong> {record.volume}, <strong>Page No.:</strong> {record.pageNo}, <a href={record.websiteLink} target="_blank" rel="noopener noreferrer" style={{color: 'blue'}}>Web Link</a></div>
          <div><strong>Citations:</strong> {record.citations}, <strong>Impact Factor:</strong> {record.impactFactor}</div>
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
      titleOfPaper: record.titleOfPaper,
      nameOfJournal: record.nameOfJournal,
      nameOfAuthor: record.nameOfAuthor,
      yearOfPub: record.yearOfPub ? dayjs(record.yearOfPub, 'YYYY') : null,
      issnNo: record.issnNo,
      volume: record.volume,
      pageNo: record.pageNo,
      citations: record.citations,
      impactFactor: record.impactFactor,
      websiteLink: record.websiteLink,
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
        categoryId: 3, // UGC Papers category ID
        supId: supId || 0,
        // Only send the fields that are actually used in the UI
        titleOfPaper: values.titleOfPaper,
        nameOfJournal: values.nameOfJournal,
        nameOfAuthor: values.nameOfAuthor,
        yearOfPub: values.yearOfPub ? values.yearOfPub.format('YYYY') : null,
        issnNo: values.issnNo,
        volume: values.volume,
        pageNo: values.pageNo,
        citations: values.citations || '',
        impactFactor: values.impactFactor || '',
        websiteLink: values.websiteLink || ''
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
            Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals
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
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="titleOfPaper"
            label={<span>Title of Paper <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the title of paper' }]}
          >
            <Input placeholder="Enter title of paper" />
          </Form.Item>

          <Form.Item
            name="nameOfJournal"
            label={<span>Name of Journal <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the name of journal' }]}
          >
            <Input placeholder="Enter name of journal" />
          </Form.Item>

          <Form.Item
            name="nameOfAuthor"
            label={<span>Name of Author(s) <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the name of author(s)' }]}
          >
            <Input placeholder="Enter name of author(s)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="yearOfPub"
                label={<span>Year of Publication <span style={{ color: 'red' }}>*</span></span>}
                rules={[{ required: true, message: 'Please select the year' }]}
              >
                <DatePicker
                  picker="year"
                  style={{ width: '100%' }}
                  placeholder="Select year"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="issnNo"
                label={<span>ISSN No. <span style={{ color: 'red' }}>*</span></span>}
                rules={[{ required: true, message: 'Please enter ISSN number' }]}
              >
                <Input placeholder="ISSN No." />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="volume"
                label={<span>Volume <span style={{ color: 'red' }}>*</span></span>}
                rules={[{ required: true, message: 'Please enter volume' }]}
              >
                <Input placeholder="Volume" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="pageNo"
                label={<span>Page No. <span style={{ color: 'red' }}>*</span></span>}
                rules={[{ required: true, message: 'Please enter page number' }]}
              >
                <Input placeholder="Page No." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="citations"
            label="Citations"
          >
            <Input placeholder="Enter citations" />
          </Form.Item>

          <Form.Item
            name="impactFactor"
            label="Impact Factor"
          >
            <Input placeholder="Enter impact factor" />
          </Form.Item>

          <Form.Item
            name="websiteLink"
            label="Web link of Paper"
          >
            <Input placeholder="Enter web link" />
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

export default UGCPapers;