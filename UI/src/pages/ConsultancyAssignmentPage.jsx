import { useState } from "react";
import { useTheme } from "../layout/useTheme";
import {
  Briefcase,
  CheckCircle2,
  UserPlus,
  Building,
  FileSpreadsheet,
  Search,
  Filter,
  Users,
  Send,
  X,
  PieChart,
  ShieldCheck,
} from "lucide-react";

export default function ConsultancyAssignmentPage() {
  useTheme();
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [selectedPi, setSelectedPi] = useState("");
  const [selectedCoPis, setSelectedCoPis] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const departmentFaculty = [
    { id: "FAC-101", name: "Dr. A. K. Sharma", designation: "Associate Professor" },
    { id: "FAC-102", name: "Prof. S. R. Patel", designation: "Professor" },
    { id: "FAC-103", name: "Dr. V. K. Gupta", designation: "Assistant Professor" },
    { id: "FAC-104", name: "Dr. Meenakshi Sundaram", designation: "Associate Professor" },
    { id: "FAC-105", name: "Prof. R. C. Verma", designation: "Professor" },
  ];

  const [requests, setRequests] = useState([
    {
      id: "CON-2026-008",
      clientName: "L&T Infrastructure Projects Ltd.",
      organization: "Larsen & Toubro Ltd.",
      gstNumber: "09AAACL1234H1Z5",
      category: "Testing",
      subject: "Concrete Core Testing & Structural Integrity Audit for Flyover",
      estimatedCost: 85000,
      gstAmount: 15300,
      totalAmount: 100300,
      appliedDate: "17 Aug 2026",
      approvalAuthority: "Dean Approval Only (Base ≤ ₹1,00,000)",
      assignedPi: null,
      assignedCoPis: [],
      status: "PENDING_HOD_ASSIGNMENT",
    },
    {
      id: "CON-2026-009",
      clientName: "National Highways Authority of India (NHAI)",
      organization: "NHAI Project Implementation Unit",
      gstNumber: "07AAACN5678J1Z2",
      category: "TPQA",
      subject: "Third-Party Quality Audit for 4-Lane Highway Construction",
      estimatedCost: 350000,
      gstAmount: 63000,
      totalAmount: 413000,
      appliedDate: "18 Aug 2026",
      approvalAuthority: "Dean + Director Approval (Base > ₹1,00,000)",
      assignedPi: null,
      assignedCoPis: [],
      status: "PENDING_HOD_ASSIGNMENT",
    },
    {
      id: "CON-2026-005",
      clientName: "Uttar Pradesh Power Corporation Ltd.",
      organization: "UPPCL Substation Wing",
      gstNumber: "09AAACU9988F1Z9",
      category: "Consultancy",
      subject: "Electrical Substation Grounding System Design & Safety Vetting",
      estimatedCost: 150000,
      gstAmount: 27000,
      totalAmount: 177000,
      appliedDate: "10 Aug 2026",
      approvalAuthority: "Dean + Director Approval (Base > ₹1,00,000)",
      assignedPi: "Prof. S. R. Patel",
      assignedCoPis: ["Dr. V. K. Gupta"],
      status: "PI_ASSIGNED",
    },
  ]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const filteredRequests = requests.filter((item) => {
    const matchesCat = filterCategory === "ALL" || item.category === filterCategory;
    const matchesSearch =
      item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenAssignModal = (req) => {
    setSelectedRequest(req);
    setSelectedPi("");
    setSelectedCoPis([]);
    setRemarks("");
    setShowAssignModal(true);
  };

  const handleOpenRevenueModal = (req) => {
    setSelectedRequest(req);
    setShowRevenueModal(true);
  };

  const handleAssignSubmit = () => {
    if (!selectedRequest || !selectedPi) return;

    const piObj = departmentFaculty.find((f) => f.id === selectedPi);
    const coPiNames = selectedCoPis.map(
      (id) => departmentFaculty.find((f) => f.id === id)?.name
    );

    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              assignedPi: piObj ? piObj.name : selectedPi,
              assignedCoPis: coPiNames,
              status: "PI_ASSIGNED",
            }
          : r
      )
    );

    setShowAssignModal(false);
    showToast(
      `Consultancy request ${selectedRequest.id} assigned to PI ${piObj?.name} and forwarded!`
    );
  };

  const handleToggleCoPi = (facId) => {
    if (selectedCoPis.includes(facId)) {
      setSelectedCoPis(selectedCoPis.filter((id) => id !== facId));
    } else {
      setSelectedCoPis([...selectedCoPis, facId]);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-3 sm:px-6 py-5">
      <div className="max-w-[1530px] mx-auto space-y-6">
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce">
            <CheckCircle2 size={20} />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-slate-700 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
              <Briefcase size={30} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Consultancy & Testing Request Assignment
                </h1>
                <span className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  HOD Assignment Module
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Review client consultancy/testing requests, assign PIs & Co-PIs, verify approval thresholds, and view HOD revenue distribution
              </p>
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by Client, Organization, or Subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <Filter size={18} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Project Category:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              {["ALL", "Testing", "TPQA", "Consultancy", "Design", "Vetting"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    filterCategory === cat
                      ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* REQUESTS LIST */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <Briefcase size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                No consultancy or testing requests found.
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 hover:shadow-md transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/40 px-2.5 py-1 rounded-md">
                        {req.id}
                      </span>
                      <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 px-2.5 py-0.5 rounded-full font-bold">
                        {req.category} Project
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          req.status === "PENDING_HOD_ASSIGNMENT"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }`}
                      >
                        {req.status === "PENDING_HOD_ASSIGNMENT"
                          ? "Pending HOD PI Assignment"
                          : "PI Assigned & Forwarded"}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {req.subject}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Building size={14} className="text-slate-400 shrink-0" />
                        <span>Client: <strong>{req.clientName} ({req.organization})</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={14} className="text-slate-400 shrink-0" />
                        <span>GSTIN: <strong>{req.gstNumber}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-slate-400 shrink-0" />
                        <span>Approval Path: <strong className="text-indigo-600 dark:text-indigo-400">{req.approvalAuthority}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span>Assigned PI: <strong>{req.assignedPi || "Not Assigned Yet"}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0 min-w-[220px] text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Base Cost:</span>
                      <span className="font-semibold">₹{req.estimatedCost.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>GST (18%):</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">+₹{req.gstAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-1 flex justify-between font-bold text-slate-900 dark:text-slate-100">
                      <span>Total Invoice:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">₹{req.totalAmount.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap lg:flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenRevenueModal(req)}
                      className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <PieChart size={15} />
                      View HOD 2.5% Share
                    </button>

                    {req.status === "PENDING_HOD_ASSIGNMENT" ? (
                      <button
                        onClick={() => handleOpenAssignModal(req)}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                      >
                        <UserPlus size={16} />
                        Assign PI & Approve
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={16} /> Assigned to {req.assignedPi}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* HOD REVENUE DISTRIBUTION PREVIEW MODAL */}
        {showRevenueModal && selectedRequest && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="text-purple-600 dark:text-purple-400" size={22} />
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                   Revenue Breakdown
                  </h3>
                </div>
                <button
                  onClick={() => setShowRevenueModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-xs text-purple-900 dark:text-purple-200 space-y-2 border border-purple-200 dark:border-purple-800">
                <p><strong>Project Base Amount:</strong> ₹{selectedRequest.estimatedCost.toLocaleString("en-IN")}</p>
                <p><strong>Institute Overhead (30%):</strong> ₹{(selectedRequest.estimatedCost * 0.3).toLocaleString("en-IN")}</p>
                <p><strong>Remaining Pool (70%):</strong> ₹{(selectedRequest.estimatedCost * 0.7).toLocaleString("en-IN")}</p>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">
                  Administrative Distribution (10.1% of Remaining Pool):
                </h4>
                <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Director (2.6%):</span>
                    <span>₹{(selectedRequest.estimatedCost * 0.7 * 0.026).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/40 p-2 rounded-lg">
                    <span>Head of Department (HOD - 2.5%):</span>
                    <span>₹{(selectedRequest.estimatedCost * 0.7 * 0.025).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dean R&C (2.0%):</span>
                    <span>₹{(selectedRequest.estimatedCost * 0.7 * 0.020).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Office Staff Pools (3.0%):</span>
                    <span>₹{(selectedRequest.estimatedCost * 0.7 * 0.030).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowRevenueModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Close Breakdown
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ASSIGN PI MODAL */}
        {showAssignModal && selectedRequest && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserPlus className="text-orange-600" size={20} />
                  Assign Principal Investigator (PI)
                </h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                <p><strong>Project:</strong> {selectedRequest.subject}</p>
                <p><strong>Client:</strong> {selectedRequest.clientName}</p>
                <p><strong>Category:</strong> {selectedRequest.category}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Select Principal Investigator (PI) <span className="text-red-500">*</span>:
                  </label>
                  <select
                    value={selectedPi}
                    onChange={(e) => setSelectedPi(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  >
                    <option value="">-- Select Faculty Member --</option>
                    {departmentFaculty.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} ({fac.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Select Co-Principal Investigators (Co-PIs) (Optional):
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                    {departmentFaculty
                      .filter((f) => f.id !== selectedPi)
                      .map((fac) => (
                        <label
                          key={fac.id}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCoPis.includes(fac.id)}
                            onChange={() => handleToggleCoPi(fac.id)}
                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span>{fac.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedPi}
                  onClick={handleAssignSubmit}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 ${
                    selectedPi
                      ? "bg-orange-600 hover:bg-orange-700 cursor-pointer"
                      : "bg-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Send size={15} /> Confirm Assignment & Forward
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
