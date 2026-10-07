import { useNavigate } from 'react-router-dom';
import {
    Home,
    User,
    GraduationCap,
    BookOpen,
    Briefcase,
    Building,
    Award,
    FileText,
    PenTool,
    Users,
    Crown,
    Settings,
    X,
    LogOut
} from 'lucide-react';
// Removed authentication dependencies for guest access

const SupervisorSidebar = ({
    handlePageClick,
    currentPage,
    isSidebarOpen,
    toggleSidebar,
}) => {
    const navigate = useNavigate();

    const pages = [
        { id: 0, label: 'Home', icon: Home, path: 'home', showNumber: false },
        { id: 1, label: 'My Scholars', icon: Users, path: 'my-scholars', showNumber: false },
        { id: 2, label: 'My Profile', icon: User, path: 'my-profile', showNumber: false },
        { id: 3, label: 'Personal Details', icon: User, path: 'personal-details', showNumber: false },
        { id: 4, label: 'Educational Details', icon: GraduationCap, path: 'educational-details', showNumber: false },
        { id: 5, label: 'Experience Details', icon: Briefcase, path: 'experience-details', showNumber: false },
        { id: 6, label: 'Research Details', icon: BookOpen, path: 'research-details', showNumber: false },
        { id: 7, label: 'Awards/Fellowships', icon: Award, path: 'awards-fellowships', showNumber: false },
        { id: 8, label: 'Publications/Others', icon: FileText, path: 'publications-others', showNumber: false },
        { id: 9, label: 'Photograph/Signature', icon: PenTool, path: 'photograph-signature', showNumber: false },
        { id: 10, label: 'Print Profile', icon: FileText, path: 'print-profile', showNumber: false },
        { id: 11, label: 'Seat Availability', icon: Building, path: 'seat-availability', showNumber: false },
        { id: 12, label: 'My Settings', icon: Settings, path: 'my-settings', showNumber: false },
    ];

    const handlePageNavigation = (page) => {
        handlePageClick(page.id);
        navigate(`/supervisor-dashboard/${page.path}`);
    };

    const handleLogout = () => {
        // Simple navigation to home for guest access
        navigate('/');
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm sticky top-6">
                    <div className="p-4 border-b border-[#e5e7eb]">
                        <h2 className="text-lg font-semibold text-[#111827] font-inter">
                            Supervisor Panel
                        </h2>
                        <p className="text-sm text-[#6b7280] mt-1">
                            Welcome, Guest User
                        </p>
                    </div>
                    <div className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {pages.map((page) => {
                            const Icon = page.icon;
                            const isActive = currentPage === page.id;

                            return (
                                <button
                                    key={page.id}
                                    onClick={() => handlePageNavigation(page)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-1 ${
                                        isActive
                                            ? 'bg-[#1e40af] text-white shadow-md'
                                            : 'text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]'
                                    }`}
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                                        isActive
                                            ? 'bg-white/20'
                                            : 'bg-[#f3f4f6]'
                                    }`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium font-inter">{page.label}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Logout Button */}
                    <div className="p-4 border-t border-[#e5e7eb]">
                        <button 
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium font-inter transition-all duration-200"
                        >
                            <LogOut size={16} />
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar - Collapsible */}
            {isSidebarOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={toggleSidebar}
                    ></div>

                    {/* Sidebar Panel */}
                    <div className="lg:hidden fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 overflow-y-auto">
                        <div className="p-4 border-b border-[#e5e7eb] flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-[#111827] font-inter">
                                    Supervisor Panel
                                </h2>
                                <p className="text-sm text-[#6b7280] mt-1">
                                    Welcome, Guest User
                                </p>
                            </div>
                            <button
                                onClick={toggleSidebar}
                                className="p-2 hover:bg-[#f3f4f6] rounded-lg transition-colors"
                            >
                                <X size={20} className="text-[#6b7280]" />
                            </button>
                        </div>
                        <div className="p-2">
                            {pages.map((page) => {
                                const Icon = page.icon;
                                const isActive = currentPage === page.id;

                                return (
                                    <button
                                        key={page.id}
                                        onClick={() => handlePageNavigation(page)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 ${
                                            isActive
                                                ? 'bg-[#1e40af] text-white shadow-md'
                                                : 'text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]'
                                        }`}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                                            isActive
                                                ? 'bg-white/20'
                                                : 'bg-[#f3f4f6]'
                                        }`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-sm font-medium font-inter">{page.label}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Logout Button */}
                        <div className="p-4 border-t border-[#e5e7eb]">
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium font-inter transition-all duration-200"
                            >
                                <LogOut size={16} />
                                Back to Home
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default SupervisorSidebar;