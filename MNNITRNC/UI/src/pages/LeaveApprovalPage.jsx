import { useState, useEffect } from "react";
import { useTheme } from "../layout/useTheme";
import { useAuth } from "../auth/useAuth";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  FileCheck,
  Search,
  Filter,
  UserCheck,
  Building2,
  Clock,
  Send,
  Loader2,
  FileText,
  Eye,
  Download,
  X,
} from "lucide-react";
import { listAllLeaveRequests, consumeLeave, refundLeaveCancellation } from "../api/fellowshipApi";
import { getNocRequests, processNocAction } from "../api/nocApi";
import {
  getExperienceCertificateRequests,
  processExperienceCertificateAction
} from "../api/experienceCertificateApi";
import {
  getMedicalFacilityRequests,
  processMedicalFacilityAction
} from "../api/medicalFacilityApi";
import { actionWorkflow } from "../api/workflowApi";
import { WORKFLOW_STAGE_LABELS } from "../constants/procurementEnums";
import DocumentUploader from "../components/DocumentUploader";

export default function LeaveApprovalPage() {
  useTheme();
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  
  const [activeTab, setActiveTab] = useState("LEAVES");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("APPROVE");
  const [remarks, setRemarks] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const canApproveItem = (item, tab) => {
    if (!userRoles || userRoles.length === 0) return false;
    const s = item.status;
    if (s === "Approved" || s === "Rejected" || s === "Cancelled") return false;

    if (userRoles.includes("SuperAdmin")) return true;

    if (tab === "LEAVES") {
      if ((s === "Raised" || s === "WithPI" || s === "WithPIFellowship") && userRoles.includes("Faculty")) return true;
      if ((s === "WithHOD" || s === "WithHODFellowship" || s === "SignedCopyUploaded") && userRoles.includes("HOD")) return true;
      if ((s === "Assigned" || s === "AssignedToDealingAssistant" || s === "WithDAFellowship") && userRoles.includes("RegularStaff")) return true;
      if ((s === "Forwarded" || s === "WithSuperintendent" || s === "WithSuperintendentFellowship" || s === "WithRnCOffice") && userRoles.includes("Superintendent")) return true;
      if ((s === "ForwardedOSRC" || s === "WithDeputyRegistrar" || s === "WithDRFellowship") && userRoles.includes("DeputyRegistrar")) return true;
      if ((s === "WithDean" || s === "WithDeanFellowship" || s === "ForwardedDR" || s === "Director" || s === "WithDeanGrantReceipt") && userRoles.includes("Dean")) return true;
      if (s === "Director" && userRoles.includes("Director")) return true;
      return false;
    } else {
      if (s === "Pending PI Approval" && userRoles.includes("Faculty")) return true;
      if (s === "Pending HOD Approval" && userRoles.includes("HOD")) return true;
      if (s === "Pending DA Action" && userRoles.includes("RegularStaff")) return true;
      if (s === "Pending Superintendent Action" && userRoles.includes("Superintendent")) return true;
      if (s === "Pending DR Action" && userRoles.includes("DeputyRegistrar")) return true;
      if ((s === "Pending Dean Approval" || s === "Pending") && userRoles.includes("Dean")) return true;
      return false;
    }
  };

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [nocRequests, setNocRequests] = useState([]);
  const [expRequests, setExpRequests] = useState([]);
  const [medRequests, setMedRequests] = useState([]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [leavesRes, nocsRes, expsRes, medsRes] = await Promise.allSettled([
        listAllLeaveRequests(),
        getNocRequests(),
        getExperienceCertificateRequests(),
        getMedicalFacilityRequests(),
      ]);

      if (leavesRes.status === "fulfilled" && Array.isArray(leavesRes.value)) {
        const formattedLeaves = leavesRes.value.map((item) => ({
          id: item.id,
          rawId: item.id,
          applicantName: item.applicantName || "Scholar",
          designation: item.designation || "Fellow",
          department: item.departmentName || "Department",
          projectTitle: item.projectTitle || "Research Project",
          piName: item.piName || "PI",
          leaveType:
            item.leaveType === "Special" || item.leaveType === 1
              ? "Special Leave (Conference)"
              : "Annual Leave",
          durationDays: item.dayCount || 0,
          startDate: item.fromDate || "",
          endDate: item.toDate || "",
          outOfStationDates: item.outOfStationDates || [],
          purpose: item.purpose || "Leave request",
          workflowInstanceId: item.workflowInstanceId,
          status: item.currentStage || "Raised",
          createdAt: item.createdAt,
          isCancellation: item.isCancellation || false,
        })).filter(item => item.status !== "Cancelled");
        setLeaveRequests(formattedLeaves);
      }

      if (nocsRes.status === "fulfilled" && Array.isArray(nocsRes.value)) {
        const formattedNocs = nocsRes.value.map((item) => ({
          id: item.id,
          applicantName: item.studentName || "PhD Scholar",
          rollNo: item.enrollmentNumber || item.studentUserId || "",
          department: item.departmentName || "Department",
          piName: item.piName || "Supervisor",
          nocType: item.purpose || "PhD Job Application NOC",
          organizationName: item.targetOrganization || "",
          appliedDate: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString("en-GB")
            : "",
          status: item.status || "Pending PI Approval",
          certificateNumber: item.certificateNumber,
        })).filter(item => item.status !== "Cancelled");
        setNocRequests(formattedNocs);
      }

      if (expsRes.status === "fulfilled" && Array.isArray(expsRes.value)) {
        const formattedExps = expsRes.value.map((item) => ({
          id: item.id,
          applicantName: item.studentName || "Fellow",
          rollNo: item.enrollmentNumber || item.studentUserId || "",
          department: item.departmentName || "Department",
          piName: item.piName || "Supervisor",
          projectTitle: item.projectTitle || "",
          projectNo: item.projectNo || "",
          nocType: item.purpose || "Experience Certificate Request",
          organizationName: item.targetOrganization || "",
          appliedDate: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString("en-GB")
            : "",
          status: item.status || "Pending PI Approval",
          certificateNumber: item.certificateNumber,
        })).filter(item => item.status !== "Cancelled");
        setExpRequests(formattedExps);
      }

      if (medsRes.status === "fulfilled" && Array.isArray(medsRes.value)) {
        const formattedMeds = medsRes.value.map((item) => ({
          id: item.id,
          applicantName: item.studentName || "Fellow",
          rollNo: item.enrollmentNumber || item.studentUserId || "",
          department: item.departmentName || "Department",
          piName: item.piName || "Supervisor",
          projectTitle: item.projectTitle || "",
          projectNo: item.projectNo || "",
          nocType: item.purpose || "Medical Facility Request",
          organizationName: item.targetOrganization || "",
          appliedDate: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString("en-GB")
            : "",
          status: item.status || "Pending PI Approval",
          certificateNumber: item.certificateNumber,
        })).filter(item => item.status !== "Cancelled");
        setMedRequests(formattedMeds);
      }
    } catch (err) {
      console.error("Failed to load approval data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentList =
    activeTab === "LEAVES"
      ? leaveRequests
      : activeTab === "NOC"
      ? nocRequests
      : activeTab === "EXP_CERT"
      ? expRequests
      : medRequests;

  const filteredItems = currentList.filter((item) => {
    if (item.status === "Cancelled") return false;

    const matchesStatus =
      filterStatus === "ALL" ||
      item.status.toUpperCase().includes(filterStatus.toUpperCase());
    const matchesSearch =
      item.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.piName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.projectTitle &&
        item.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.purpose &&
        item.purpose.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleOpenActionModal = (item, type) => {
    setSelectedItem(item);
    setActionType(type);
    setRemarks("");
    setShowActionModal(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedItem || submitting) return;
    setSubmitting(true);
    try {
      if (activeTab === "LEAVES") {
        if (actionType === "APPROVE") {
          const isFinalStage =
            selectedItem.status === "WithDean" ||
            selectedItem.status === "ForwardedDR" ||
            selectedItem.status === "Director";
          const actionName = isFinalStage ? "approve" : "forward";
          await actionWorkflow(selectedItem.workflowInstanceId, actionName, {
            remarks,
          });

          if (isFinalStage) {
            try {
              if (selectedItem.isCancellation) {
                await refundLeaveCancellation(selectedItem.rawId);
              } else {
                await consumeLeave(selectedItem.rawId);
              }
            } catch (cErr) {
              console.warn("Final stage side-effect failed:", cErr);
            }
            showToast(`Leave request ${selectedItem.id} approved & balance updated!`);
          } else {
            showToast(`Leave request ${selectedItem.id} approved & forwarded!`);
          }
        } else {
          await actionWorkflow(selectedItem.workflowInstanceId, "reject", {
            remarks,
          });
          showToast(`Leave request ${selectedItem.id} returned / rejected.`);
        }
        } else if (activeTab === "NOC") {
        const actionStr = actionType === "APPROVE" ? "Approve" : "Reject";
        await processNocAction(selectedItem.id, actionStr, remarks);
        showToast(
          actionType === "APPROVE"
            ? `NOC request ${selectedItem.id} approved!`
            : `NOC request ${selectedItem.id} returned to student.`
        );
      } else if (activeTab === "EXP_CERT") {
        const actionStr = actionType === "APPROVE" ? "Approve" : "Reject";
        await processExperienceCertificateAction(selectedItem.id, actionStr, remarks);
        showToast(
          actionType === "APPROVE"
            ? `Experience Certificate request ${selectedItem.id} approved!`
            : `Experience Certificate request ${selectedItem.id} returned.`
        );
      } else {
        const actionStr = actionType === "APPROVE" ? "Approve" : "Reject";
        await processMedicalFacilityAction(selectedItem.id, actionStr, remarks);
        showToast(
          actionType === "APPROVE"
            ? `Medical Facility request ${selectedItem.id} approved!`
            : `Medical Facility request ${selectedItem.id} returned.`
        );
      }
      setShowActionModal(false);
      await loadData();
    } catch (err) {
      showToast(err?.message || "Failed to process request action.");
    } finally {
      setSubmitting(false);
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
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-slate-700 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Calendar size={30} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Leave & Certificate Approvals
                </h1>
                <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  R&C Workflow Queue
                </span>
              </div>
              <p className='text-xs sm:text-sm text-slate-500 dark:text-slate-400'>Workflow: Candidate → PI → HOD → DA → OSRC → DR → Dean</p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Review scholar leave entitlement claims, PhD NOC, and Experience Certificate applications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1.5 rounded-xl self-start sm:self-center">
            <button
              onClick={() => setActiveTab("LEAVES")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === "LEAVES"
                  ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              Leave Requests ({leaveRequests.length})
            </button>
            <button
              onClick={() => setActiveTab("NOC")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === "NOC"
                  ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              PhD NOC ({nocRequests.length})
            </button>
            <button
              onClick={() => setActiveTab("EXP_CERT")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === "EXP_CERT"
                  ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              Experience Cert ({expRequests.length})
            </button>
            <button
              onClick={() => setActiveTab("MED_FACILITY")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === "MED_FACILITY"
                  ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              Medical Facility ({medRequests.length})
            </button>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder={`Search ${activeTab === "LEAVES" ? "leave claims" : "NOC requests"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <Filter size={18} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Filter:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${filterStatus === status
                      ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                  {status === "ALL"
                    ? "All"
                    : status === "PENDING"
                      ? "Pending"
                      : status === "APPROVED"
                        ? "Approved"
                        : "Rejected"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CONTENT LIST */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-slate-200 dark:border-slate-700 text-center flex items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-purple-600" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Loading approval requests from server...
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <Calendar size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                No {activeTab === "LEAVES" ? "leave requests" : "NOC requests"} found.
              </p>
            </div>
          ) : activeTab === "LEAVES" ? (
            filteredItems.map((leave) => (
              <div
                key={leave.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 hover:shadow-md transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 px-2.5 py-1 rounded-md">
                        {leave.id.slice(0, 8)}...
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {leave.applicantName} ({leave.designation})
                      </h3>
                      {leave.isCancellation && (
                        <span className="text-xs bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-semibold">
                          Leave Cancellation Request
                        </span>
                      )}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${leave.leaveType.includes("Special")
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                          }`}
                      >
                        {leave.leaveType}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${leave.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : leave.status === "Rejected"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                      >
                        Stage: {WORKFLOW_STAGE_LABELS[leave.status] ?? (leave.status === 'Raised' ? 'PI' : leave.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{leave.projectTitle} ({leave.department})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-slate-400 shrink-0" />
                        <span>PI: <strong>{leave.piName}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400 shrink-0" />
                        <span>Dates: <strong>{leave.startDate} to {leave.endDate} ({leave.durationDays} Days)</strong></span>
                      </div>
                      {leave.outOfStationDates?.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-400 shrink-0" />
                          <span>Out of Station: <strong>{leave.outOfStationDates.length > 1 ? `${leave.outOfStationDates[0]} to ${leave.outOfStationDates[leave.outOfStationDates.length - 1]}` : leave.outOfStationDates[0]} ({leave.outOfStationDates.length} Days)</strong></span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <FileCheck size={14} className="text-slate-400 shrink-0" />
                        <span>Entitlement: Annual 30 Days / Special 15 Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canApproveItem(leave, "LEAVES") && (
                      <>
                        <button
                          onClick={() => handleOpenActionModal(leave, "APPROVE")}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Send size={15} />
                          Approve / Forward
                        </button>
                        <button
                          onClick={() => handleOpenActionModal(leave, "RETURN")}
                          className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
                        >
                          Return / Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <p><strong>Purpose of Leave:</strong> {leave.purpose}</p>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    Supporting Documents
                  </h4>
                  <DocumentUploader
                    ownerType="LeaveRequest"
                    ownerId={leave.rawId || leave.id}
                    requestType="LeaveRequest"
                    phase="Indent"
                    readOnly={true}
                  />
                </div>
              </div>
            ))
          ) : (
            filteredItems.map((noc) => (
              <div
                key={noc.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 px-2.5 py-1 rounded-md">
                      {noc.id.slice(0, 8)}...
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {noc.applicantName} ({noc.rollNo})
                    </h3>
                    <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-0.5 rounded-full font-semibold">
                      {noc.nocType}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-semibold">
                      Stage: {WORKFLOW_STAGE_LABELS[noc.status] ?? (noc.status === 'Pending PI Approval' ? 'PI' : noc.status)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {noc.projectTitle && <p><strong>Project Title:</strong> {noc.projectTitle} {noc.projectNo ? `(No: ${noc.projectNo})` : ''}</p>}
                    <p><strong>Target Organization:</strong> {noc.organizationName}</p>
                    <p><strong>Department:</strong> {noc.department}</p>
                    {noc.certificateNumber && (
                      <p className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                        Certificate #: {noc.certificateNumber}
                      </p>
                    )}
                    <p className="text-slate-400">Applied on: {noc.appliedDate}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeTab !== "LEAVES" && (
                    <button
                      onClick={() => {
                        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7054';
                        let endpoint = '';
                        let title = 'Document Preview';
                        if (activeTab === 'NOC') { endpoint = `/api/noc-requests/${noc.id}/certificate`; title = 'NOC Preview'; }
                        if (activeTab === 'EXP_CERT') { endpoint = `/api/experience-certificate-requests/${noc.id}/certificate`; title = 'Experience Certificate Preview'; }
                        if (activeTab === 'MED_FACILITY') { endpoint = `/api/medical-facility-requests/${noc.id}/certificate`; title = 'Medical Facility Preview'; }
                        if (endpoint) {
                          setPreviewDocUrl(`${baseUrl}${endpoint}`);
                          setPreviewTitle(title);
                        }
                      }}
                      className="px-3.5 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Eye size={15} />
                      View Document
                    </button>
                  )}
                  {canApproveItem(noc, activeTab) && (
                    <>
                      <button
                        onClick={() => handleOpenActionModal(noc, "APPROVE")}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Send size={15} />
                        Approve NOC & Forward
                      </button>
                      <button
                        onClick={() => handleOpenActionModal(noc, "RETURN")}
                        className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition"
                      >
                        Reject NOC
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ACTION MODAL */}
        {showActionModal && selectedItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {actionType === "APPROVE" ? (
                    <>
                      <CheckCircle2 className="text-emerald-600" size={20} />
                      Approve & Forward Request
                    </>
                  ) : (
                    <>
                      <XCircle className="text-amber-600" size={20} />
                      Return / Reject Request
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
                You are about to {actionType === "APPROVE" ? "approve and forward" : "return/reject"} the request of{" "}
                <strong>{selectedItem.applicantName}</strong>.
              </p>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Action Remarks:
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks for approval or rejection..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  disabled={submitting}
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  onClick={handleExecuteAction}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-2 ${actionType === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-amber-600 hover:bg-amber-700"
                    }`}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Confirm {actionType === "APPROVE" ? "Forward / Approve" : "Return / Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">{previewTitle}</h2>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white mb-4">
              <iframe
                id="preview-iframe"
                src={previewDocUrl}
                className="w-full h-full"
                title={previewTitle}
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-auto">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(previewDocUrl);
                    const html = await response.text();
                    
                    const printWindow = window.open('', '_blank');
                    printWindow.document.open();
                    printWindow.document.write(html);
                    printWindow.document.close();
                    
                    printWindow.onload = () => {
                      printWindow.focus();
                      printWindow.print();
                    };
                    
                    // Fallback if onload doesn't fire
                    setTimeout(() => {
                      printWindow.focus();
                      printWindow.print();
                    }, 1000);
                  } catch (err) {
                    console.error("Failed to print/download", err);
                    window.open(previewDocUrl, '_blank');
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Download size={16} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
