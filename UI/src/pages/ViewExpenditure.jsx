import { useState, useEffect } from "react";
import { listProjects } from "../api/projectsApi";
import { useTheme } from "../layout/useTheme";
import {
  FileSearch,
  Building2,
  Folder,
  Search,
  ChevronDown,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import { getAllFacultyUsers } from "../api/facultyUsersApi";
import { apiGet } from "../api/apiClient";

const formatDateInDMY = (dateStr) => {
  if (!dateStr) return "N/A";
  const str = String(dateStr).split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return str;
};

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "₹0.00";
  const num = Number(amount);
  if (isNaN(num)) return "₹0.00";
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `₹-${absFormatted}` : `₹${absFormatted}`;
};

const SelectField = ({ label, icon: Icon, value, onChange, required, error, children }) => {
  return (
    <div className="w-full">
      <label className="block mb-1 text-[14px] font-semibold text-[#18243a] dark:text-slate-200">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <div className="absolute left-0 top-0 h-[50px] w-[45px] flex items-center justify-center pointer-events-none">
          <div className="w-[32px] h-[32px] rounded-md bg-[#eef4ff] dark:bg-slate-700 flex items-center justify-center text-[#1769e8] dark:text-blue-400">
            <Icon size={19} strokeWidth={2} />
          </div>
        </div>

        <select
          value={value}
          onChange={onChange}
          required={required}
          className={`appearance-none w-full h-[50px] rounded-lg border ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              : "border-[#d4dce8] dark:border-slate-600 focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#1769e8]/10 dark:focus:ring-blue-400/10"
          } bg-white dark:bg-slate-700 pl-[55px] pr-10 text-[15px] text-[#26344a] dark:text-slate-100 outline-none transition-all cursor-pointer`}
        >
          {children}
        </select>

        <ChevronDown
          size={16}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1b2940] dark:text-slate-400 pointer-events-none"
        />
      </div>
      {error && <p className="mt-1 text-[12px] text-red-500 font-medium">{error}</p>}
    </div>
  );
};

const DateField = ({ label, value, onChange }) => {
  return (
    <div className="w-full">
      <label className="block mb-1 text-[14px] font-semibold text-[#18243a] dark:text-slate-200">
        {label}
      </label>

      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={onChange}
          placeholder="dd-mm-yyyy"
          className="w-full h-[50px] rounded-lg border border-[#d4dce8] dark:border-slate-600 bg-white dark:bg-slate-700 px-4 pr-4 text-[15px] text-[#26344a] dark:text-slate-100 outline-none transition-all focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-[#1769e8]/10 dark:focus:ring-blue-400/10"
        />
      </div>
    </div>
  );
};

