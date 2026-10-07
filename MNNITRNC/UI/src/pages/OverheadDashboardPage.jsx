import { useState } from "react";
import { useTheme } from "../layout/useTheme";
import { useAuth } from "../auth/useAuth";
import {
  Coins,
  Building2,
  Users,
  Search,
  Download,
  PieChart,
  History,
  ShieldAlert,
} from "lucide-react";

export default function OverheadDashboardPage() {
  useTheme();
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  
  const isOffice = userRoles.some(r => ['Dean', 'DeputyRegistrar', 'Superintendent', 'RegularStaff', 'SuperAdmin'].includes(r));
  const isHOD = userRoles.includes('HOD');
  const isPI = !isOffice && !isHOD; // PI view

  const [activeTab, setActiveTab] = useState(isPI ? "PDF" : "DDF");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const ddfTransactions = [
    {
      id: "DDF-2026-04",
      projectTitle: "AI-Based Healthcare Monitoring System (DST)",
      piName: "Dr. A. K. Sharma",
      totalSanctionGrant: 4500000,
      totalOverheadCollected: 450000,
      ddfAmount: 90000,
      date: "14 Aug 2026",
      type: "CREDIT",
    },
    {
      id: "DDF-2026-03",
      projectTitle: "5G Transceiver Chipset Design (MeitY)",
      piName: "Prof. S. R. Patel",
      totalSanctionGrant: 6000000,
      totalOverheadCollected: 600000,
      ddfAmount: 120000,
      date: "28 July 2026",
      type: "CREDIT",
    },
    {
      id: "DDF-2026-02",
      projectTitle: "Department Seminar Hall Smart Projector & Sound System",
      piName: "HOD CSE (Department Purchase)",
      totalSanctionGrant: 0,
      totalOverheadCollected: 0,
      ddfAmount: -45000,
      date: "15 June 2026",
      type: "DEBIT",
    },
  ];

  const piPdfBalances = [
    {
      piId: "FAC-101",
      piName: "Dr. A. K. Sharma",
      designation: "Associate Professor",
      activeProjectsCount: 3,
      pdfAccumulated: 420000,
      pdfSpent: 110000,
      pdfBalance: 310000,
    },
    {
      piId: "FAC-102",
      piName: "Prof. S. R. Patel",
      designation: "Professor",
      activeProjectsCount: 4,
      pdfAccumulated: 680000,
      pdfSpent: 230000,
      pdfBalance: 450000,
    },
    {
      piId: "FAC-103",
      piName: "Dr. V. K. Gupta",
      designation: "Assistant Professor",
      activeProjectsCount: 2,
      pdfAccumulated: 210000,
      pdfSpent: 40000,
      pdfBalance: 170000,
    },
    {
      piId: "FAC-105",
      piName: "Prof. R. C. Verma",
      designation: "Professor",
      activeProjectsCount: 3,
      pdfAccumulated: 540000,
      pdfSpent: 190000,
      pdfBalance: 350000,
    },
  ];

  const totalDdfBalance = ddfTransactions.reduce(
    (sum, t) => sum + t.ddfAmount,
    0
  );
  const totalDepartmentPdfBalance = piPdfBalances.reduce(
    (sum, p) => sum + p.pdfBalance,
    0
  );

  const filteredPdfs = piPdfBalances.filter((p) =>
    p.piName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-3 sm:px-6 py-5">
      <div className="max-w-[1530px] space-y-6">
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce">
            <Coins size={20} />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-slate-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Coins size={30} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Overhead Funds Dashboard
                </h1>
                <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Restricted View
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Department Development Fund (DDF 20%) & PI Professional Development Funds (PDF 40%) overview
              </p>
            </div>
          </div>

          <button
            onClick={() => showToast("Exporting Overhead Report to Excel/PDF...")}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition self-start sm:self-center shadow-sm"
          >
            <Download size={16} />
            Export Overhead Statement
          </button>
        </div>

        {/* OVERVIEW STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Department Development Fund (DDF 20%)
              </p>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{totalDdfBalance.toLocaleString("en-IN")}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building2 size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Total PI PDF Funds (40%)
              </p>
              <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                ₹{totalDepartmentPdfBalance.toLocaleString("en-IN")}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Overhead Split Matrix
              </p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                PDF 40% | DDF 20% | IDF 40%
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <PieChart size={22} />
            </div>
          </div>
        </div>

        {/* TAB SWITCHER & CONTENT */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 gap-2">
            {!isPI && (
              <button
                onClick={() => setActiveTab("DDF")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === "DDF"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Building2 size={16} />
                Department Development Fund (DDF 20%) Ledger
              </button>
            )}
            <button
              onClick={() => setActiveTab("PDF")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "PDF"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users size={16} />
              Professional Development Fund (PDF 40%) Balances
            </button>
            {isOffice && (
              <button
                onClick={() => setActiveTab("IDF")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === "IDF"
                    ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <PieChart size={16} />
                Institute Development Fund (IDF 40%) Overview
              </button>
            )}
          </div>

          <div className="p-5">
            {activeTab === "DDF" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <History size={18} className="text-emerald-600" />
                    DDF Accumulation & Expenditure Transactions
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Ref ID</th>
                        <th className="p-3">Project / Description</th>
                        <th className="p-3">PI / Department User</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">DDF Share (20%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                      {ddfTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                          <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{t.id}</td>
                          <td className="p-3 font-medium">{t.projectTitle}</td>
                          <td className="p-3">{t.piName}</td>
                          <td className="p-3">{t.date}</td>
                          <td className="p-3 text-right font-extrabold">
                            <span className={t.ddfAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                              {t.ddfAmount > 0 ? "+" : ""}₹{t.ddfAmount.toLocaleString("en-IN")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    Faculty PI Professional Development Fund (PDF) Accounts
                  </h3>

                  <div className="relative w-full ">
                    <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search PI Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Faculty PI</th>
                        <th className="p-3">Designation</th>
                        <th className="p-3">Active Projects</th>
                        <th className="p-3 text-right">PDF Accumulated</th>
                        <th className="p-3 text-right">PDF Spent</th>
                        <th className="p-3 text-right">Available PDF Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                      {filteredPdfs.map((pi) => (
                        <tr key={pi.piId} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{pi.piName}</td>
                          <td className="p-3">{pi.designation}</td>
                          <td className="p-3 font-semibold">{pi.activeProjectsCount} Projects</td>
                          <td className="p-3 text-right">₹{pi.pdfAccumulated.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-right text-slate-500">₹{pi.pdfSpent.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-right font-extrabold text-blue-600 dark:text-blue-400">
                            ₹{pi.pdfBalance.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
