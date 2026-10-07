import { useState } from 'react'
import { Tabs } from 'antd'

//tab imports
import AllVivaApprovals from './components/AllVivaApprovals'
import EditVivaapprovals from './components/EditVivaapprovals'

const VivalApprovals = () => {
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
            label: 'All Viva Approvals',
            children: <AllVivaApprovals onSelectRow={handleSelectRow} />,
        },
        {
            key: '2',
            label: 'Edit Viva Approvals',
            disabled: !selectedRecord,
            children: (
                <EditVivaapprovals
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

export default VivalApprovals