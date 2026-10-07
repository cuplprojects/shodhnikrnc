import { useState, useEffect } from 'react';
import { Table, Button, Card, message, Tag, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import API from '@/services/API'
import notification from '@/services/NotificationService';

const AllVivaApprovals = ({ onSelectRow }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const notify = notification();
  
  // Fetch data from API
  const fetchThesisSubmittedData = async () => {
    setLoading(true);
    try {
      const response = await API.get('/AwardExaminee/GetScholarsForLevel5');
      setData(response.data && response.data.length > 0 ? response.data : []);
    } catch (error) {
      console.error('Error fetching thesis submitted data:', error);
      // notify.error('Failed to fetch viva records');
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
      4: { color: 'red', text: 'Rejected' },
      5: { color: 'purple', text: 'Awaiting Decision' }
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
    {
      title: 'Scholar Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Application No',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 130,
    },
    {
      title: 'Academic Year',
      dataIndex: 'year',
      key: 'year',
      width: 120,
    },
    {
      title: 'Decision Status',
      dataIndex: 'decisionStatus',
      key: 'decisionStatus',
      width: 100,
      align: 'center',
      render: (status) => "Pending",
    },
    {
      title: 'Interview Date',
      dataIndex: 'interviewDate',
      key: 'interviewDate',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleDateString('en-IN') : '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => handleViewApprovals(record)}
          size="small"
        >
          View Details
        </Button>
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
          locale={{ emptyText: 'No viva records available' }}
        />
    </div>
  );
};

export default AllVivaApprovals;