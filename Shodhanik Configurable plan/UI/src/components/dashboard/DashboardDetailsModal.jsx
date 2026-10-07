/**
 * Dashboard Details Modal Component
 * Shows detailed data when a dashboard card is clicked
 */
import React, { useState, useEffect } from 'react';
import { Modal, Table, Spin, Alert, Button, Tag, Space } from 'antd';
import { Download, RefreshCw } from 'lucide-react';
import { getDashboardDetails } from '@/services/officeDashboardService';

const DashboardDetailsModal = ({
  visible,
  onClose,
  cardData = null,
  title = "Details"
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  // Fetch detailed data when modal opens
  useEffect(() => {
    if (visible && cardData) {
      fetchDetails();
    }
  }, [visible, cardData]);

  const fetchDetails = async () => {
    if (!cardData) return;

    try {
      setLoading(true);
      setError(null);

      const params = {
        type: cardData.apiType,
        regType: cardData.regType
      };

      const response = await getDashboardDetails(params);
      
      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error || 'Failed to fetch details');
        setData([]);
      }
    } catch (err) {
      console.error('Details fetch error:', err);
      setError('An unexpected error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Table columns configuration
  const columns = [
    {
      title: 'SID',
      dataIndex: 'SID',
      key: 'sid',
      width: 80,
      render: (text) => <span className="font-mono text-sm">{text}</span>
    },
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'name',
      width: 200,
      render: (text) => <span className="font-medium">{text}</span>
    },
    {
      title: 'Application No',
      dataIndex: 'ApplicationNo',
      key: 'applicationNo',
      width: 120,
      render: (text) => text ? (
        <span className="font-mono text-sm">{text}</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      title: 'Subject',
      dataIndex: 'Subject',
      key: 'subject',
      width: 150,
      render: (text) => text ? (
        <Tag color="blue">{text}</Tag>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      title: 'Phone Number',
      dataIndex: 'PhoneNumber',
      key: 'phoneNumber',
      width: 120,
      render: (text) => text ? (
        <span className="font-mono text-sm">{text}</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    }
  ];

  // Handle export (placeholder for now)
  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export data:', data);
  };

  const modalTitle = cardData ? `${cardData.title} (${cardData.count})` : title;

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="export" icon={<Download size={16} />} onClick={handleExport}>
          Export
        </Button>,
        <Button key="refresh" icon={<RefreshCw size={16} />} onClick={fetchDetails}>
          Refresh
        </Button>,
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
    >
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" tip="Loading details..." />
        </div>
      ) : error ? (
        <Alert
          message="Error Loading Details"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchDetails}>
              Retry
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Info */}
          {cardData && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Category:</span>
                  <span className="ml-2 font-medium">{cardData.title}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Count:</span>
                  <span className="ml-2 font-medium">{cardData.count}</span>
                </div>
                <div>
                  <span className="text-gray-600">Registration Type:</span>
                  <span className="ml-2 font-medium">
                    {cardData.regType ? `Type ${cardData.regType}` : 'All Types'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <Table
            columns={columns}
            dataSource={data}
            rowKey="SID"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} items`
            }}
            scroll={{ x: 800 }}
            size="small"
          />

          {/* No Data Message */}
          {data.length === 0 && !loading && !error && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">No Data Found</div>
              <p className="text-gray-600">
                No records found for the selected criteria.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default DashboardDetailsModal;