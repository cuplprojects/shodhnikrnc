import { useState } from 'react'
import { Tabs } from 'antd'
import AllPendingSynopsis from './components/AllPendingSynopsis'
import EditPendingSynopsis from './components/EditPendingSynopsis'

const ScholarSynopsis = () => {
  const [activeTab, setActiveTab] = useState('1')
  const [selectedTask, setSelectedTask] = useState(null)

  const handleViewScholar = (task) => {
    setSelectedTask(task)
    setActiveTab('2')
  }

  const items = [
    {
      key: '1',
      label: 'All Pending Synopsis',
      children: <AllPendingSynopsis onViewScholar={handleViewScholar} />,
    },
    {
      key: '2',
      label: 'Process Synopsis',
      children: <EditPendingSynopsis task={selectedTask} />,
      disabled: !selectedTask,
    },
  ]

  return (
    <div style={{ padding: '20px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </div>
  )
}

export default ScholarSynopsis