import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../layout/useTheme";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadAnnouncementPdf,
} from "../api/announcementsApi";
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  Folder,
  CheckCircle2,
  Clock3,
  Edit3,
  Trash2,
  Paperclip,
  Send,
  X,
  ExternalLink,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://localhost:7054";

function getPdfUrl(pdfPath) {
  if (!pdfPath) return null;
  if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
    return pdfPath;
  }
  const cleanPath = pdfPath.startsWith("/") ? pdfPath.slice(1) : pdfPath;
  return `${API_BASE_URL}/${cleanPath}`;
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function mapBackendToUI(item) {
  let categoryDisplay = "Job";
  const cat = (item.category || "").toLowerCase();
  if (cat === "proposal" || cat === "callforproposal") {
    categoryDisplay = "Callforproposal";
  } else if (cat === "project" || cat === "sanctioned") {
    categoryDisplay = "Sanctioned";
  }

  let statusDisplay = "Active";
  const st = (item.status || "").toLowerCase();
  if (st === "inactive" || st === "expired") {
    statusDisplay = "Expired";
  }

  return {
    id: item.id,
    title: item.title || "",
    category: categoryDisplay,
    startDate: item.startDate || item.start_date || "",
    endDate: item.endDate || item.end_date || "",
    fundingAmount: item.fundingAmount ?? item.funding_amount ?? 0,
    pdfPath: item.pdfPath || item.pdf_path || "",
    externalLink: item.externalLink || item.external_link || "",
    status: statusDisplay,
    description: item.description || "",
    createdBy: item.createdBy || item.created_by || null,
    createdAt: item.createdAt || item.created_at || "",
    updatedAt: item.updatedAt || item.updated_at || "",
  };
}

const emptyForm = {
  id: null,
  title: "",
  category: "Job",
  startDate: "",
  endDate: "",
  file: null,
  pdfPath: "",
  externalLink: "",
  fundingAmount: "0.00",
  status: "Active",
  description: "",
};

