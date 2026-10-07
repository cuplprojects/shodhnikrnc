import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    Home,
    User,
    GraduationCap,
    Upload,
    Eye,
    CreditCard,
    FileCheck,
    CheckCircle,
    X
} from 'lucide-react';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import { confirm } from '@/services/ConfirmationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import notification from '@/services/NotificationService';
import useStepsSupStore from './stepStore';
import API from '@/services/API';

const Steps = ({
    handleStepClick,
    currentStep,
    isSidebarOpen,
    toggleSidebar,
}) => {
    const navigate = useNavigate();
    const { logout, user, getSupId } = useSupervisorRegAuthStore();
    const { isStepCompleted, isStepAccessible, isStepReadOnly, clearSteps, checkScreeningStatus } = useStepsSupStore();
    const [supervisorData, setSupervisorData] = useState(null);
    const supId = getSupId();

    useEffect(() => {
        const fetchSupervisorData = async () => {
            try {
                if (supId) {
                    // Fetch supervisor registration data
                    const response = await API.get(`/SupervisorRegistration/${supId}`);
                    
                    // Fetch screening status
                    const screeningResult = await checkScreeningStatus(supId);
                    
                    // Combine both data sources
                    setSupervisorData({
                        ...response.data,
                        hasRejectedScreening: screeningResult?.hasRejectedScreening || false,
                        screeningData: screeningResult?.screeningData || null
                    });
                }
            } catch (error) {
                console.log('Error fetching supervisor data:', error);
                // Set fallback data if API fails
                setSupervisorData({ supId, hasRejectedScreening: false });
            }
        };
        fetchSupervisorData();
    }, [supId, checkScreeningStatus]);

    const steps = [
        { id: 0, label: 'Home', icon: Home, path: 'home', showNumber: false },
        { id: 1, label: 'Personal Details', icon: User, path: 'personal-info', showNumber: true },
        { id: 2, label: 'Educational Details', icon: GraduationCap, path: 'educational-details', showNumber: true },
        { id: 3, label: 'Experience Details', icon: GraduationCap, path: 'experience-details', showNumber: true },
        { id: 4, label: 'Research Papers', icon: GraduationCap, path: 'research-paper', showNumber: true },
        { id: 5, label: 'Upload Documents', icon: Upload, path: 'upload-documents', showNumber: true },
        { id: 6, label: 'Preview Application', icon: Eye, path: 'preview', showNumber: true },
        { id: 7, label: 'Payment', icon: CreditCard, path: 'payment', showNumber: true },
        { id: 8, label: 'Print Final Application', icon: FileCheck, path: 'print', showNumber: true },
        { id: 9, label: 'Status of Application', icon: CheckCircle, path: 'status', showNumber: true },
    ];

    const handleStepNavigation = (step) => {
        // Check if step is accessible
        if (!isStepAccessible(step.id)) {
            notification().warning(`Please complete previous steps before accessing ${step.label}`);
            return;
        }

        // Check if step is read-only
        if (isStepReadOnly(step.id, supervisorData)) {
            notification().info(`${step.label} is now in read-only mode`);
        }

        handleStepClick(step.id);
        // Prepend the base path for registration
        navigate(`/register-supervisor/${step.path}`);
    };

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: "Confirm Logout",
            message: "Are you sure you want to log out of your supervisor account?",
        });

        if (confirmed) {
            notification().success("Logged out successfully");
            clearSteps();
            logout();
            navigate('/register-supervisor/login');
        }
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm sticky top-6">
                    <div className="p-2 border-b border-[#e5e7eb]">
                        <h2 className="text-lg font-semibold text-[#111827] font-inter">
                            Application Steps
                        </h2>
                    </div>
                    <div className="p-2">
                        {steps.map((step) => {
                            const Icon = step.icon;
                            const isActive = currentStep === step.id;
                            const isCompleted = isStepCompleted(step.id);
                            const isAccessible = isStepAccessible(step.id);
                            const isReadOnly = isStepReadOnly(step.id, supervisorData);

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => handleStepNavigation(step)}
                                    disabled={!isAccessible}
                                    className={`w-full flex items-center gap-3 px-3 py-1 rounded-lg transition-all duration-200 mb-1 ${!isAccessible
                                            ? 'text-[#9ca3af] bg-[#f9fafb] cursor-not-allowed opacity-50'
                                            : isActive
                                                ? 'bg-[#1e40af] text-white shadow-md'
                                                : isCompleted
                                                    ? isReadOnly
                                                        ? 'bg-[#fef3c7] text-[#d97706] hover:bg-[#fde68a] border border-[#f59e0b]/20'
                                                        : 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]'
                                                    : 'text-[#6b7280] hover:bg-[#f3f4f6]'
                                        }`}
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${!isAccessible
                                            ? 'bg-[#f3f4f6]'
                                            : isActive
                                                ? 'bg-white/20'
                                                : isCompleted
                                                    ? isReadOnly
                                                        ? 'bg-[#d97706]/10'
                                                        : 'bg-[#1e40af]/10'
                                                    : 'bg-[#f3f4f6]'
                                        }`}>
                                        {isCompleted ? (
                                            isReadOnly ? (
                                                <CheckCircle size={18} className="text-[#d97706]" />
                                            ) : (
                                                <CheckCircle size={18} className="text-[#10b981]" />
                                            )
                                        ) : step.showNumber ? (
                                            <span className="text-sm font-semibold font-inter">{step.id}</span>
                                        ) : (
                                            <Icon size={18} />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium font-inter">{step.label}</p>
                                    </div>
                                    <Icon size={18} className="flex-shrink-0" />
                                </button>
                            );
                        })}
                    </div>

                    {/* Logout Button */}
                    <div className="p-4 border-t border-[#e5e7eb]">
                        <button
                            onClick={handleLogout}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium font-inter transition-all duration-200"
                        >
                            Logout
                             {/* ({user?.employeeId || 'Supervisor'}) */}
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
                            <h2 className="text-lg font-semibold text-[#111827] font-inter">
                                Application Steps
                            </h2>
                            <button
                                onClick={toggleSidebar}
                                className="p-2 hover:bg-[#f3f4f6] rounded-lg transition-colors"
                            >
                                <X size={20} className="text-[#6b7280]" />
                            </button>
                        </div>
                        <div className="p-2">
                            {steps.map((step) => {
                                const Icon = step.icon;
                                const isActive = currentStep === step.id;
                                const isCompleted = isStepCompleted(step.id);
                                const isAccessible = isStepAccessible(step.id);
                                const isReadOnly = isStepReadOnly(step.id, supervisorData);

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => handleStepNavigation(step)}
                                        disabled={!isAccessible}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 ${!isAccessible
                                                ? 'text-[#9ca3af] bg-[#f9fafb] cursor-not-allowed opacity-50'
                                                : isActive
                                                    ? 'bg-[#1e40af] text-white shadow-md'
                                                    : isCompleted
                                                        ? isReadOnly
                                                            ? 'bg-[#fef3c7] text-[#d97706] hover:bg-[#fde68a] border border-[#f59e0b]/20'
                                                            : 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]'
                                                        : 'text-[#6b7280] hover:bg-[#f3f4f6]'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${!isAccessible
                                                ? 'bg-[#f3f4f6]'
                                                : isActive
                                                    ? 'bg-white/20'
                                                    : isCompleted
                                                        ? isReadOnly
                                                            ? 'bg-[#d97706]/10'
                                                            : 'bg-[#1e40af]/10'
                                                        : 'bg-[#f3f4f6]'
                                            }`}>
                                            {isCompleted ? (
                                                isReadOnly ? (
                                                    <CheckCircle size={18} className="text-[#d97706]" />
                                                ) : (
                                                    <CheckCircle size={18} className="text-[#10b981]" />
                                                )
                                            ) : step.showNumber ? (
                                                <span className="text-sm font-semibold font-inter">{step.id}</span>
                                            ) : (
                                                <Icon size={18} />
                                            )}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-sm font-medium font-inter">{step.label}</p>
                                        </div>
                                        <Icon size={18} className="flex-shrink-0" />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Logout Button */}
                        <div className="p-4 border-t border-[#e5e7eb]">
                            <button
                                onClick={handleLogout}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium font-inter transition-all duration-200"
                            >
                                Logout ({user?.employeeId || 'Supervisor'})
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}

export default Steps