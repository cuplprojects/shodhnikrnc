import { useState } from 'react'
import { Tabs } from 'antd'

import AllCourseWorkScholars from './components/AllCourseWorkScholars'
import CourseWorkDetail from './components/CourseWorkDetail'

const PendingCourseWork = () => {
  const [activeTab, setActiveTab] = useState('1')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [refreshList, setRefreshList] = useState(0)

  const handleSelectRow = (record) => {
    setSelectedRecord(record)
    setActiveTab('2')
  }

  const handleBackToList = () => {
    setSelectedRecord(null)
    setActiveTab('1')
    // Trigger refresh of the list
    setRefreshList(prev => prev + 1)
  }

  const items = [
    {
      key: '1',
      label: 'Pending Course Work',
      children: <AllCourseWorkScholars onSelectRow={handleSelectRow} refreshTrigger={refreshList} />,
    },
    {
      key: '2',
      label: 'Course Work Detail',
      disabled: !selectedRecord,
      children: (
        <CourseWorkDetail
          selectedRecord={selectedRecord}
          onBack={handleBackToList}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: '20px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </div>
  )
}

export default PendingCourseWork
