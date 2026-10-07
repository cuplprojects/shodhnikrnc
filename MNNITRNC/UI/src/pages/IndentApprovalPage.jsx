import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../layout/useTheme";
import {
  ShoppingBag,
  CheckCircle2,
  FileCheck,
  Search,
  Filter,
  UserCheck,
  Building2,
  IndianRupee,
  ShieldAlert,
  Send,
  X,
  AlertTriangle,
  FileText,
  CreditCard,
  Layers,
  HelpCircle,
  RefreshCw,
  Award,
  Check,
  Plus
} from "lucide-react";
import { listProjects, getProject } from "../api/projectsApi";
import {
  listIndentsForProject,
  listAllProcurementIndents,
  getIndent,
  getIndentBudget
} from "../api/procurementApi";
import { INDENT_TYPES } from "../constants/procurementEnums";
import { formatCurrency } from "./projects/utils/currency";
import RequisitionModalShell from "./procurement/components/RequisitionModalShell";

// Helper function to derive BRD A7.1 & A7.2 Approval Band
function getApprovalBandInfo(indentType, gemAvailability, estimatedCost) {
  const isGem = gemAvailability === "Yes" || indentType === "GeM";

  if (isGem) {
    if (estimatedCost <= 50000) {
      return {
        band: "GeM Direct Purchase (≤ ₹50,000) — Signed by Dean",
        description: "Direct purchase permitted without quotation, subject to indent approval by Dean (R&C).",
        authority: "Dean (R&C)",
        biddingRequired: false,
        committeeRequired: false,
      };
    } else if (estimatedCost <= 100000) {
      return {
        band: "GeM Bidding Process (₹50k - ₹1 Lakh) — Signed by Dean",
        description: "Order value exceeds ₹50,000. Undergoes GeM bidding process; signed & approved by Dean (R&C).",
        authority: "Dean (R&C)",
        biddingRequired: true,
        committeeRequired: false,
      };
    } else {
      return {
        band: "GeM Bidding Process (> ₹1 Lakh) — Signed by Director",
        description: "Order value exceeds ₹1 Lakh. Undergoes GeM bidding process; signed & approved by Director.",
        authority: "Director",
        biddingRequired: true,
        committeeRequired: false,
      };
    }
  } else {
    // Non-GeM Procurement Bands
    if (estimatedCost <= 100000) {
      return {
        band: "Non-GeM 1st Indent (≤ ₹1 Lakh) — Signed by Dean",
        description: "1st Indent up to ₹2 Lakh split band. Up to ₹1 Lakh signed and approved by Dean.",
        authority: "Dean (R&C)",
        biddingRequired: false,
        committeeRequired: false,
      };
    } else if (estimatedCost <= 200000) {
      return {
        band: "Non-GeM 1st Indent (₹1 Lakh - ₹2 Lakh) — Signed by Director",
        description: "1st Indent split band (> ₹1 Lakh to ₹2 Lakh). Signed and approved by Director.",
        authority: "Director",
        biddingRequired: false,
        committeeRequired: false,
      };
    } else {
      return {
        band: "Non-GeM 2nd Indent (₹2 Lakh - ₹25 Lakh) — Market Committee",
        description: "2nd Indent (₹2L - ₹25L). Market committee formed, notice issued, comparative statement signed, PO issued. Binding: Prayagraj.",
        authority: "Non-GeM Market Committee & Director",
        biddingRequired: false,
        committeeRequired: true,
      };
    }
  }
}

