import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../layout/useTheme";
import { useAuth } from "../auth/useAuth";
import { listJoiningQueue, forwardJoiningReport, approveJoiningReport, returnJoiningReport, downloadRecruitmentDocument } from "../api/recruitmentApi";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Search,
  Filter,
  Building2,
  Calendar,
  Send,
  X,
  Award,
  Download,
  Lock,
  Clock,
  Check,
} from "lucide-react";

export default function JoiningApprovalPage() {
  useTheme();
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("APPROVE");
  const [remarks, setRemarks] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [joiningReports, setJoiningReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    try {
      const data = await listJoiningQueue();
      if (Array.isArray(data) && data.length > 0) {
        setJoiningReports(
          data.map((item) => ({
            id: item.referenceNo || item.candidateId,
            candidateId: item.candidateId,
            recruitmentRequestId: item.recruitmentRequestId,
            candidateName: item.candidateName,
            designation: item.designation,
            stipendAmount: item.stipendAmount,
            hraAmount: item.hraAmount,
            department: item.department,
            projectTitle: item.projectTitle,
            piName: item.piName,
            meritRank: item.meritRank,
            interviewDate: item.interviewDate || '—',
            joiningDate: item.joiningDate || '—',
            committeeChair: item.committeeChair,
            joiningDocName: `Joining_Report_${item.candidateName.replace(/\s+/g, '')}.pdf`,
            fitnessCertName: `Fitness_Certificate_${item.candidateName.replace(/\s+/g, '')}.pdf`,
            appliedDate: new Date(item.submittedAt).toLocaleDateString('en-IN'),
            status: item.status,
          }))
        );
      } else {
        setJoiningReports([]);
      }
    } catch (err) {
      console.error("Failed to load joining queue from API", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const filteredReports = joiningReports.filter((item) => {
    const matchesStatus =
      filterStatus === "ALL" || item.status === filterStatus;
    const matchesSearch =
      item.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.piName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleOpenDocModal = (report) => {
    setSelectedReport(report);
    setShowDocModal(true);
  };

  const handleOpenActionModal = (report, type) => {
    setSelectedReport(report);
    setActionType(type);
    setRemarks("");
    setShowActionModal(true);
  };

  const handleDownloadJoiningLetter = async (report) => {
    try {
      showToast(`Downloading joining letter for ${report.candidateName}...`);
      if (report.recruitmentRequestId) {
        await downloadRecruitmentDocument(report.recruitmentRequestId, "joining-letter");
      } else {
        const textContent = `MINISTRY OF EDUCATION / MNNIT ALLAHABAD\nOFFICE OF RESEARCH & CONSULTANCY\n\nJOINING REPORT & APPOINTMENT LETTER\nCandidate Name: ${report.candidateName}\nDesignation: ${report.designation}\nStipend: ₹${report.stipendAmount}\nHRA: ₹${report.hraAmount}\nProject: ${report.projectTitle}\nPI: ${report.piName}\nJoining Date: ${report.joiningDate}\n\nStatus: APPROVED BY DEAN (R&C)\nReference: ${report.id}\n`;
        const blob = new Blob([textContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Joining_Letter_${report.candidateName.replace(/\s+/g, "_")}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      showToast(`Failed to download joining letter: ${err.message || 'Error downloading file'}`);
    }
  };

  const handleExecuteAction = async () => {
    if (!selectedReport) return;

    const isReturn = actionType === "RETURN";
    const isDeanApprove = actionType === "DEAN_APPROVE";

    setShowActionModal(false);

    try {
      if (isReturn) {
        await returnJoiningReport(selectedReport.candidateId, remarks);
        showToast(`Joining report ${selectedReport.id} returned to PI.`);
      } else if (isDeanApprove) {
        await approveJoiningReport(selectedReport.candidateId, remarks);
        showToast(`Joining report ${selectedReport.id} for ${selectedReport.candidateName} fully approved by Dean! Appointment active.`);
      } else {
        await forwardJoiningReport(selectedReport.candidateId, remarks);
        showToast(`Joining report ${selectedReport.id} for ${selectedReport.candidateName} verified & forwarded to Dean/DR!`);
      }
      await loadQueue();
    } catch (err) {
      // Error is shown via the global toast notification (apiClient).
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
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-slate-700 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <UserCheck size={30} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Recruitment Joining Report Approvals
                </h1>
                <span className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  HOD / Dean Approval Queue
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Verify recruited candidate selection minutes, joining letter, medical fitness, and forward or give Dean approval
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
              placeholder="Search by Candidate, PI, or Project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <Filter size={18} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Status:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              {["ALL", "PENDING_HOD", "FORWARDED_TO_DEAN", "APPROVED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    filterStatus === status
                      ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {status === "ALL"
                    ? "All"
                    : status === "PENDING_HOD"
                    ? "Pending HOD"
                    : status === "FORWARDED_TO_DEAN"
                    ? "Pending Dean"
                    : "Approved"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* JOINING REPORTS LIST */}
        <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <UserCheck size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                No joining reports found matching criteria.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 hover:shadow-md transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/40 px-2.5 py-1 rounded-md">
                        {report.id}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {report.candidateName}
                      </h3>
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-semibold">
                        {report.designation}
                      </span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Award size={13} /> Rank #{report.meritRank}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          report.status === "PENDING_HOD"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : report.status === "FORWARDED_TO_DEAN"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }`}
                      >
                        {report.status === "PENDING_HOD"
                          ? "Pending HOD Verification"
                          : report.status === "FORWARDED_TO_DEAN"
                          ? "Pending Dean Approval"
                          : "Approved & Finalized"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{report.projectTitle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-slate-400 shrink-0" />
                        <span>PI: <strong>{report.piName}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span>Joining Date: <strong>{report.joiningDate}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award size={14} className="text-slate-400 shrink-0" />
                        <span>Selection Committee Chair: <strong>{report.committeeChair}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-700/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0 min-w-[210px] text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Stipend:</span>
                      <span className="font-semibold">₹{report.stipendAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>HRA:</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">+₹{report.hraAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-1 flex justify-between font-bold text-slate-900 dark:text-slate-100">
                      <span>Monthly Emolument:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">₹{(report.stipendAmount + report.hraAmount).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap lg:flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenDocModal(report)}
                      className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Eye size={15} />
                      Joining Documents
                    </button>

                    {report.status === "PENDING_HOD" && (
                      <>
                        <button
                          onClick={() => handleOpenActionModal(report, "HOD_APPROVE")}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Send size={15} />
                          Approve & Forward to Dean
                        </button>
                        <button
                          onClick={() => handleOpenActionModal(report, "RETURN")}
                          className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
                        >
                          Return to PI
                        </button>
                      </>
                    )}

                    {report.status === "FORWARDED_TO_DEAN" && (
                      <>
                        <button
                          onClick={() => handleOpenActionModal(report, "DEAN_APPROVE")}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                        >
                          <CheckCircle2 size={15} />
                          Approve & Finalize
                        </button>
                        <button
                          onClick={() => handleOpenActionModal(report, "RETURN")}
                          className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
                        >
                          Return to PI
                        </button>
                      </>
                    )}

                    {report.status === "APPROVED" && (
                      <button
                        onClick={() => handleDownloadJoiningLetter(report)}
                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Download size={15} />
                        Download Joining Letter
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* DOCUMENTS PREVIEW MODAL */}
        {showDocModal && selectedReport && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-teal-600 dark:text-teal-400" size={22} />
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Joining Verification Documents
                  </h3>
                </div>
                <button
                  onClick={() => setShowDocModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg text-xs space-y-2 text-slate-700 dark:text-slate-200">
                <p><strong>Candidate Name:</strong> {selectedReport.candidateName}</p>
                <p><strong>Designation:</strong> {selectedReport.designation} (Rank #{selectedReport.meritRank})</p>
                <p><strong>Joining Date:</strong> {selectedReport.joiningDate}</p>
                <p><strong>Selection Committee Chair:</strong> {selectedReport.committeeChair}</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <FileText size={18} className="text-teal-600" />
                    {selectedReport.joiningDocName}
                  </div>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Verified</span>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <FileText size={18} className="text-blue-600" />
                    {selectedReport.fitnessCertName}
                  </div>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Verified</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Close Documents
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTION MODAL */}
        {showActionModal && selectedReport && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {actionType === "DEAN_APPROVE" ? (
                    <>
                      <CheckCircle2 className="text-emerald-600" size={20} />
                      Approve & Finalize Appointment
                    </>
                  ) : actionType === "HOD_APPROVE" || actionType === "APPROVE" ? (
                    <>
                      <Send className="text-emerald-600" size={20} />
                      Sign & Forward Joining to Dean/DR
                    </>
                  ) : (
                    <>
                      <XCircle className="text-amber-600" size={20} />
                      Return Joining Report to PI
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setShowActionModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                You are about to{" "}
                {actionType === "DEAN_APPROVE"
                  ? "give final Dean approval for"
                  : actionType === "HOD_APPROVE" || actionType === "APPROVE"
                  ? "verify and forward"
                  : "return"}{" "}
                the joining report of <strong>{selectedReport.candidateName}</strong> ({selectedReport.designation}).
              </p>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Remarks:
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter approval or return remarks..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteAction}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg transition shadow-sm ${
                    actionType === "RETURN"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  Confirm {actionType === "DEAN_APPROVE" ? "Final Approval" : actionType === "RETURN" ? "Return Report" : "Forward to Dean"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

