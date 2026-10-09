import { Link } from "react-router-dom";
import { useTheme } from "../layout/useTheme";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Award,
  Calendar,
  ShoppingBag,
  UserCheck,
  Coins,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Plane,
} from "lucide-react";

export default function DepartmentDashboardPage() {
  useTheme();

  const workflowModules = [
    {
      title: "Budget Reappropriations",
      count: 0,
      subtitle: "Review and forward PI budget reappropriation requests",
      path: "/projects/reappropriations/queue",
      icon: Coins,
      badgeText: "Stage: With HOD",
    },
    {
      title: "Research Proposal Approvals",
      count: 2,
      subtitle: "Faculty research proposals awaiting cover letter forwarding to R&C",
      path: "/proposals/hod-queue",
      icon: FileText,
      badgeText: "Stage: With HOD",
    },
    {
      title: "Consultancy & Testing Requests",
      count: 2,
      subtitle: "Client requests requiring Principal Investigator (PI) assignment",
      path: "/consultancy-requests",
      icon: Briefcase,
      badgeText: "HOD PI Assignment",
    },
    {
      title: "Fellowship Claim Approvals",
      count: 2,
      subtitle: "Scholar stipend + 20% HRA claims requiring HOD review",
      path: "/fellowship-claims",
      icon: Award,
      badgeText: "Stipend + HRA Verification",
    },
    {
      title: "Leave & PhD NOC Approvals",
      count: 3,
      subtitle: "Annual Leave (30d), Special Leave (15d), and PhD NOC requests",
      path: "/leave-approvals",
      icon: Calendar,
      badgeText: "PI → HOD → Dean",
    },
    {
      title: "Procurement & GeM Indent Approvals",
      count: 2,
      subtitle: "Non-Availability cert verification, official HOD sign & stamp seal",
      path: "/indent-approvals",
      icon: ShoppingBag,
      badgeText: "Official HOD Seal Required",
    },
    {
      title: "Travel Request Approvals",
      count: 2,
      subtitle: "Review and forward faculty and staff travel requests to R&C",
      path: "/travel-approvals",
      icon: Plane,
      badgeText: "HOD Approval Required",
    },
    {
      title: "Recruitment Joining Reports",
      count: 2,
      subtitle: "Recruited staff joining report verification and forwarding to Dean/DR",
      path: "/joining-reports",
      icon: UserCheck,
      badgeText: "Selection Minutes Verified",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-3 sm:px-6 py-5">
      <div className="max-w-[1530px] space-y-6">
        {/* HEADER */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <LayoutDashboard size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Head of Department (HOD) Executive Portal
                </h1>
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Unified Portal
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Department-wide oversight, approval workflows, PI assignments, and financial overhead monitoring
              </p>
            </div>
          </div>

          <Link
            to="/overhead-funds"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md self-start md:self-center"
          >
            <Coins size={18} />
            DDF & Overhead Funds Dashboard
          </Link>
        </div>

        {/* OVERVIEW METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Total Pending HOD Approvals
              </p>
              <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                13 Action Items
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Active Department Projects
              </p>
              <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                18 Projects
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Building2 size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                DDF Balance (20%)
              </p>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                ₹1,65,000
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Coins size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Forwarded This Month
              </p>
              <h3 className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
                24 Approvals
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* WORKFLOW QUEUES GRID */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <AlertCircle className="text-amber-500" size={20} />
            Pending Department Approval Queues
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {workflowModules.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.path}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200">
                        <IconComp size={22} />
                      </div>
                      <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs px-2.5 py-1 rounded-full font-bold">
                        {item.count} Pending
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {item.subtitle}
                      </p>
                    </div>

                    <span className="inline-block text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded font-semibold">
                      {item.badgeText}
                    </span>
                  </div>

                  <Link
                    to={item.path}
                    className="w-full py-2 bg-slate-50 hover:bg-blue-600 hover:text-white dark:bg-slate-700/60 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    Open Approval Queue <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