function ManageAnnouncements() {
  useTheme();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  /* TOASTER NOTIFICATIONS */
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: "success", message: "" });
    }, 4000);
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const [form, setForm] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);

  /* FILE INPUT RESET REF & KEY */
  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const todayStr = useMemo(() => getTodayString(), []);

  /* =========================================
     FETCH DATA FROM BACKEND API
  ========================================= */

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnnouncements();
      const mapped = (data || []).map(mapBackendToUI);
      setAnnouncements(mapped);
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
      // Error is shown via the global toast notification
      showToast("error", err.message || "Failed to fetch announcements from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  /* =========================================
     STATISTICS
  ========================================= */

  const totalAnnouncements = announcements.length;

  const activeAnnouncements = announcements.filter(
    (item) => item.status === "Active"
  ).length;

  const expiredAnnouncements = announcements.filter(
    (item) => item.status === "Expired"
  ).length;

  const totalCategories = new Set(announcements.map((item) => item.category)).size;

  /* =========================================
     SEARCH + FILTER
  ========================================= */

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const searchMatch = item.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const statusMatch =
        statusFilter === "All Status" || item.status === statusFilter;

      return searchMatch && statusMatch;
    });
  }, [announcements, search, statusFilter]);

  /* =========================================
     PAGINATION
  ========================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAnnouncements.length / rowsPerPage)
  );

  const startIndex = (currentPage - 1) * rowsPerPage;

  const currentAnnouncements = filteredAnnouncements.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  /* =========================================
     FORM INPUT HANDLERS
  ========================================= */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    setForm((prev) => ({
      ...prev,
      file: e.target.files[0] || null,
    }));
  };

  /* =========================================
     CLEAR FORM DATA & RESET FILE INPUT
  ========================================= */

  const clearForm = () => {
    setForm(emptyForm);
    setIsEditing(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFileInputKey((prev) => prev + 1);
  };

  /* =========================================
     ADD BUTTON CLICK
  ========================================= */

  const handleAddClick = () => {
    clearForm();

    setTimeout(() => {
      document.getElementById("announcement-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  /* =========================================
     EDIT ANNOUNCEMENT
  ========================================= */

  const handleEdit = (announcement) => {
    setForm({
      id: announcement.id,
      title: announcement.title,
      category: announcement.category,
      startDate: announcement.startDate,
      endDate: announcement.endDate,
      file: null,
      pdfPath: announcement.pdfPath || "",
      externalLink: announcement.externalLink || "",
      fundingAmount: announcement.fundingAmount || "0.00",
      status: announcement.status,
      description: announcement.description || "",
    });

    setIsEditing(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFileInputKey((prev) => prev + 1);

    setTimeout(() => {
      document.getElementById("announcement-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  /* =========================================
     DELETE ANNOUNCEMENT
  ========================================= */

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this announcement?"
    );

    if (!confirmDelete) return;

    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((item) => item.id !== id));

      if (form.id === id) {
        clearForm();
      }
      showToast("success", "Announcement deleted successfully!");
    } catch (err) {
      console.error("Failed to delete announcement:", err);
      showToast("error", err.message || "Failed to delete announcement.");
    }
  };

  /* =========================================
     SUBMIT FORM (CREATE / UPDATE)
  ========================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      showToast("error", "Please enter announcement title.");
      return;
    }

    /* DATE VALIDATIONS */
    if (form.startDate && form.startDate < todayStr) {
      showToast("error", "Start Date cannot be a past date.");
      return;
    }

    if (form.endDate && form.endDate < todayStr) {
      showToast("error", "End Date cannot be a past date.");
      return;
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      showToast("error", "End Date cannot be prior to Start Date.");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPdfPath = form.pdfPath || null;

      if (form.file) {
        const uploadRes = await uploadAnnouncementPdf(form.file);
        if (uploadRes && uploadRes.pdfPath) {
          uploadedPdfPath = uploadRes.pdfPath;
        }
      }

      let backendCategory = "job";
      if (form.category === "Callforproposal") {
        backendCategory = "proposal";
      } else if (form.category === "Sanctioned") {
        backendCategory = "project";
      }

      let backendStatus = "active";
      if (form.status === "Expired") {
        backendStatus = "inactive";
      }

      const payload = {
        title: form.title.trim(),
        description: form.description ? form.description.trim() : null,
        category: backendCategory,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        fundingAmount: parseFloat(form.fundingAmount) || 0,
        pdfPath: uploadedPdfPath,
        externalLink: form.externalLink ? form.externalLink.trim() : null,
        status: backendStatus,
      };

      if (form.id) {
        await updateAnnouncement(form.id, payload);
        showToast("success", "Announcement updated successfully!");
      } else {
        await createAnnouncement(payload);
        showToast("success", "Announcement added successfully!");
      }

      clearForm();
      await loadAnnouncements();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error("Error submitting form:", err);
      showToast("error", err.message || "Failed to save announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================
     FORMAT DATE
  ========================================= */

  const formatDate = (dateStr) => {
    if (!dateStr) return "";

    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return `${months[Number(month) - 1]} ${Number(day)}, ${year}`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200">
      {/* FLOATING TOASTER NOTIFICATION */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border transition-all duration-300 transform translate-y-0 ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-slate-800 border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-slate-800 border-rose-300 dark:border-rose-600 text-rose-800 dark:text-rose-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2
              size={18}
              className="text-emerald-600 dark:text-emerald-400 shrink-0"
            />
          ) : (
            <AlertCircle
              size={18}
              className="text-rose-600 dark:text-rose-400 shrink-0"
            />
          )}
          <span className="text-[12px] font-semibold">{toast.message}</span>
          <button
            type="button"
            onClick={() =>
              setToast({ show: false, type: "success", message: "" })
            }
            className="ml-2 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* =====================================================
          MAIN CONTAINER
      ====================================================== */}

      <div className="w-full px-2 sm:px-4 lg:px-6 py-3">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-[24px] sm:text-[26px] font-extrabold text-[#102650] dark:text-slate-100 tracking-[-0.5px]">
              Manage Announcements
            </h1>

            <p className="text-[11px] sm:text-[12px] text-[#65728a] dark:text-slate-400 mt-1">
              Create, update and manage all job and project announcements.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddClick}
            className="self-start flex items-center gap-2 bg-[#4058df] hover:bg-[#3049d0] text-white px-4 py-2.5 rounded-md text-[11px] font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus size={16} />
            Add Announcement
          </button>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={loadAnnouncements}
              className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-medium hover:bg-red-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* =====================================================
            STATISTICS + SEARCH
        ====================================================== */}

        <div className="mt-5 flex flex-col xl:flex-row gap-3">
          {/* STAT CARDS */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            <StatCard
              title="Total Announcements"
              value={totalAnnouncements}
              icon={<Megaphone size={21} />}
              type="blue"
            />

            <StatCard
              title="Active"
              value={activeAnnouncements}
              icon={<CheckCircle2 size={21} />}
              type="green"
            />

            <StatCard
              title="Expired"
              value={expiredAnnouncements}
              icon={<Clock3 size={21} />}
              type="orange"
            />

            <StatCard
              title="Total Categories"
              value={totalCategories}
              icon={<Folder size={21} />}
              type="purple"
            />
          </div>

          {/* SEARCH FILTER */}

          <div className="flex gap-3 xl:w-[435px]">
            <div className="relative w-full md:w-[270px] h-[36px]">
              <Search
                size={16}
                strokeWidth={1.8}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-slate-400 pointer-events-none"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search announcements..."
                className="w-full h-full bg-white dark:bg-slate-700 border border-[#dce2ec] dark:border-slate-600 rounded-md pl-9 pr-3 text-[11px] text-[#334155] dark:text-slate-200 placeholder:text-[#94a3b8] dark:placeholder:text-slate-400 outline-none focus:border-[#6073e8] dark:focus:border-blue-400 focus:ring-0"
              />
            </div>
            <div className="relative w-full md:w-[150px] h-[36px]">
              <Filter
                size={13}
                strokeWidth={1.8}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#617087] dark:text-slate-400 pointer-events-none"
              />

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none w-full h-[36px] bg-white dark:bg-slate-700 border border-[#dce2ec] dark:border-slate-600 rounded-md pl-8 pr-8 text-[11px] text-[#334155] dark:text-slate-200 outline-none cursor-pointer"
              >
                <option>All Status</option>
                <option>Active</option>
                <option>Expired</option>
              </select>

              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#617087] dark:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* =====================================================
            TABLE
        ====================================================== */}

        <div className="mt-3 bg-white dark:bg-slate-800 border border-[#e5e9f0] dark:border-slate-700 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(25,40,80,0.04)] transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse">
              {/* TABLE HEADER */}

              <thead>
                <tr className="bg-[#f5f4fb] dark:bg-slate-700">
                  <th className="text-left px-4 py-3 text-[13px] font-bold text-[#1b2b4b] dark:text-slate-200">
                    Title
                  </th>

                  <th className="text-left px-4 py-3 text-[13px] font-bold text-[#1b2b4b] dark:text-slate-200">
                    Category
                  </th>

                  <th className="text-left px-4 py-3 text-[13px] font-bold text-[#1b2b4b] dark:text-slate-200">
                    Dates
                  </th>

                  <th className="text-left px-4 py-3 text-[13px] font-bold text-[#1b2b4b] dark:text-slate-200">
                    Status
                  </th>

                  <th className="text-center px-4 py-3 text-[13px] font-bold text-[#1b2b4b] dark:text-slate-200">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-12 text-slate-500"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2
                          className="animate-spin text-blue-600"
                          size={18}
                        />
                        <span className="text-[12px]">
                          Loading announcements from database...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentAnnouncements.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[#edf0f4] dark:border-slate-700 hover:bg-[#fafbff] dark:hover:bg-slate-700 transition"
                    >
                      {/* TITLE */}

                      <td className="px-4 py-[6px]">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              item.category === "Sanctioned"
                                ? "bg-[#eef3ff] dark:bg-slate-700 text-[#4b70d8] dark:text-blue-400"
                                : item.category === "Callforproposal"
                                  ? "bg-[#f0e8ff] dark:bg-slate-700 text-[#8551dd] dark:text-purple-400"
                                  : "bg-[#fff2e2] dark:bg-slate-700 text-[#ff951c] dark:text-orange-400"
                            }`}
                          >
                            {item.category === "Sanctioned" ? (
                              <FileText size={16} />
                            ) : item.category === "Callforproposal" ? (
                              <Megaphone size={16} />
                            ) : (
                              <Folder size={16} />
                            )}
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[12px] font-semibold text-[#26324a] dark:text-slate-200 leading-[1.3]">
                              {item.title}
                            </span>
                            {item.description && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[450px]">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CATEGORY */}

                      <td className="px-4 py-[6px]">
                        <span
                          className={`inline-flex px-3 py-[3px] rounded-full text-[11px] font-semibold ${
                            item.category === "Sanctioned"
                              ? "bg-[#edf4ff] dark:bg-slate-700 text-[#3471dc] dark:text-blue-400 border border-[#d6e5ff] dark:border-slate-600"
                              : item.category === "Callforproposal"
                                ? "bg-[#f0e8ff] dark:bg-slate-700 text-[#8551dd] dark:text-purple-400 border border-[#e8dcfa] dark:border-slate-600"
                                : "bg-[#fff5e8] dark:bg-slate-700 text-[#f18b1b] dark:text-orange-400 border border-[#ffe1ba] dark:border-slate-600"
                          }`}
                        >
                          {item.category === "Job"
                            ? "Job Announcement"
                            : item.category === "Callforproposal"
                              ? "Call for Proposal"
                              : "Sanctioned Research Project"}
                        </span>
                      </td>

                      {/* DATES */}

                      <td className="px-4 py-[6px]">
                        <div className="flex items-center gap-2 whitespace-nowrap text-[12px] text-[#4f5c73] dark:text-slate-300">
                          <CalendarDays size={15} />

                          {formatDate(item.startDate) || "N/A"}

                          {item.endDate && (
                            <>
                              {" - "}
                              {formatDate(item.endDate)}
                            </>
                          )}
                        </div>
                      </td>

                      {/* STATUS */}

                      <td className="px-4 py-[6px]">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-[4px] rounded-full text-[11px] font-semibold ${
                            item.status === "Active"
                              ? "bg-[#e8f9ee] dark:bg-slate-700 text-[#159447] dark:text-green-400 border border-[#c8efd5] dark:border-slate-600"
                              : "bg-[#fff0f0] dark:bg-slate-700 text-[#e84b4b] dark:text-red-400 border border-[#ffd5d5] dark:border-slate-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === "Active"
                                ? "bg-[#19a451]"
                                : "bg-[#ed4b4b]"
                            }`}
                          />

                          {item.status}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td className="px-4 py-[6px]">
                        <div className="flex justify-center items-center gap-1.5">
                          {item.pdfPath && (
                            <a
                              href={getPdfUrl(item.pdfPath)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-[31px] h-[27px] rounded-md border border-[#d1efdd] dark:border-slate-600 bg-white dark:bg-slate-700 text-[#18a052] dark:text-green-400 hover:bg-[#e5f8eb] dark:hover:bg-slate-600 flex items-center justify-center transition"
                              title="View / Download Attached PDF"
                            >
                              <Download size={14} />
                            </a>
                          )}

                          {item.externalLink && (
                            <a
                              href={item.externalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-[31px] h-[27px] rounded-md border border-[#e8dcfa] dark:border-slate-600 bg-white dark:bg-slate-700 text-[#8551dd] dark:text-purple-400 hover:bg-[#f0e8ff] dark:hover:bg-slate-600 flex items-center justify-center transition"
                              title="Open External Link"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="w-[31px] h-[27px] rounded-md border border-[#d6e0f5] dark:border-slate-600 bg-white dark:bg-slate-700 text-[#4b70dc] dark:text-blue-400 hover:bg-[#eff4ff] dark:hover:bg-slate-600 flex items-center justify-center transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="w-[31px] h-[27px] rounded-md border border-[#ffd5d5] dark:border-slate-600 bg-white dark:bg-slate-700 text-[#f34848] dark:text-red-400 hover:bg-[#fff0f0] dark:hover:bg-slate-600 flex items-center justify-center transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {!loading && currentAnnouncements.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-12 text-[12px] text-[#7c8799]"
                    >
                      No announcements found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* =================================================
              TABLE FOOTER
          ================================================== */}

          <div className="border-t border-[#edf0f4] dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-[12px] text-[#5d6a81] dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold">
                {filteredAnnouncements.length === 0 ? 0 : startIndex + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold">
                {Math.min(
                  startIndex + rowsPerPage,
                  filteredAnnouncements.length,
                )}
              </span>{" "}
              of{" "}
              <span className="font-semibold">
                {filteredAnnouncements.length}
              </span>{" "}
              entries
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="w-7 h-7 rounded-full border border-[#e4e8ef] dark:border-slate-600 flex items-center justify-center text-[#657189] dark:text-slate-400 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (page) => (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-full text-[10px] font-semibold cursor-pointer ${
                      currentPage === page
                        ? "bg-[#4058df] text-white"
                        : "border border-[#e4e8ef] dark:border-slate-600 text-[#526077] dark:text-slate-400 hover:bg-[#f4f6fb] dark:hover:bg-slate-700"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                className="w-7 h-7 rounded-full border border-[#e4e8ef] dark:border-slate-600 flex items-center justify-center text-[#657189] dark:text-slate-400 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            ADD / EDIT FORM
        ====================================================== */}

        <section id="announcement-form" className="mt-3 mb-6">
          <div className="bg-white dark:bg-slate-800 border border-[#e5e9f0] dark:border-slate-700 rounded-xl shadow-[0_2px_8px_rgba(25,40,80,0.04)] p-3 sm:p-4 transition-colors duration-200">
            {/* FORM HEADER */}

            <div className="flex items-start gap-4 mb-4">
              <div>
                <h2 className="text-[20px] sm:text-[21px] font-extrabold text-[#102650] dark:text-slate-100">
                  {form.id ? "Edit Announcement" : "Add New Announcement"}
                </h2>

                <p className="text-[11px] sm:text-[12px] text-[#69768c] dark:text-slate-400 mt-0.5">
                  Fill in the details to {form.id ? "update" : "create"} a new
                  announcement.
                </p>
              </div>
            </div>

            {/* FORM */}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-2">
                {/* TITLE */}

                <FormField label="Title" required className="text-[14px]">
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Enter announcement title"
                    className="input-style placeholder:text-[13px]"
                    required
                  />
                </FormField>

                {/* CATEGORY */}

                <FormField label="Category" required>
                  <div className="relative">
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className="input-style appearance-none pr-10 cursor-pointer"
                    >
                      <option value="Job">Job Announcement</option>

                      <option value="Callforproposal">
                        Call for Proposal{" "}
                      </option>

                      <option value="Sanctioned">
                        Sanctioned Research Project{" "}
                      </option>
                    </select>

                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#607087] dark:text-slate-400"
                    />
                  </div>
                </FormField>

                {/* START DATE (MIN = TODAY) */}

                <FormField label="Start Date">
                  <div className="relative">
                    <input
                      type="date"
                      name="startDate"
                      min={todayStr}
                      value={form.startDate}
                      onChange={handleChange}
                      className="input-style cursor-pointer"
                    />
                  </div>
                </FormField>

                {/* END DATE (MIN = START DATE OR TODAY) */}

                <FormField label="End Date">
                  <input
                    type="date"
                    name="endDate"
                    min={form.startDate || todayStr}
                    value={form.endDate}
                    onChange={handleChange}
                    className="input-style cursor-pointer"
                  />
                </FormField>

                {/* PDF FILE UPLOAD WITH REF & KEY RESET */}

                <FormField label="PDF File (Optional)">
                  <div className="h-[35px] border border-[#dce2eb] dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 flex items-center overflow-hidden px-2 gap-2">
                    <Paperclip
                      size={14}
                      className="text-[#718096] dark:text-slate-400 shrink-0"
                    />
                    <input
                      key={fileInputKey}
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="text-[10px] text-[#68758a] dark:text-slate-300 file:mr-3 file:h-[26px] file:px-3 file:border file:border-[#d8dee8] dark:file:border-slate-600 file:rounded-md file:bg-[#f8f9fb] dark:file:bg-slate-600 file:text-[10px] file:font-medium cursor-pointer"
                    />
                    {form.pdfPath && !form.file && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[120px]">
                        Attached
                      </span>
                    )}
                  </div>
                </FormField>

                {/* EXTERNAL LINK */}

                <FormField label="External Link (Optional)">
                  <input
                    type="url"
                    name="externalLink"
                    value={form.externalLink}
                    onChange={handleChange}
                    placeholder="https://example.com/announcement"
                    className="input-style placeholder:text-[13px]"
                  />
                </FormField>

                {/* STATUS */}

                <FormField label="Status" required>
                  <div className="relative">
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      className="input-style appearance-none pr-10 cursor-pointer"
                    >
                      <option value="Active">Active</option>

                      <option value="Expired">Expired</option>
                    </select>

                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#607087] dark:text-slate-400"
                    />
                  </div>
                </FormField>
              </div>

              {/* DESCRIPTION */}

              <div className="mt-3">
                <FormField label="Description">
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter announcement description..."
                    className="input-style resize-y h-auto placeholder:text-[14px] min-h-[60px]"
                  />
                </FormField>
              </div>

              {/* SUBMIT BUTTONS */}

              <div className="mt-3 flex items-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-[#4058df] hover:bg-[#3049d0] text-white px-4 py-2 rounded-md text-[12px] sm:text-[13px] font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}

                  {form.id ? "Update Announcement" : "Add Announcement"}
                </button>

                {/* CANCEL BUTTON */}
                {isEditing && (
                  <button
                    type="button"
                    onClick={clearForm}
                    className="ml-2 inline-flex items-center gap-2 bg-white dark:bg-slate-700 hover:bg-[#f5f6f8] dark:hover:bg-slate-600 text-[#566277] dark:text-slate-200 border border-[#dce2eb] dark:border-slate-600 px-4 py-2 rounded-md text-[12px] sm:text-[13px] font-semibold transition cursor-pointer"
                  >
                    <X size={13} />
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* =====================================================
          CUSTOM INPUT CSS
      ====================================================== */}

      <style>{`

        .input-style {
          width: 100%;
          height: 35px;
          border: 1px solid #dce2eb;
          border-radius: 6px;
          background: #ffffff;
          padding: 0 10px;
          color: #28364e;
          font-size: 12px;
          outline: none;
          transition: all 0.2s ease;
        }

        .input-style::placeholder {
          color: #9ba6b8;
        }

        .input-style:focus {
          border-color: #6073e8;
          box-shadow: 0 0 0 2px rgba(96, 115, 232, 0.08);
        }

        .dark .input-style {
          background: #1e293b;
          border-color: #475569;
          color: #e2e8f0;
        }

        .dark .input-style::placeholder {
          color: #94a3b8;
        }

        .dark .input-style:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
        }

        input[type="date"] {
          color: #68758a;
        }

        .dark input[type="date"] {
          color: #e2e8f0;
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.7;
        }

        select {
          cursor: pointer;
        }

      `}</style>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({ title, value, icon, type }) {
  const cardStyles = {
    blue: {
      container: "border-[#d4e2ff] dark:border-slate-600 bg-[#f5f8ff] dark:bg-slate-700",
      icon: "bg-[#eaf1ff] dark:bg-slate-600 text-[#4671dd] dark:text-blue-400",
    },

    green: {
      container: "border-[#d1efdd] dark:border-slate-600 bg-[#f5fcf8] dark:bg-slate-700",
      icon: "bg-[#e5f8eb] dark:bg-slate-600 text-[#18a052] dark:text-green-400",
    },

    orange: {
      container: "border-[#f5dfc5] dark:border-slate-600 bg-[#fffaf5] dark:bg-slate-700",
      icon: "bg-[#fff0dd] dark:bg-slate-600 text-[#e58b1f] dark:text-orange-400",
    },

    purple: {
      container: "border-[#e8dcfa] dark:border-slate-600 bg-[#fbf8ff] dark:bg-slate-700",
      icon: "bg-[#f0e8ff] dark:bg-slate-600 text-[#8551dd] dark:text-purple-400",
    },
  };

  return (
    <div
      className={`h-[57px] rounded-lg border flex items-center gap-3 px-3 ${cardStyles[type].container}`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${cardStyles[type].icon}`}
      >
        {icon}
      </div>

      <div>
        <p className="text-[9px] text-[#69758b] dark:text-slate-400">{title}</p>

        <p className="text-[18px] leading-none font-extrabold text-[#17294c] dark:text-slate-100 mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({ label, required = false, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-[12px] font-semibold text-[#35425a] dark:text-slate-200 mb-1">
        {label}

        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {children}
    </div>
  );
}

export default ManageAnnouncements;
