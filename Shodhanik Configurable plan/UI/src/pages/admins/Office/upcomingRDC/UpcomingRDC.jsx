import { useState } from 'react'
import { Tabs } from 'antd'
import AllPendingRDC from './components/AllPendingRDC'
import EditPendingRDC from './components/EditPendingRDC'

const UpcomingRDC = () => {
  const [activeTab, setActiveTab] = useState('1')
  const [selectedScholar, setSelectedScholar] = useState(null)

  const handleViewScholar = (scholar) => {
    setSelectedScholar(scholar)
    setActiveTab('2')
  }

  const items = [
    {
      key: '1',
      label: 'All Pending RDC',
      children: <AllPendingRDC onViewScholar={handleViewScholar} />,
    },
    {
      key: '2',
      label: 'Edit RDC',
      children: <EditPendingRDC scholar={selectedScholar} />,
      disabled: !selectedScholar,
    },
  ]

  return (
    <div style={{ padding: '20px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </div>
  )
}

export default UpcomingRDC