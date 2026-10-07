import { useState } from 'react'
import { Tabs } from 'antd'

// components import
import AllSupConsents from './components/AllSupConsents'
import SupConsentAction from './components/SupConsentAction'

const SupervisorConsent = () => {
  const [activeTab, setActiveTab] = useState('1')
  const [selectedRecord, setSelectedRecord] = useState(null)

  const handleSelectRow = (record) => {
    setSelectedRecord(record)
    setActiveTab('2')
  }

  const handleBackToList = () => {
    setSelectedRecord(null)
    setActiveTab('1')
  }

  const items = [
    {
      key: '1',
      label: 'All Supervisor Consents',
      children: <AllSupConsents onSelectRow={handleSelectRow} />,
    },
    {
      key: '2',
      label: 'Supervisor Consent Action',
      disabled: !selectedRecord,
      children: (
        <SupConsentAction
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

export default SupervisorConsent
