import React, { useState, useEffect } from 'react'
import { Table, Button, Select, Space, Card, Tag, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'

const { Option } = Select

const AllPlagCheck = ({
  onSelectRow,
  canRead,
  canCreate,
  canUpdate,
  canDelete,
  canApprove,
  canReject,
  canDownload,
  canUpload }) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [plagCheckFilter, setPlagCheckFilter] = useState('')

  useEffect(() => {
    fetchPlagiarismData()
  }, [])
  useEffect(() => {
    filterData()
  }, [data, plagCheckFilter])
  const fetchPlagiarismData = async () => {
    setLoading(true)
    try {
      const response = await API.get('/Thesis/plagiarism')
      setData(response.data || [])
    } catch (error) {
      console.error('Error fetching plagiarism data:', error)
      notification().error('Failed to fetch plagiarism data')
    } finally {
      setLoading(false)
    }
  }
  const filterData = () => {
    if (!plagCheckFilter) {
      setFilteredData(data)
    } else {
      // Apply filter based on plagCheck status
      const filtered = data.filter(item => {
        // Assuming the API will return plagCheck status in the response
        // For now, we'll use a placeholder logic
        return true // Replace with actual filter logic when API structure is confirmed
      })
      setFilteredData(filtered)
    }
  }
  const handleFilterChange = async (value) => {
    setPlagCheckFilter(value)
    if (value) {
      setLoading(true)
      try {
        const response = await API.get(`/Thesis/plagiarism?plagCheck=${value}`)
        setData(response.data || [])
      } catch (error) {
        console.error('Error fetching filtered data:', error)
        notification().error('Failed to fetch filtered data')
      } finally {
        setLoading(false)
      }
    } else {
      fetchPlagiarismData()
    }
  }
  const getPlagCheckStatus = (status) => {
    switch (status) {
      case 10:
        return <Tag color="orange">Pending</Tag>
      case 1:
        return <Tag color="green">Accepted</Tag>
      case 2:
        return <Tag color="red">Rejected</Tag>
      default:
        return <Tag color="default">Unknown</Tag>
    }
  }

  const getColumns = () => {
    const baseColumns = [
      {
        title: 'S.No.',
        key: 'index',
        width: 70,
        render: (_, __, index) => index + 1,
      },
      //   {
      //     title: 'Scholar ID',
      //     dataIndex: 'sid',
      //     key: 'sid',
      //     width: 100,
      //   },
      {
        title: 'Scholar Name',
        dataIndex: 'scholarName',
        key: 'scholarName',
        width: 200,
      },
      {
        title: 'First Supervisor',
        dataIndex: 'firstSupervisor',
        key: 'firstSupervisor',
        width: 180,
        render: (text) => text || 'N/A',
      },
      // {
      //   title: 'Second Supervisor',
      //   dataIndex: 'secondSupervisor',
      //   key: 'secondSupervisor',
      //   width: 180,
      //   render: (text) => text || 'N/A',
      // },
      // {
      //   title: 'Co-Supervisor',
      //   dataIndex: 'coSupervisor',
      //   key: 'coSupervisor',
      //   width: 180,
      //   render: (text) => text || 'N/A',
      // },
    ]

    // Only show status column when filter is applied
    if (plagCheckFilter) {
      baseColumns.push({
        title: 'Status',
        dataIndex: 'plagCheck',
        key: 'plagCheck',
        width: 120,
        render: (status) => getPlagCheckStatus(status),
      })
    }

    // Actions column
    baseColumns.push({
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {(canApprove || canReject) ?
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onSelectRow(record)}
              title="View Details"
            >
              View
            </Button> : "Permission Denied"
          }
        </Space>
      ),
    })

    return baseColumns
  }

  return (
    <div className="p-0">
      <Card
        title="Thesis Plagiarism Check"
        extra={
          <Space>
            <Select
              placeholder="Select status to filter"
              style={{ width: 200 }}
              allowClear
              onChange={handleFilterChange}
              value={plagCheckFilter}
            >
              <Option value={10}>Pending</Option>
              <Option value={1}>Accepted</Option>
              <Option value={2}>Rejected</Option>
            </Select>
            <Button onClick={fetchPlagiarismData} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={getColumns()}
          dataSource={filteredData}
          loading={loading}
          rowKey="sid"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
          onRow={(record) => ({
            onClick: () => onSelectRow(record),
            style: { cursor: 'pointer' },
          })}
          rowClassName="hover:bg-gray-50"
        />
      </Card>
    </div>
  )
}

export default AllPlagCheck