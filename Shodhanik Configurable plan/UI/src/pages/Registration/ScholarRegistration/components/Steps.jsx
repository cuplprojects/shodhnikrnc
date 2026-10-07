import { useNavigate } from 'react-router-dom';
import {
    Home,
    User,
    GraduationCap,
    Upload,
    Eye,
    CreditCard,
    FileCheck,
    CheckCircle,
    X,
    Lock
} from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import { confirm } from '@/services/ConfirmationService';
import notification from '@/services/NotificationService';
import useStepStore from './stepStore';

const Steps = ({
    handleStepClick,
    currentStep,
    isSidebarOpen,
    toggleSidebar
}) => { 
    const navigate = useNavigate();
    const { logout, user } = useScholarRegAuthStore();
    const { isStepCompleted, clearSteps } = useStepStore();

    const steps = [
        { id: 0, label: 'Home', icon: Home, path: 'home', showNumber: false },
        { id: 1, label: 'Personal Details', icon: User, path: 'personal-info', showNumber: true },
        { id: 2, label: 'Educational Details', icon: GraduationCap, path: 'educational-details', showNumber: true },
        { id: 3, label: 'Upload Documents', icon: Upload, path: 'upload-documents', showNumber: true },
        { id: 4, label: 'Preview Application', icon: Eye, path: 'preview', showNumber: true },
        { id: 5, label: 'Payment', icon: CreditCard, path: 'payment', showNumber: true },
        { id: 6, label: 'Print Final Application', icon: FileCheck, path: 'print', showNumber: true },
        { id: 7, label: 'Status of Application', icon: CheckCircle, path: 'status', showNumber: true },
        { id: 8, label: 'Fee Submission', icon: CreditCard, path: 'fee-submission', showNumber: true },
        { id: 9, label: 'Admission Details', icon: CheckCircle, path: 'admission-details', showNumber: true },
        // { id: 8, label: 'Interview Remark', icon: CheckCircle, path: 'interview-remark', showNumber: true },
        // { id: 9, label: 'Upload Documents (Counselling)', icon: CheckCircle, path: 'upload-documents-counselling', showNumber: true },
        //{ id: 10, label: 'Counselling Fee', icon: CheckCircle, path: 'counselling-fee', showNumber: true },
    ];

    // Check if user can access a step
    const canAccessStep = (stepNumber) => {
        // Step 0 (Home) is always accessible
        if (stepNumber === 0) return true;
        // Step 1 is always accessible
        if (stepNumber === 1) return true;
        // For steps 6 and 7, step 5 must be completed
        if (stepNumber === 6 || stepNumber === 7) {
            return isStepCompleted(5);
        }
        // For step 8, step 7 must be completed
        if (stepNumber === 8) {
            return isStepCompleted(7);
        }
        // For step 9, step 8 must be completed
        if (stepNumber === 9) {
            return isStepCompleted(8);
        }
        // For steps 2-5, previous step must be completed
        return isStepCompleted(stepNumber - 1);
    };

    const handleStepNavigation = (step) => {
        // Only navigate if step is accessible
        if (canAccessStep(step.id)) {
            handleStepClick(step.id);
            navigate(`/register-scholar/${step.path}`);
        }
    };

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: "Confirm Logout",
            message: "Are you sure you want to log out of your scholar account?",
        });

        if (confirmed) {
            notification().success("Logged out successfully");
            clearSteps();
            logout();
            navigate('/register-scholar/login');
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
                            const isAccessible = canAccessStep(step.id);

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => handleStepNavigation(step)}
                                    disabled={!isAccessible}
                                    title={!isAccessible ? (step.id === 6 || step.id === 7 ? 'Complete step 5 (Payment) first' : step.id === 8 ? 'Complete step 7 (Status) first' : step.id === 9 ? 'Complete step 8 (Fee Submission) first' : `Complete step ${step.id - 1} first`) : ''}
                                    className={`w-full flex items-center gap-3 px-3 py-1 rounded-lg transition-all duration-200 mb-1 ${
                                        !isAccessible
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                            : isActive
                                                ? 'bg-[#1e40af] text-white shadow-md'
                                                : isCompleted
                                                    ? 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]'
                                                    : 'text-[#6b7280] hover:bg-[#f3f4f6]'
                                        }`}
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                                        !isAccessible
                                            ? 'bg-gray-200'
                                            : isActive
                                                ? 'bg-white/20'
                                                : isCompleted
                                                    ? 'bg-[#1e40af]/10'
                                                    : 'bg-[#f3f4f6]'
                                        }`}>
                                        {!isAccessible ? (
                                            <Lock size={16} className="text-gray-400" />
                                        ) : isCompleted ? (
                                            <CheckCircle size={18} className="text-[#10b981]" />
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
                            {/* ({user?.studentId || 'Scholar'}) */}
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
                                const isAccessible = canAccessStep(step.id);

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => handleStepNavigation(step)}
                                        disabled={!isAccessible}
                                        title={!isAccessible ? (step.id === 6 || step.id === 7 ? 'Complete step 5 (Payment) first' : step.id === 8 ? 'Complete step 7 (Status) first' : step.id === 9 ? 'Complete step 8 (Fee Submission) first' : `Complete step ${step.id - 1} first`) : ''}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 ${
                                            !isAccessible
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                                : isActive
                                                    ? 'bg-[#1e40af] text-white shadow-md'
                                                    : isCompleted
                                                        ? 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]'
                                                        : 'text-[#6b7280] hover:bg-[#f3f4f6]'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                                            !isAccessible
                                                ? 'bg-gray-200'
                                                : isActive
                                                    ? 'bg-white/20'
                                                    : isCompleted
                                                        ? 'bg-[#1e40af]/10'
                                                        : 'bg-[#f3f4f6]'
                                            }`}>
                                            {!isAccessible ? (
                                                <Lock size={16} className="text-gray-400" />
                                            ) : isCompleted ? (
                                                <CheckCircle size={18} className="text-[#10b981]" />
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
                                {/*({user?.studentId || 'Scholar'})*/}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}

export default Steps