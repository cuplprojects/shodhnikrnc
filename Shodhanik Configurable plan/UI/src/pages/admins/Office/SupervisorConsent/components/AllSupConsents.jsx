import { useState, useEffect } from 'react'
import { Table, Button, Empty, Spin } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import { hasPermission } from '@/services/hasPermissionService';
import { formatDateTime, parseUtcDate } from '@/utils/dateUtils'


const AllSupConsents = ({ onSelectRow }) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState([])
  const canread = hasPermission('supervisor_consent.read')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await API.get('ScholarSupervisor/Pending')
      setData(response.data || [])
      setFilteredData(response.data || [])
    } catch (error) {
      // notification().error('Failed to load supervisor consents')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase()
    setSearchText(value)

    if (!value) {
      setFilteredData(data)
      return
    }

    const filtered = data.filter(record => {
      const reqDate = formatDateTime(record.requestedAt)
      const secondReqDate = formatDateTime(record.secondRequestAt)
      return (
        Object.values(record).some(val =>
          val && val.toString().toLowerCase().includes(value)
        ) ||
        reqDate.toLowerCase().includes(value) ||
        secondReqDate.toLowerCase().includes(value)
      )
    })
    setFilteredData(filtered)
  }

  const highlightText = (text, query) => {
    if (!query || !text) return text
    const parts = text.toString().split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} style={{ backgroundColor: '#ffc069' }}>{part}</mark>
      ) : (
        part
      )
    )
  }

  const columns = [
    {
      title: 'Scholar ID',
      dataIndex: 'sid',
      key: 'sid',
      width: 100,
      sorter: (a, b) => a.sid - b.sid,
      render: (text) => highlightText(text, searchText),
    },
    {
      title: 'Scholar Name',
      dataIndex: 'scholarName',
      key: 'scholarName',
      width: 150,
      sorter: (a, b) => a.scholarName.localeCompare(b.scholarName),
      render: (text) => highlightText(text, searchText),
    },
    // {
    //   title: 'Supervisor 1 ID',
    //   dataIndex: 'supervisor1Id',
    //   key: 'supervisor1Id',
    //   width: 120,
    //   sorter: (a, b) => (a.supervisor1Id || 0) - (b.supervisor1Id || 0),
    //   render: (text) => text ? highlightText(text, searchText) : '-',
    // },
    // {
    //   title: 'Supervisor 1 Name',
    //   dataIndex: 'supervisor1Name',
    //   key: 'supervisor1Name',
    //   width: 150,
    //   sorter: (a, b) => (a.supervisor1Name || '').localeCompare(b.supervisor1Name || ''),
    //   render: (text) => text ? highlightText(text, searchText) : '-',
    // },
    // {
    //   title: 'Supervisor 2 ID',
    //   dataIndex: 'supervisor2Id',
    //   key: 'supervisor2Id',
    //   width: 120,
    //   sorter: (a, b) => (a.supervisor2Id || 0) - (b.supervisor2Id || 0),
    //   render: (text) => text ? highlightText(text, searchText) : '-',
    // },
    // {
    //   title: 'Supervisor 2 Name',
    //   dataIndex: 'supervisor2Name',
    //   key: 'supervisor2Name',
    //   width: 150,
    //   sorter: (a, b) => (a.supervisor2Name || '').localeCompare(b.supervisor2Name || ''),
    //   render: (text) => text ? highlightText(text, searchText) : '-',
    // },
    // {
    //   title: 'Co-Supervisor ID',
    //   dataIndex: 'coSupervisorId',
    //   key: 'coSupervisorId',
    //   width: 120,
    //   sorter: (a, b) => (a.coSupervisorId || 0) - (b.coSupervisorId || 0),
    //   render: (text) => text ? highlightText(text, searchText) : '-',
    // },
    // {
    //   title: 'Co-Supervisor Name',
    //   dataIndex: 'coSupervisorName',
    //   key: 'coSupervisorName',
    //   width: 150,
    //   sorter: (a, b) => (a.coSupervisorName || '').localeCompare(b.coSupervisorName || ''),
    //   render: (text) => text ? highlightText(text, searchText) : '-',
    // },
    {
      title: 'Requested At',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      width: 200,
      sorter: (a, b) => (parseUtcDate(a.requestedAt)?.getTime() || 0) - (parseUtcDate(b.requestedAt)?.getTime() || 0),
      render: (text) => text ? highlightText(formatDateTime(text), searchText) : '-',
    },
    {
      title: 'Second Request At',
      dataIndex: 'secondRequestAt',
      key: 'secondRequestAt',
      width: 200,
      sorter: (a, b) => (parseUtcDate(a.secondRequestAt)?.getTime() || 0) - (parseUtcDate(b.secondRequestAt)?.getTime() || 0),
      render: (text) => text ? highlightText(formatDateTime(text), searchText) : '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        canread && (
          <Button
          type="primary"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => onSelectRow?.(record)}
        >
          View
        </Button>
        )
        
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search in table..."
          value={searchText}
          onChange={handleSearch}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #d9d9d9',
            width: '300px',
          }}
        />
      </div>

      <Spin spinning={loading}>
        {filteredData.length === 0 && !loading ? (
          <Empty description="No supervisor consents found" />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey={(record) => `${record.sid}-${record.requestedAt}`}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20', '50'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            }}
            scroll={{ x: 1500 }}
            bordered
          />
        )}
      </Spin>
    </div>
  )
}

export default AllSupConsents