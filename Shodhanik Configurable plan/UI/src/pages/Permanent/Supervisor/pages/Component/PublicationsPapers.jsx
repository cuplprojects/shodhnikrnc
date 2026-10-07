import { useEffect, useState } from 'react';
import { Table, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';

// Category ID to route mapping
const categoryIdRouteMap = {
  1: 'authored-books-monographs',
  2: 'edited-books',
  3: 'ugc-papers',
  4: 'chapters',
  5: 'lecture-person',
  6: 'seminars',
  7: 'projects',
  8: 'admin-position',
  9: 'conference-ppt',
  10: 'membership-academic-prof',
  11: 'community-service',
  12: 'patent'
};

const PublicationsPapers = () => {
  const [categoriesData, setCategoriesData] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategoriesData();
  }, []);

  // Mock data for testing if API fails
  const mockCategoriesData = [
    { id: 1, categoryName: 'Authored Books & Monographs', count: 5 },
    { id: 2, categoryName: 'Edited Books', count: 3 },
    { id: 3, categoryName: 'Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals', count: 12 },
    { id: 4, categoryName: 'Chapters / Papers Published in Edited Books', count: 8 },
    { id: 5, categoryName: 'Invited as Resource Lectures Person / Examiner/Expert', count: 6 },
    { id: 6, categoryName: 'Seminars / Conferences / Workshops Organized', count: 4 },
    { id: 7, categoryName: 'Projects', count: 2 },
    { id: 8, categoryName: 'Administrative Positions / Assignments Held', count: 3 },
    { id: 9, categoryName: 'Conference Papers / Presentations', count: 1 },
    { id: 10, categoryName: 'Membership of Academic / Professional Bodies', count: 2 },
    { id: 11, categoryName: 'Community Service', count: 1 },
    { id: 12, categoryName: 'Patent', count: 0 },
  ];

  const fetchCategoriesData = async () => {
    setCategoriesLoading(true);
    try {
      const response = await API.get(`SupervisorCategories/ByCount?supid=${supId || 1}`);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      
      console.log('API Response data:', data);
      
      // If no data from API, use mock data for testing
      if (data.length === 0) {
        setCategoriesData(mockCategoriesData);
      } else {
        // Ensure each item has an id field, if not, add one based on index or other field
        const processedData = data.map((item, index) => ({
          ...item,
          id: item.id || item.categoryId || index + 1, // Fallback ID generation
        }));
        console.log('Processed data:', processedData);
        setCategoriesData(processedData);
      }
    } catch (error) {
      console.error('Error fetching categories data:', error);
      setCategoriesData(mockCategoriesData);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleViewCategory = (record) => {
    console.log("Full record:", record);
    
    // Try to get ID from different possible fields
    const categoryId = record.id || record.categoryId || record.categoryTypeId;
    console.log("category ID:", categoryId);
    
    const route = categoryIdRouteMap[categoryId];
    console.log("mapped route:", route);
    
    if (route) {
      navigate(`/supervisor-dashboard/publications/${route}`);
    } else {
      console.warn('No route found for category ID:', categoryId);
      console.warn('Available routes:', categoryIdRouteMap);
    }
  };

  const categoriesColumns = [
    {
      title: 'S.No',
      key: 'srno',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Categories',
      dataIndex: 'categoryName',
      key: 'categoryName',
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => handleViewCategory(record)}
        >
          View
        </Button>
      ),
    },
  ];



  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Publications & Papers</h1>
        <p className="text-gray-600">Manage your publications and research papers</p>
      </div>

      <Table
        columns={categoriesColumns}
        dataSource={categoriesData}
        rowKey={(record) => record.id || record.categoryId || record.categoryName}
        loading={categoriesLoading}
        pagination={false}
      />
    </div>
  );
};

export default PublicationsPapers;
