import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../layout/useTheme";
import {
  Plane,
  CheckCircle2,
  Search,
  Filter,
  UserCheck,
  Building2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Clock,
  ArrowRight
} from "lucide-react";
import { listAllTravelRequests } from "../api/travelApi";

export default function TravelApprovalPage() {
  useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [travels, setTravels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchTravels = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await listAllTravelRequests();
      if (rows && rows.length > 0) {
        setTravels(rows);
      } else {
        setTravels([]);
      }
    } catch (err) {
      console.error("Error loading travel requests", err);
      setError("Failed to load travel requests from backend server.");
      setTravels([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTravels();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTravels();
  };

  const filteredTravels = useMemo(() => {
    return travels.filter((item) => {
      const statusCategory = item.currentStage === "Approved" || item.currentStage === "TravelApproved"
        ? "APPROVED"
        : (item.currentStage === "Rejected" || item.currentStage === "Cancelled" ? "CLOSED" : "PENDING");
      
      const matchesStatus = filterStatus === "ALL" || statusCategory === filterStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.projectName && item.projectName.toLowerCase().includes(q)) ||
        (item.facultyName && item.facultyName.toLowerCase().includes(q)) ||
        (item.purpose && item.purpose.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [travels, filterStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-3 sm:px-6 py-5">
      <div className="max-w-[1530px] space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-slate-700 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Plane size={30} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Travel Request Approvals
                </h1>
                <span className="bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Workflow Queue
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Review and approve travel requests from faculty and staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
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
            <button onClick={fetchTravels} className="underline font-bold">Retry</button>
          </div>
        )}

        {/* FILTERS & SEARCH */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 w-full ">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by Project, Name, or Purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Status:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                {["ALL", "PENDING", "APPROVED", "CLOSED"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterStatus(type)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${filterStatus === type
                        ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <RefreshCw size={30} className="text-sky-500 animate-spin mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Loading travel requests...
              </p>
            </div>
          ) : filteredTravels.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <Plane size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                No travel requests match your criteria.
              </p>
            </div>
          ) : (
            filteredTravels.map((travel) => {
              return (
                <div
                  key={travel.id}
                  onClick={() => navigate(`/travel/${travel.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/travel/${travel.id}`);
                  }}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    
                    {/* LEFT INFO COLUMN */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/40 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-800">
                          {travel.id.substring(0,8)}...
                        </span>

                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${travel.currentStage === "Approved" || travel.currentStage === "TravelApproved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : travel.currentStage === "Rejected" || travel.currentStage === "Cancelled"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                        >
                          Stage: {travel.currentStage || "Raised"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {travel.purpose || "Travel Request"}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">Project: <strong>{travel.projectTitle || "N/A"}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-slate-400 shrink-0" />
                          <span>Requester: <strong>{travel.indenterName || "Unknown"}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-400 shrink-0" />
                          <span>Dates: {travel.onwardDate ? new Date(travel.onwardDate).toLocaleDateString() : 'N/A'} - {travel.returnDate ? new Date(travel.returnDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap lg:flex-col items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => navigate(`/travel/${travel.id}`)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                      >
                        <FileText size={15} />
                        View Request & Action
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
