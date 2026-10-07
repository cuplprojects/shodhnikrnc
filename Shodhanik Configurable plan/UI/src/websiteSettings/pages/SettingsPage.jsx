import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, User, ChevronDown, LogOut, Grid, List } from 'lucide-react';
import { hasPermission } from '@/services/hasPermissionService';
import HeaderSettings from '../components/HeaderSettings';
import HomeSettings from '../components/HomeSettings';
import AboutusSettings from '../components/AboutusSettings';
import CoOrdinatorsSettings from '../components/CoOrdinatorsSettings';
import PhdSyllabusSettings from '../components/PhdSyllabusSettings';
import NoticeboardSettings from '../components/NoticeboardSettings';
import QueryComplaintSettings from '../components/QueryComplaintSettings';
import ContactSettings from '../components/ContactSettings';
import EmailTemplateSettings from '../components/EmailTemplateSettings';
import ResearchProjects from '../components/ResearchProjects';
import Ordinance from '../components/Ordinance';
import MoUs from '../components/MoUs';
import ResearchCompendium from '../components/ResearchCompendium';
import SciPapers from '../components/Sci-Papers';
import ResearchPolicySettings from '../components/ResearchPolicySettings';
import Sidebar from './Sidebar';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('header');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'tab' or 'grid'
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sections = [
    { id: 'header', label: 'Header Settings', category: 'Core Settings', component: HeaderSettings },
    { id: 'contact', label: 'Contact Info', category: 'Core Settings', component: ContactSettings },
    { id: 'home', label: 'Home Page', category: 'Home Page Content', component: HomeSettings },
    { id: 'aboutus', label: 'About Us', category: 'Home Page Content', component: AboutusSettings },
    { id: 'noticeboard', label: 'Noticeboard', category: 'Home Page Content', component: NoticeboardSettings },
    { id: 'coordinators', label: 'Co-Ordinators', category: 'Management', component: CoOrdinatorsSettings },
    { id: 'emailtemplates', label: 'Email Templates', category: 'Management', component: EmailTemplateSettings },
    { id: 'querycomplaint', label: 'Query & Complaints', category: 'Management', component: QueryComplaintSettings },
    { id: 'phdsyllabus', label: 'PhD Syllabus', category: 'Academic', component: PhdSyllabusSettings },
    { id: 'research', label: 'Research Projects', category: 'Academic', component: ResearchProjects },
    { id: 'compendium', label: 'Research Compendium', category: 'Academic', component: ResearchCompendium },
    { id: 'scipapers', label: 'SCI Papers', category: 'Academic', component: SciPapers },
    { id: 'ordinance', label: 'Ordinances', category: 'Policies & Documents', component: Ordinance },
    { id: 'mous', label: 'MoUs', category: 'Policies & Documents', component: MoUs },
    { id: 'researchpolicy', label: 'Research Policies', category: 'Policies & Documents', component: ResearchPolicySettings }
  ];

  const renderTabContent = () => {
    const activeSection = sections.find(s => s.id === activeTab);
    const Component = activeSection?.component;
    
    return Component ? <Component /> : <HeaderSettings />;
  };

  const renderGridContent = () => {
    // Group sections by category
    const groupedSections = sections.reduce((acc, section) => {
      if (!acc[section.category]) {
        acc[section.category] = [];
      }
      acc[section.category].push(section);
      return acc;
    }, {});

    const categories = ['Core Settings', 'Home Page Content', 'Management', 'Academic', 'Policies & Documents'];

    return (
      <div className="space-y-8">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">
              {category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedSections[category]?.map((section) => {
                const Component = section.component;
                return (
                  <div
                    key={section.id}
                    className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <div className="p-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">{section.label}</h4>
                      <div className="max-h-96 overflow-y-auto border-t pt-4">
                        <Component />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Header Bar */}
      <div className="bg-gray-800 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold">CCSU-Meerut</div>
            
          </div>
          <div className="flex items-center gap-4">
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">Administrator</div>
                  <div className="text-xs text-gray-400">System Admin</div>
                </div>
                <ChevronDown size={16} className={`transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <User size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Administrator</div>
                        <div className="text-sm text-gray-500">admin@ccsuniversity.ac.in</div>
                        <div className="text-xs text-gray-400">System Administrator</div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate('/dor-website');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                    >
                      <Home size={16} />
                      View Website
                    </button>
                    
                    
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 pt-2">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate(-1);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 cursor-pointer"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      

     

      <div className="flex min-h-screen">
        {/* Left Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          navigate={navigate} 
        />

        {/* Main Content Area */}
        <div className="flex-1 bg-gray-50">
          <div className="p-6">
            {/* View Mode Toggle */}
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setViewMode('tab')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'tab'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <List size={18} />
                Tab View
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Grid size={18} />
                Grid View
              </button>
            </div>

            {/* Content Card */}
            {viewMode === 'tab' ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[600px]">
                <div className="p-6">
                  {renderTabContent()}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {renderGridContent()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>Last saved: {new Date().toLocaleString()}</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Auto-save enabled
            </span>
          </div>
          <div>
            Changes are saved automatically
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
