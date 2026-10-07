import { useState, useEffect } from 'react';
import { Table, Button, message, Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import API from '@/services/API'
import notification from '@/services/NotificationService';
import {hasPermission} from '@/services/hasPermissionService';


const AllVivaApprovals = ({ onSelectRow }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const notify = notification();
  const canread = hasPermission('viva_approval.read')
  
  // Fetch data from API
  const fetchThesisSubmittedData = async () => {
    setLoading(true);
    try {
      const response = await API.get('/Viva/ThesisSubmitted');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching thesis submitted data:', error);
      notify.error('Failed to fetch thesis submitted data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThesisSubmittedData();
  }, []);

  // Handle switching to Edit tab
  const handleViewApprovals = (record) => {
    onSelectRow(record);
  };

  // Status mapping for better display
  const getStatusTag = (status) => {
    const statusMap = {
      1: { color: 'orange', text: 'Pending' },
      2: { color: 'blue', text: 'In Review' },
      3: { color: 'green', text: 'Approved' },
      4: { color: 'red', text: 'Rejected' }
    };
    
    const statusInfo = statusMap[status] || { color: 'default', text: 'Unknown' };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  // Table columns configuration
  const columns = [
    {
      title: 'S.No.',
      dataIndex: 'sid',
      key: 'sid',
      width: 80,
      align: 'center',
    },
    // {
    //   title: 'Perm User Name',
    //   dataIndex: 'permUserName',
    //   key: 'permUserName',
    //   width: 150,
    // },
    {
      title: 'Scholar Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Subject',
      dataIndex: 'subjectName',
      key: 'subjectName',
      width: 250,
    },
    // {
    //   title: 'Email',
    //   dataIndex: 'email',
    //   key: 'email',
    //   width: 200,
    // },
    // {
    //   title: 'Phone',
    //   dataIndex: 'phoneNumber',
    //   key: 'phoneNumber',
    //   width: 130,
    // },
    {
      title: 'Academic Year',
      dataIndex: 'year',
      key: 'year',
      width: 120,
    },
    {
      title: 'Thesis Title',
      dataIndex: 'thesis_Title',
      key: 'thesis_Title',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      width: 150,
      render: (date) => new Date(date).toLocaleDateString('en-IN'),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        canread && (
          <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => handleViewApprovals(record)}
          size="small"
        >
          View Details
        </Button>
        )
        
      ),
    },
  ];

  return (
    <div style={{ padding: '0px' }}>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="sid"
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
          size="middle"
        />
    </div>
  );
};

export default AllVivaApprovals;