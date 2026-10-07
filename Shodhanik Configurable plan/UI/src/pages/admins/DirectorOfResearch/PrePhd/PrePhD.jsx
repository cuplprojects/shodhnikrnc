import { useState, useEffect } from 'react';
import { Table, Input, Card, Space, Typography, message } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import API from '@/services/API';
import Button from '@/components/ui/Button';
import {hasPermission} from '@/services/hasPermissionService';


const { Title } = Typography;
const { Search } = Input;

const PrePhD = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const candownload = hasPermission('prephd.download');

  // Fetch Pre Ph.D. data
  useEffect(() => {
    fetchPrePhdData();
  }, []);

  const fetchPrePhdData = async () => {
    try {
      setLoading(true);
      const response = await API.get('/Dor/PrePhd');
      
      // Add serial numbers to the data
      const dataWithSerialNumbers = response.data.map((item, index) => ({
        ...item,
        key: index + 1,
        srNo: index + 1,
      }));
      
      setData(dataWithSerialNumbers);
      setFilteredData(dataWithSerialNumbers);
    } catch (error) {
      console.error('Error fetching Pre Ph.D. data:', error);
      notification().error('Failed to load Pre Ph.D. data');
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
    if (!value) {
      setFilteredData(data);
    } else {
      const filtered = data.filter(item =>
        item.year.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredData(filtered);
    }
  };

  // Download Excel
  const downloadExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = filteredData.map(item => ({
        'Sr. No.': item.srNo,
        'Session': item.year,
        'Students': item.count,
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 10 }, // Sr. No.
        { wch: 20 }, // Session
        { wch: 15 }, // Students
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Pre Ph.D. Session wise Students');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Pre_PhD_Session_wise_Students_${currentDate}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      notification().success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      notification().error('Failed to download Excel file');
    }
  };

  // Calculate total students
  const getTotalStudents = () => {
    return filteredData.reduce((total, item) => total + item.count, 0);
  };

  // Table columns configuration
  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.srNo - b.srNo,
    },
    {
      title: 'Session',
      dataIndex: 'year',
      key: 'year',
      width: 200,
      align: 'center',
      sorter: (a, b) => a.year.localeCompare(b.year),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search session"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              module="general"
              label="Search"
              size="sm"
              onClick={() => confirm()}
            />
            <Button
              module="general"
              label="Reset"
              size="sm"
              variant="outline"
              onClick={() => {
                clearFilters();
                confirm();
              }}
            />
          </Space>
        </div>
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value, record) =>
        record.year.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Students',
      dataIndex: 'count',
      key: 'count',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.count - b.count,
      render: (count) => (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          {count}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2} className="!mb-0">
            Pre Ph.D. Session wise Students
          </Title>
          {
            candownload && (
              <Button
            module="general"
            label="Download"
            icon={<DownloadOutlined />}
            onClick={downloadExcel}
            variant="solid"
            className="bg-green-600 hover:bg-green-700 border-green-600"
          />
            )
          }
          
        </div>
        
        {/* Search Bar */}
        <div className="flex justify-between items-center">
          <Search
            placeholder="Search sessions..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            style={{ width: 400 }}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
          />
          <div className="text-gray-600">
            Total Sessions: <span className="font-semibold">{filteredData.length}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {filteredData.length}
          </div>
          <div className="text-gray-600">Total Sessions</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {getTotalStudents()}
          </div>
          <div className="text-gray-600">Total Students</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {filteredData.length > 0 ? Math.round(getTotalStudents() / filteredData.length) : 0}
          </div>
          <div className="text-gray-600">Average per Session</div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} sessions`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 600 }}
          size="middle"
          bordered
          className="prephd-table"
          summary={(pageData) => {
            let totalStudents = 0;
            pageData.forEach(({ count }) => {
              totalStudents += count;
            });

            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} align="center">
                  <strong>Total</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="center">
                  <strong>{pageData.length} Sessions</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="center">
                  <strong className="text-blue-600">{totalStudents} Students</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      {/* Additional Information */}
      <div className="mt-6">
        <Card>
          <div className="text-center">
            <Title level={4} className="!mb-2">
              Session Statistics
            </Title>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-lg font-semibold text-blue-700">
                  Most Recent Session
                </div>
                <div className="text-blue-600">
                  {filteredData.length > 0 
                    ? filteredData.sort((a, b) => b.year.localeCompare(a.year))[0]?.year 
                    : 'N/A'
                  }
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-lg font-semibold text-green-700">
                  Highest Enrollment
                </div>
                <div className="text-green-600">
                  {filteredData.length > 0 
                    ? Math.max(...filteredData.map(item => item.count)) + ' Students'
                    : 'N/A'
                  }
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <style>
        {`
          .prephd-table .ant-table-thead > tr > th {
            background-color: #f8f9fa !important;
            font-weight: 600 !important;
            color: #495057 !important;
          }
          
          .prephd-table .ant-table-tbody > tr:hover > td {
            background-color: #f8f9fa !important;
          }
          
          .prephd-table .ant-pagination {
            margin-top: 16px !important;
          }
          
          .prephd-table .ant-table-summary {
            background-color: #f0f8ff !important;
          }
        `}
      </style>
    </div>
  );
};

export default PrePhD;