import React, { useState, useEffect } from 'react'
import { Table, Button, Space, Tag } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import API from '../../../../../services/API'
import notification from '../../../../../services/NotificationService'

const AllPendingSynopsis = ({ onViewScholar }) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const notify = notification()

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      const roleId = user?.roleId || 17 // Default to Office if not found
      
      const response = await API.get(`/SynopsisRDC/pending-tasks/${roleId}`)
      if (response.data && Array.isArray(response.data)) {
        setTasks(response.data)
      }
    } catch (error) {
      notify.error('Failed to fetch pending tasks')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = (record) => {
    onViewScholar({
      sid: record.sid,
      instanceId: record.instanceId,
      currentStep: record.currentStepOrder,
      stepName: record.stepName,
      synId: record.synid
    })
  }

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Scholar Name',
      dataIndex: 'scholarName',
      key: 'scholarName',
      sorter: (a, b) => a.scholarName.localeCompare(b.scholarName),
    },
    {
      title: 'Application No',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: 'Current Step',
      dataIndex: 'stepName',
      key: 'stepName',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Submission Date',
      dataIndex: 'submissionDate',
      key: 'submissionDate',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EditOutlined />}
          size="small"
          onClick={() => handleUpdate(record)}
        >
          Process
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pending Workflow Tasks (Office)</h3>
      <Table
        columns={columns}
        dataSource={tasks}
        loading={loading}
        rowKey="instanceId"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} tasks`,
        }}
        scroll={{ x: 1000 }}
      />
    </div>
  )
}

export default AllPendingSynopsis