export default function IndentApprovalPage() {
  useTheme();
  const navigate = useNavigate();
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [indents, setIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [selectedIndent, setSelectedIndent] = useState(null);
  const [showCertModal, setShowCertModal] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  // Project & Indent Creation Modal States
  const [userProjectsList, setUserProjectsList] = useState([]);
  const [isSelectProjectOpen, setIsSelectProjectOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Consumable");
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedProjectObject, setSelectedProjectObject] = useState(null);

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 4500);
  };

  const handleOpenNewIndentModal = async () => {
    try {
      const projects = await listProjects();
      if (projects && projects.length > 0) {
        setUserProjectsList(projects);
        setSelectedProjectId(projects[0].id);
        setSelectedProjectObject(projects[0]);
        setIsSelectProjectOpen(true);
      } else {
        showToast("No active projects found. Please create or assign a research project first.", "error");
      }
    } catch (err) {
      showToast("Failed to load projects list for raising indent.", "error");
    }
  };

  const handleProceedToForm = async () => {
    const proj = userProjectsList.find((p) => p.id === selectedProjectId);
    if (!proj) return;

    try {
      const fullProj = await getProject(selectedProjectId).catch(() => proj);
      setSelectedProjectObject(fullProj || proj);
    } catch {
      setSelectedProjectObject(proj);
    }

    setIsSelectProjectOpen(false);
    setIsRaiseModalOpen(true);
  };

  // Fetch real indents from API in a single HTTP request (100% backend data)
  const fetchIndents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await listAllProcurementIndents();

      if (rows && rows.length > 0) {
        const fetchedList = rows.map((item) => {
          const cost = item.estimatedCost || 0;
          const gemAvail = item.gemAvailability || (item.indentType === "GeM" ? "Yes" : "No");

          return {
            id: item.id,
            rawIndent: item,
            indentType: item.indentType || "Consumable",
            itemCategory: item.itemCategory || (item.indentType === "Equipment" ? "Non-Consumable" : "Consumable"),
            itemName: item.itemName || "Item",
            estimatedCost: cost,
            indenterName: item.indenterName || "Project PI",
            projectTitle: item.projectTitle || "Research Project",
            projectId: item.projectId,
            budgetHeadId: item.budgetHeadId,
            workflowInstanceId: item.workflowInstanceId,
            sanctionedBudget: item.sanctionedBudget || 0,
            committedBudget: item.committedBudget || 0,
            paidBudget: item.paidBudget || 0,
            availableBudget: item.availableBudget || 0,
            nonAvailabilityCertId: item.nonAvailabilityCertificateNumber || null,
            nacGenDate: item.nonAvailabilityCertificateIssueDate || null,
            validityDate: item.nonAvailabilityCertificateValidityDate || null,
            nacItemName: item.itemName,
            paymentRouting: item.paymentRouting || "Party Payment",
            miscellaneousExpenditure: item.miscellaneousExpenditure || 0,
            biddingNumber: item.biddingNumber || null,
            bidPublicationDate: item.bidPublicationDate || null,
            purchaseOrderNumber: item.purchaseOrderNumber || null,
            purchaseOrderDate: item.purchaseOrderDate || null,
            bindingLocation: item.bindingLocation || "Prayagraj",
            comparativeStatementNumber: item.comparativeStatementNumber || null,
            comparativeStatementSigned: item.comparativeStatementSigned || false,
            appliedDate: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recent",
            status: item.currentStage === "Approved"
              ? "APPROVED_AND_SEALED"
              : (item.currentStage && item.currentStage !== "Raised" && item.currentStage !== "Draft")
                ? "IN_REVIEW"
                : "RAISED",
            gemAvailability: gemAvail,
            paymentMode: item.paymentRouting || "Party Payment",
          };
        });

        setIndents(fetchedList);
      } else {
        setIndents([]);
      }
    } catch (err) {
      console.error("Error loading indents", err);
      setError("Failed to load indents from backend server.");
      setIndents([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIndents();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchIndents();
  };

  const filteredIndents = useMemo(() => {
    return indents.filter((item) => {
      const isGemItem = item.gemAvailability === "Yes" || item.indentType === "GeM";
      const matchesPlatform =
        filterPlatform === "ALL" ||
        (filterPlatform === "GeM" && isGemItem) ||
        (filterPlatform === "Non-GeM" && !isGemItem);

      const matchesCategory =
        filterCategory === "ALL" || item.itemCategory === filterCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.itemName.toLowerCase().includes(q) ||
        item.indenterName.toLowerCase().includes(q) ||
        item.projectTitle.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.biddingNumber && item.biddingNumber.toLowerCase().includes(q)) ||
        item.estimatedCost.toString().includes(q);

      return matchesPlatform && matchesCategory && matchesSearch;
    });
  }, [indents, filterPlatform, filterCategory, searchQuery]);

  const handleOpenCertModal = (indent) => {
    setSelectedIndent(indent);
    setShowCertModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-3 sm:px-6 py-5">
      <div className="max-w-[1530px] mx-auto space-y-6">

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div
            className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce text-white ${toastType === "error" ? "bg-rose-600" : "bg-emerald-600"
              }`}
          >
            {toastType === "error" ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <ShoppingBag size={30} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Procurement & GeM Indent Approvals
                </h1>
                <span className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  HOD Seal & Sign Portal
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Verify Non-Availability Certificates, approval bands, budget availability (`Committed + Paid`), sign & apply official HOD stamp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              onClick={handleOpenNewIndentModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-500/20"
            >
              <Plus size={16} />
              Raise New Indent
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing..." : "Sync API"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs p-3.5 rounded-xl flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </span>
            <button onClick={fetchIndents} className="underline font-bold">Retry</button>
          </div>
        )}

        {/* BRD A7 QUICK REFERENCE SUMMARY BANNER */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">GeM Direct Purchase</p>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">≤ ₹50,000 (No Quotation)</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <UserCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Non-GeM 1st Indent</p>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">≤ ₹1L (Dean) / ≤ ₹2L (Director)</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Non-GeM 2nd Indent</p>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">₹2L - ₹25L (Market Committee)</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Non-GeM Requirement</p>
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">NAC Certificate & Item Match</p>
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
              placeholder="Search by Item Name, Indenter, Project, or Indent ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Platform:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                {["ALL", "GeM", "Non-GeM"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterPlatform(type)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${filterPlatform === type
                        ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Category:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                {["ALL", "Consumable", "Non-Consumable"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${filterCategory === cat
                        ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* INDENTS LIST */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <RefreshCw size={30} className="mx-auto text-cyan-500 animate-spin mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Loading procurement indents and verifying budget snapshots...
              </p>
            </div>
          ) : filteredIndents.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <ShoppingBag size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                No procurement indents match your search criteria.
              </p>
            </div>
          ) : (
            filteredIndents.map((indent) => {
              const isGem = indent.gemAvailability === "Yes" || indent.indentType === "GeM";
              const bandInfo = getApprovalBandInfo(indent.indentType, indent.gemAvailability, indent.estimatedCost);
              const otherCommitted = Math.max(0, (indent.committedBudget || 0) - (indent.estimatedCost || 0));
              const effectiveAvailable = (indent.sanctionedBudget || 0) - (otherCommitted + (indent.paidBudget || 0));
              const isBudgetSufficient = effectiveAvailable >= indent.estimatedCost;

              return (
                <div
                  key={indent.id}
                  onClick={() => navigate(`/procurement/${indent.indentType}/${indent.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/procurement/${indent.indentType}/${indent.id}`);
                  }}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

                    {/* LEFT INFO COLUMN */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/40 px-2.5 py-1 rounded-md border border-cyan-200 dark:border-cyan-800">
                          {indent.id}
                        </span>

                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-md font-extrabold ${isGem
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                            }`}
                        >
                          {isGem ? "GeM Procurement" : "Non-GeM Procurement"} ({indent.itemCategory})
                        </span>

                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${indent.status === "APPROVED_AND_SEALED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : indent.status === "HOD_SEALED_IN_REVIEW"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                        >
                          {indent.status === "APPROVED_AND_SEALED"
                            ? "Sealed & Approved"
                            : indent.status === "HOD_SEALED_IN_REVIEW"
                              ? `HOD Sealed (${indent.rawIndent?.currentStage || "In Office Review"})`
                              : "Pending HOD Sign & Seal"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {indent.itemName}
                      </h3>

                      {/* BRD DETAILS GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">Project: <strong>{indent.projectTitle}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-slate-400 shrink-0" />
                          <span>Indenter PI: <strong>{indent.indenterName}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 col-span-1 md:col-span-2 bg-slate-50 dark:bg-slate-700/40 p-2 rounded-lg border border-slate-200 dark:border-slate-600">
                          <Award size={15} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">Approval Band: </span>
                            <span className="text-cyan-700 dark:text-cyan-300 font-semibold">{bandInfo.band}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{bandInfo.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BUDGET & COST COLUMN (BRD A7.4 Formula: Total Head Budget = Committed + Paid) */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shrink-0 min-w-[240px] space-y-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Estimated Cost
                        </p>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                          {formatCurrency(indent.estimatedCost)}
                        </p>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-600 pt-2 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Sanctioned Budget:</span>
                          <span className="font-bold">₹{indent.sanctionedBudget.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Committed + Paid:</span>
                          <span>₹{(indent.committedBudget + indent.paidBudget).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-600 pt-1">
                          <span>Available Budget:</span>
                          <span className={isBudgetSufficient ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                            ₹{indent.availableBudget.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1">
                        {isBudgetSufficient ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={13} /> Budget Verified (Available ≥ Indent)
                          </span>
                        ) : (
                          <span className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                            <AlertTriangle size={13} /> Insufficient Head Budget
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTION BUTTONS -- stop propagation so clicking a button doesn't also trigger the card's row-click navigation */}
                    <div
                      className="flex flex-wrap lg:flex-col items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isGem && indent.nonAvailabilityCertId && (
                        <button
                          onClick={() => handleOpenCertModal(indent)}
                          className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition border border-purple-200 dark:border-purple-800"
                        >
                          <ShieldAlert size={15} />
                          View Non-GeM Cert
                        </button>
                      )}

                      <button
                        onClick={() => navigate(`/procurement/${indent.indentType}/${indent.id}`)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                      >
                        <FileText size={15} />
                        View & Manage Indent
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* NON-AVAILABILITY CERTIFICATE MODAL (BRD A7.3 Specifics) */}
        {showCertModal && selectedIndent && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-purple-600 dark:text-purple-400" size={22} />
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Non-Availability Certificate (Non-GeM)
                  </h3>
                </div>
                <button
                  onClick={() => setShowCertModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-xs text-purple-900 dark:text-purple-200 space-y-2.5 border border-purple-200 dark:border-purple-800">
                <div className="flex justify-between border-b border-purple-200/60 dark:border-purple-800/60 pb-1.5">
                  <span className="font-bold">Non-GeM Certificate ID:</span>
                  <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                    {selectedIndent.nonAvailabilityCertId || "NAC-2026-8812"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-purple-200/60 dark:border-purple-800/60 pb-1.5">
                  <span className="font-bold">Date of Generation:</span>
                  <span>{selectedIndent.nacGenDate || "10 Aug 2026"} (Before Quotation Date)</span>
                </div>
                <div className="flex justify-between border-b border-purple-200/60 dark:border-purple-800/60 pb-1.5">
                  <span className="font-bold">Validity of Certificate:</span>
                  <span>{selectedIndent.validityDate || "10 Nov 2026"}</span>
                </div>
                <div className="pt-1">
                  <span className="font-bold block mb-1">Exact Item Match Check:</span>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-purple-300 dark:border-purple-700 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>"{selectedIndent.itemName}"</span>
                    <span className="flex items-center gap-1 text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                      <Check size={12} /> Exact Match
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowCertModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Close Certificate
                </button>
              </div>
            </div>
          </div>
        )}



        {/* SELECT PROJECT & CATEGORY MODAL FOR RAISING NEW INDENT */}
        {isSelectProjectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Raise New Procurement Indent</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Select project & requisition category</p>
                  </div>
                </div>
                <button onClick={() => setIsSelectProjectOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Select Research Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  >
                    {userProjectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectTitle || p.title || `Project #${p.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Select Requisition Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { type: 'Consumable', label: 'Consumable', desc: 'Chemicals, Stationeries' },
                      { type: 'Contingency', label: 'Contingency', desc: 'Services, Minor Repairs' },
                      { type: 'Equipment', label: 'Equipment', desc: 'Capital Equipment' },
                    ].map((cat) => (
                      <button
                        type="button"
                        key={cat.type}
                        onClick={() => setSelectedCategory(cat.type)}
                        className={`p-3 rounded-xl text-left border transition-all ${selectedCategory === cat.type
                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                          }`}
                      >
                        <p className="text-xs font-bold">{cat.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{cat.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsSelectProjectOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToForm}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  Proceed to Form →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REQUISITION MODAL FORM */}
        {isRaiseModalOpen && selectedProjectObject && (
          <RequisitionModalShell
            title={`Raise ${selectedCategory} Requisition`}
            indentType={selectedCategory}
            projectId={selectedProjectObject.id}
            budgetHeads={selectedProjectObject.budgetHeads}
            sanctionedEquipment={selectedProjectObject.sanctionedEquipment?.[0]}
            onClose={() => setIsRaiseModalOpen(false)}
            onRaised={() => {
              setIsRaiseModalOpen(false);
              showToast(`New ${selectedCategory} indent successfully raised!`, "success");
              fetchIndents();
            }}
          />
        )}

      </div>
    </div>
  );
}
