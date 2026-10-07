import { useEffect, useState } from 'react'
import { Tabs } from 'antd'

//tab imports
import AllRDCProceedings from './components/AllRDCProceedings'
import EditRDCProceedings from './components/EditRDCProceedings'

const RDCProceedings = () => {

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
            label: 'All RDC Proceedings',
            children: <AllRDCProceedings onSelectRow={handleSelectRow} />,
        },
        {
            key: '2',
            label: 'Edit RDC Proceedings',
            disabled: !selectedRecord,
            children: (
                <EditRDCProceedings
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

export default RDCProceedings