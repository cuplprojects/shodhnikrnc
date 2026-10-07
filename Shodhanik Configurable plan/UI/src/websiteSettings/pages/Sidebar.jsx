import { Home, Bell, Phone, Layout as HeaderIcon, BookOpen, FileText, Handshake, Book, ChevronRight, GraduationCap, Info, Mail, Users, BookMarked, MessageSquare, ScrollText } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, navigate }) => {
  const tabs = [
    // Core Settings
    { id: 'header', label: 'Header Settings', icon: HeaderIcon, color: 'bg-blue-500', section: 'Core Settings' },
    { id: 'contact', label: 'Contact Info', icon: Phone, color: 'bg-purple-500', section: 'Core Settings' },
    
    // Home Page Content
    { id: 'home', label: 'Home Page', icon: Home, color: 'bg-green-500', section: 'Home Page Content' },
    { id: 'aboutus', label: 'About Us', icon: Info, color: 'bg-cyan-500', section: 'Home Page Content' },
    { id: 'noticeboard', label: 'Noticeboard', icon: Bell, color: 'bg-orange-500', section: 'Home Page Content' },
    
    // Management
    { id: 'coordinators', label: 'Co-Ordinators', icon: Users, color: 'bg-violet-500', section: 'Management' },
    { id: 'emailtemplates', label: 'Email Templates', icon: Mail, color: 'bg-rose-500', section: 'Management' },
    { id: 'querycomplaint', label: 'Query & Complaints', icon: MessageSquare, color: 'bg-yellow-500', section: 'Management' },
    
    // Academic
    { id: 'phdsyllabus', label: 'PhD Syllabus', icon: BookMarked, color: 'bg-emerald-500', section: 'Academic' },
    { id: 'research', label: 'Research Projects', icon: BookOpen, color: 'bg-indigo-500', section: 'Academic' },
    { id: 'compendium', label: 'Research Compendium', icon: Book, color: 'bg-amber-500', section: 'Academic' },
    { id: 'scipapers', label: 'SCI Papers', icon: GraduationCap, color: 'bg-pink-500', section: 'Academic' },
    
    // Policies & Documents
    { id: 'ordinance', label: 'Ordinances', icon: FileText, color: 'bg-red-500', section: 'Policies & Documents' },
    { id: 'mous', label: 'MoUs', icon: Handshake, color: 'bg-teal-500', section: 'Policies & Documents' },
    { id: 'researchpolicy', label: 'Research Policies', icon: ScrollText, color: 'bg-slate-500', section: 'Policies & Documents' }
  ];

  // Group tabs by section
  const groupedTabs = tabs.reduce((acc, tab) => {
    if (!acc[tab.section]) {
      acc[tab.section] = [];
    }
    acc[tab.section].push(tab);
    return acc;
  }, {});

  const sections = ['Core Settings', 'Home Page Content', 'Management', 'Academic', 'Policies & Documents'];

  return (
    <div className="w-64 bg-white border-r border-gray-200 shadow-sm overflow-y-auto max-h-screen">
      <div className="p-4">
        {/* Navigation Menu - Grouped by Section */}
        <nav className="space-y-4">
          {sections.map((section) => (
            <div key={section}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-3 py-2 mb-2">
                {section}
              </h3>
              <div className="space-y-1">
                {groupedTabs[section]?.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium rounded transition-all ${
                        isActive 
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500 shadow-sm' 
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                      }`}
                      title={tab.label}
                    >
                      <div className={`p-1.5 rounded flex-shrink-0 ${isActive ? tab.color : 'bg-gray-300'}`}>
                        <Icon size={14} className="text-white" />
                      </div>
                      <span className="flex-1 truncate">{tab.label}</span>
                      {isActive && <ChevronRight size={14} className="ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Divider */}
        <div className="border-t border-gray-200 my-4"></div>

        {/* Quick Actions */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
            Quick Actions
          </div>
          
          <button
            onClick={() => navigate('/dor-website')}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors cursor-pointer flex items-center gap-2"
          >
            <Home size={14} />
            View Live Website
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Note:</span> Each section requires <span className="font-mono bg-blue-100 px-1 rounded">website_settings.update</span> permission to edit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