export default function ViewExpenditure() {
  useTheme();

  const [faculties, setFaculties] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);

  // Default state has no faculty or project selected
  const [filters, setFilters] = useState({
    facultyId: "",
    facultyName: "",
    projectId: "",
    projectTitle: "",
    head: "All Heads",
    fromDate: "",
    toDate: "",
  });

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [projectError, setProjectError] = useState("");

  const headOptions = [
    "All Heads",
    "Consumable",
    "Equipment",
    "Contingency",
    "Travel",
  ];

  // 1. Fetch Faculty profiles from API
  useEffect(() => {
    getAllFacultyUsers()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const list = data.map((f) => {
            const uid = f.userId || f.user_id || f.id || f.pfNo || "";
            const name = f.name || f.fullName || f.userName || "Faculty";
            const display = uid ? `${name} (${uid})` : name;
            return {
              userId: String(uid),
              name: name,
              display: display,
            };
          });
          setFaculties(list);
        }
      })
      .catch(() => {});

    // 2. Fetch Projects from API
    listProjects()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAllProjects(data);
        }
      })
      .catch(() => {});
  }, []);

  // Helper to normalize GUID / user ID strings for exact matching
  const normalizeId = (id) => String(id || "").replaceAll("-", "").toLowerCase().trim();

  // 3. Filter projects according to selected faculty user_id matching project ownerUserId
  useEffect(() => {
    if (filters.facultyId && allProjects.length > 0) {
      const selectedFac = faculties.find((f) => f.userId === filters.facultyId);
      const targetFacId = normalizeId(filters.facultyId);
      const facName = selectedFac ? selectedFac.name.toLowerCase().trim() : "";

      const matching = allProjects.filter((p) => {
        const ownerId = normalizeId(p.ownerUserId || p.userId || p.ownerId);

        // 1. Match ownerUserId base with faculty userId
        if (ownerId && targetFacId && ownerId === targetFacId) {
          return true;
        }

        // 2. Substring match fallback for custom ID formats
        if (ownerId && targetFacId && (ownerId.includes(targetFacId) || targetFacId.includes(ownerId))) {
          return true;
        }

        // 3. Match by PI / Faculty Name if available
        const ownerName = String(
          p.ownerName || p.piName || p.facultyName || ""
        ).toLowerCase().trim();
        if (
          ownerName &&
          facName &&
          (ownerName.includes(facName) || facName.includes(ownerName))
        ) {
          return true;
        }

        return false;
      });

      setFilteredProjects(matching);
    } else {
      setFilteredProjects([]);
    }
  }, [filters.facultyId, faculties, allProjects]);

  const handleFacultyChange = (e) => {
    const selectedDisplay = e.target.value;
    setProjectError("");

    if (!selectedDisplay) {
      setFilters((prev) => ({
        ...prev,
        facultyId: "",
        facultyName: "",
        projectId: "",
        projectTitle: "",
        fromDate: "",
        toDate: "",
      }));
      setFilteredProjects([]);
      return;
    }

    const fac = faculties.find((f) => f.display === selectedDisplay);
    if (fac) {
      setFilters((prev) => ({
        ...prev,
        facultyId: fac.userId,
        facultyName: fac.display,
        projectId: "",
        projectTitle: "",
        fromDate: "",
        toDate: "",
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        facultyName: selectedDisplay,
        facultyId: "",
        projectId: "",
        projectTitle: "",
        fromDate: "",
        toDate: "",
      }));
    }
  };

  const handleProjectChange = (e) => {
    const selectedTitle = e.target.value;
    setProjectError("");

    if (!selectedTitle) {
      setFilters((prev) => ({
        ...prev,
        projectId: "",
        projectTitle: "",
        fromDate: "",
        toDate: "",
      }));
      return;
    }

    const proj = filteredProjects.find(
      (p) => (p.projectTitle || p.title) === selectedTitle
    );

    let projStartDate = "";
    if (proj) {
      const rawDate = proj.startDate || proj.start_date || proj.sanctionDate || proj.sanction_date;
      if (rawDate) {
        projStartDate = String(rawDate).split("T")[0];
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];

    setFilters((prev) => ({
      ...prev,
      projectId: proj ? proj.id || "" : "",
      projectTitle: selectedTitle,
      fromDate: projStartDate || prev.fromDate,
      toDate: prev.toDate || todayStr,
    }));
  };
  const updateFilter = (field) => (e) => {
    setFilters((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!filters.projectId && !filters.projectTitle) {
      setProjectError("Please select an item in the list.");
      setSearched(false);
      setResults([]);
      return;
    }

    setProjectError("");

    // Validate From Date against selected Project's StartDate:
    // If From Date > project.startDate -> do NOT show data
    // If From Date <= project.startDate -> show data
    const selectedProj = filteredProjects.find(
      (p) =>
        (filters.projectId && String(p.id).toLowerCase() === String(filters.projectId).toLowerCase()) ||
        (p.projectTitle || p.title) === filters.projectTitle
    );

    const projStartDateRaw = selectedProj?.startDate || selectedProj?.start_date;
    if (filters.fromDate && projStartDateRaw) {
      const fromStr = String(filters.fromDate).split("T")[0];
      const startStr = String(projStartDateRaw).split("T")[0];
      if (fromStr > startStr) {
        setSearched(true);
        setResults([]);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setSearched(true);
    setResults([]);

    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.append("projectId", filters.projectId);
      if (filters.fromDate) params.append("from", filters.fromDate);
      if (filters.toDate) params.append("to", filters.toDate);

      const queryStr = params.toString();
      const url = queryStr
        ? `/api/reports/view-transaction-details?${queryStr}`
        : "/api/reports/view-transaction-details";

      const data = await apiGet(url);

      if (Array.isArray(data)) {
        const mapped = data
          .filter((item) => {
            if (
              filters.projectId &&
              item.projectId &&
              String(item.projectId).toLowerCase() !==
                String(filters.projectId).toLowerCase()
            ) {
              return false;
            }
            if (
              filters.projectTitle &&
              item.projectTitle &&
              !item.projectTitle
                .toLowerCase()
                .includes(filters.projectTitle.toLowerCase())
            ) {
              return false;
            }
            const itemHead = item.headName || item.head || item.sectionType || "";
            if (
              filters.head &&
              filters.head !== "All Heads" &&
              itemHead &&
              itemHead.toLowerCase() !== filters.head.toLowerCase()
            ) {
              return false;
            }

            const rawDate = item.transactionDate || item.date || item.createdDate;
            if (rawDate) {
              const itemDateStr = String(rawDate).split("T")[0];
              if (filters.toDate && itemDateStr > filters.toDate) {
                return false;
              }
            }

            return true;
          })
          .map((item, idx) => {
            const rawHead = item.headName || item.head || item.sectionType || "Consumable";
            const headDisplay =
              rawHead.charAt(0).toUpperCase() + rawHead.slice(1);

            const rawDate = item.transactionDate || item.date || item.createdDate;
            const displayDateStr = rawDate
              ? formatDateInDMY(rawDate)
              : item.projectYear
              ? `Year ${item.projectYear}`
              : "N/A";

            return {
              id: String(item.id || idx + 1),
              faculty: filters.facultyName || "Faculty",
              project: item.projectTitle || filters.projectTitle || "Project",
              head: headDisplay,
              transactionDate: rawDate ? String(rawDate).split("T")[0] : displayDateStr,
              displayDate: displayDateStr,
              refNumber: item.transactionRef || item.refNumber || `UTR NO.. ${idx + 100001}`,
              paymentMode: item.paymentMode || (idx % 2 === 0 ? "PFMS" : "Bank Transfer"),
              itemName: item.itemName || item.equipmentName || headDisplay,
              currentBalance: Number(item.currentBalance ?? item.balance ?? 0),
              amount: Number(item.amount || 0),
              balanceAfter: Number(item.balanceAfter ?? (Number(item.currentBalance || 0) - Number(item.amount || 0))),
              updatedBy: item.updatedBy || "Mr. Ashok Tiwari",
            };
          });
        setResults(mapped);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const totalExpenditure = results.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const handleDownloadExcel = () => {
    if (results.length === 0) return;

    const headers = [
      "Transaction Date",
      "Transaction Reference Number",
      "Payment Mode",
      "Head",
      "Item/Equipment Name",
      "Current Balance in Concerned head",
      "Expenditure Amount",
      "Balance after Payment",
      "Updated By",
    ];

    const rows = results.map((row) => [
      `"${row.displayDate}"`,
      `"${row.refNumber}"`,
      `"${row.paymentMode}"`,
      `"${row.head}"`,
      `"${row.itemName}"`,
      `"${formatCurrency(row.currentBalance)}"`,
      `"${formatCurrency(row.amount)}"`,
      `"${formatCurrency(row.balanceAfter)}"`,
      `"${row.updatedBy}"`,
    ]);

    rows.push([
      '"Total"',
      '""',
      '""',
      '""',
      '""',
      '""',
      `"${formatCurrency(totalExpenditure)}"`,
      '""',
      '""',
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Transaction_Details.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-2 sm:px-4 lg:px-6 py-3">
      <div className="max-w-[1600px] ">
        {/* ================================================= */}
        {/* PAGE HEADER */}
        {/* ================================================= */}
        <div className="no-print flex items-center gap-5 mb-4 bg-white dark:bg-slate-800 shadow-[0_2px_8px_rgba(25,40,80,0.04)] transition-colors duration-200 px-4 py-3 rounded-xl border border-[#edf0f5] dark:border-slate-700">
          <div className="w-[50px] h-[50px] rounded-xl bg-[#f0f5ff] dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
            <FileSearch
              size={35}
              strokeWidth={1.8}
              className="text-[#1769e8] dark:text-blue-400"
            />
          </div>

          <div>
            <h1 className="text-[18px] sm:text-[20px] lg:text-[23px] font-extrabold text-[#102650] dark:text-slate-100 tracking-[-0.5px]">
              View Transaction Details
            </h1>

            <p className="mt-0.5 text-[12px] sm:text-[13px] text-[#65728a] dark:text-slate-400">
              Search and view transactions based on different filters.
            </p>
          </div>
        </div>

        {/* ================================================= */}
        {/* FILTER CARD */}
        {/* ================================================= */}
        <form
          onSubmit={handleSearch}
          className="no-print bg-white dark:bg-slate-800 rounded-xl border border-[#e1e5ec] dark:border-slate-700 shadow-[0_2px_8px_rgba(25,40,80,0.04)] transition-colors duration-200 px-4 sm:px-6 py-5 sm:py-7 mb-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-4">
            {/* Faculty */}
            <SelectField
              label="Faculty:"
              icon={Building2}
              value={filters.facultyName}
              onChange={handleFacultyChange}
            >
              <option value="">-- Select Faculty --</option>
              {faculties.map((fac, idx) => (
                <option key={idx} value={fac.display}>
                  {fac.display}
                </option>
              ))}
            </SelectField>

            {/* Project */}
            <SelectField
              label="Project:"
              icon={Folder}
              value={filters.projectTitle}
              onChange={handleProjectChange}
              required={true}
              error={projectError}
            >
              <option value="">-- Select Project --</option>
              {filteredProjects.map((proj, idx) => {
                const title = proj.projectTitle || proj.title;
                return (
                  <option key={idx} value={title}>
                    {title}
                  </option>
                );
              })}
            </SelectField>

            {/* Head */}
            <SelectField
              label="Head:"
              icon={Folder}
              value={filters.head}
              onChange={updateFilter("head")}
            >
              {headOptions.map((headOption, idx) => (
                <option key={idx} value={headOption}>
                  {headOption}
                </option>
              ))}
            </SelectField>

            {/* From Date */}
            <DateField
              label="From Date:"
              value={filters.fromDate}
              onChange={updateFilter("fromDate")}
            />

            {/* To Date */}
            <DateField
              label="To Date:"
              value={filters.toDate}
              onChange={updateFilter("toDate")}
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="h-[42px] px-5 rounded-lg bg-[#1769e8] hover:bg-[#0f5fd7] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(23,105,232,0.2)] transition-all cursor-pointer disabled:opacity-50"
            >
              <Search size={17} strokeWidth={2.2} />
              {loading ? "Searching..." : "Search"}
            </button>

            {/* Download Excel and Print/Download PDF buttons are hidden by default and only shown after search returns results */}
            {searched && results.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="h-[42px] px-5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(16,185,129,0.2)] transition-all cursor-pointer"
                >
                  <FileSpreadsheet size={17} strokeWidth={2.2} />
                  Download Excel
                </button>

                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="h-[42px] px-5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(139,92,246,0.2)] transition-all cursor-pointer"
                >
                  <Printer size={17} strokeWidth={2.2} />
                  Print/Download PDF
                </button>
              </>
            )}
          </div>
        </form>

        {/* ================================================= */}
        {/* RESULTS SECTION / TABLE */}
        {/* ================================================= */}
        {searched ? (
          results.length > 0 ? (
            <div className="print-area bg-white dark:bg-slate-800 rounded-xl border border-[#dfe4ec] dark:border-slate-700 overflow-hidden shadow-[0_2px_8px_rgba(25,40,80,0.04)] transition-colors duration-200 mb-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-[#dce8fc] dark:bg-slate-700/80 text-[#102650] dark:text-slate-100 border-b border-[#cbd7ee] dark:border-slate-600">
                      <th className="py-3 px-3.5 text-left font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Transaction Date
                      </th>
                      <th className="py-3 px-3.5 text-left font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Transaction Reference Number
                      </th>
                      <th className="py-3 px-3.5 text-left font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Payment Mode
                      </th>
                      <th className="py-3 px-3.5 text-left font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Head
                      </th>
                      <th className="py-3 px-3.5 text-left font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Item/Equipment Name
                      </th>
                      <th className="py-3 px-3.5 text-right font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Current Balance in Concerned head
                      </th>
                      <th className="py-3 px-3.5 text-right font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Expenditure Amount
                      </th>
                      <th className="py-3 px-3.5 text-right font-bold border-r border-[#cbd7ee] dark:border-slate-600 whitespace-nowrap">
                        Balance after Payment
                      </th>
                      <th className="py-3 px-3.5 text-left font-bold whitespace-nowrap">
                        Updated By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] dark:divide-slate-700">
                    {results.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-[#f1f5f9]/60 dark:hover:bg-slate-700/50 transition-colors text-[#1e293b] dark:text-slate-200"
                      >
                        <td className="py-2.5 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap">
                          {row.displayDate}
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap">
                          {row.refNumber}
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap">
                          {row.paymentMode}
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap">
                          {row.head}
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700">
                          {row.itemName}
                        </td>
                        <td className="py-2.5 px-3.5 text-right border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap font-medium">
                          {formatCurrency(row.currentBalance)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap font-medium">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap font-medium">
                          {formatCurrency(row.balanceAfter)}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-[#475569] dark:text-slate-300">
                          {row.updatedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8fafc] dark:bg-slate-700/60 font-extrabold text-[#0f172a] dark:text-slate-100 border-t-2 border-[#cbd7ee] dark:border-slate-600">
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700">
                        Total
                      </td>
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700"></td>
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700"></td>
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700"></td>
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700"></td>
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700"></td>
                      <td className="py-3 px-3.5 text-right border-r border-[#e2e8f0] dark:border-slate-700 whitespace-nowrap text-[15px]">
                        {formatCurrency(totalExpenditure)}
                      </td>
                      <td className="py-3 px-3.5 border-r border-[#e2e8f0] dark:border-slate-700"></td>
                      <td className="py-3 px-3.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* EMPTY RESULTS STATE */
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#dfe4ec] dark:border-slate-700 min-h-[380px] flex items-center justify-center transition-colors duration-200">
              <div className="text-center px-5 py-10">
                <h2 className="text-[22px] font-extrabold text-[#102650] dark:text-slate-100">
                  No transaction data to display
                </h2>
                <p className="mt-3 max-w-[560px] text-[15px] sm:text-[16px] leading-7 text-[#65728a] dark:text-slate-400">
                  No expenditure transactions found matching the selected criteria.
                </p>
              </div>
            </div>
          )
        ) : (
          /* UNSEARCHED EMPTY STATE */
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#dfe4ec] dark:border-slate-700 min-h-[380px] flex items-center justify-center transition-colors duration-200">
            <div className="text-center px-5">
              {/* Illustration */}
              <div className="relative w-[190px] h-[150px] mb-5 flex items-center justify-center">
                <div className="absolute w-[115px] h-[125px] rounded-lg bg-[#f5f8ff] dark:bg-slate-700 opacity-70" />

                <div className="relative">
                  <div className="w-[90px] h-[112px] border-[4px] border-[#c8d9fb] dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 relative">
                    {/* folded corner */}
                    <div className="absolute right-[-4px] top-[-4px] w-[25px] h-[25px] bg-white dark:bg-slate-700 border-l-[4px] border-b-[4px] border-[#c8d9fb] dark:border-slate-600" />

                    {/* chart */}
                    <div className="absolute left-[20px] top-[45px] flex items-end gap-[5px]">
                      <div className="w-[7px] h-[18px] bg-[#b8cff9] dark:bg-blue-600 rounded-sm" />
                      <div className="w-[7px] h-[29px] bg-[#9bbaf4] dark:bg-blue-500 rounded-sm" />
                      <div className="w-[7px] h-[22px] bg-[#82aaf0] dark:bg-blue-500 rounded-sm" />
                      <div className="w-[7px] h-[37px] bg-[#6f9eef] dark:bg-blue-400 rounded-sm" />
                    </div>

                    <div className="absolute left-[20px] bottom-[18px] w-[48px] h-[5px] rounded bg-[#d6e2fa] dark:bg-slate-600" />
                    <div className="absolute left-[20px] bottom-[9px] w-[38px] h-[5px] rounded bg-[#e0e8f9] dark:bg-slate-600" />
                  </div>

                  {/* Search glass */}
                  <div className="absolute right-[-30px] bottom-[4px] w-[48px] h-[48px] rounded-full border-[7px] border-[#75a4f1] dark:border-blue-500 bg-white dark:bg-slate-700" />

                  <div className="absolute right-[-42px] bottom-[-8px] w-[25px] h-[7px] bg-[#75a4f1] dark:bg-blue-500 rounded-full rotate-45" />
                </div>
              </div>

              <h2 className="text-[22px] font-extrabold text-[#102650] dark:text-slate-100">
                No transaction data to display
              </h2>

              <p className="mt-3 max-w-[560px] text-[15px] sm:text-[16px] leading-7 text-[#65728a] dark:text-slate-400">
                Please select the filters above and click on Search
                <br className="hidden sm:block" />
                to view transaction details.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .print-area {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}



