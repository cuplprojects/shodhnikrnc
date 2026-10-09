import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReport } from '../api/reportsApi';
import { getPendingActions } from '../api/dashboardApi';

/**
 * "Active Projects" is sourced from the Number of Projects report
 * (reports.number-of-projects), summed across whatever rows the backend's
 * own scoping returns for the signed-in user -- no new scoping logic here,
 * the same endpoint ReportsPage.jsx's "Number of Projects" tab calls.
 *
 * "Pending Actions" is sourced from GET /api/dashboard/pending-actions,
 * which returns the signed-in user's own pending items per its own
 * per-request-type scoping.
 *
 * "Notifications" stays literal 0: there is no notifications endpoint
 * anywhere in this codebase (confirmed by search) to source it from, so
 * wiring it up would mean inventing data rather than reflecting it.
 */
function formatAge(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatRequestType(type) {
  if (!type) return 'REQUEST';
  switch (type) {
    case 'ResearchProposal': return 'RESEARCH PROPOSAL';
    case 'FellowshipClaim': return 'FELLOWSHIP CLAIM';
    case 'LeaveRequest': return 'LEAVE REQUEST';
    case 'GrantReceipt': return 'GRANT RECEIPT';
    case 'ProcessBill': return 'PROCESS BILL';
    case 'ExperienceCertificate': return 'EXPERIENCE CERTIFICATE';
    case 'MedicalFacility': return 'MEDICAL FACILITY';
    case 'Noc': return 'PHD NOC';
    case 'IdCard': return 'ID CARD';
    case 'FacultyRegistration': return 'FACULTY REGISTRATION';
    case 'JoiningReport': return 'JOINING REPORT';
    default: return type.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
  }
}

export default function DashboardPage() {
  const [activeProjects, setActiveProjects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState([]);
  const [isPendingLoading, setIsPendingLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getReport('number-of-projects')
      .then((rows) => {
        if (!active) return;
        const total = (rows ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0);
        setActiveProjects(total);
      })
      .catch(() => {
        // Falls back to 0 -- a dashboard summary tile should not error the
        // whole page if the caller lacks the reports.number-of-projects
        // grant or the request otherwise fails.
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getPendingActions()
      .then((items) => {
        if (!active) return;
        setPendingActions(items ?? []);
      })
      .catch(() => {
        // Falls back to an empty list -- the dashboard must not error the
        // whole page if this call fails.
      })
      .finally(() => { if (active) setIsPendingLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">Welcome to the MNIT R&C Portal. Select an option from the sidebar to begin.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-lg text-slate-800 mb-2">Pending Actions</h3>
          <p className="text-3xl font-bold text-blue-600">{isPendingLoading ? '…' : pendingActions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-lg text-slate-800 mb-2">Active Projects</h3>
          <p className="text-3xl font-bold text-green-600">{isLoading ? '…' : activeProjects}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-lg text-slate-800 mb-2">Notifications</h3>
          <p className="text-3xl font-bold text-orange-600">0</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-lg text-slate-800 mb-4">Pending Your Action</h3>
        {isPendingLoading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : pendingActions.length === 0 ? (
          <p className="text-slate-500 text-sm">Nothing pending your action right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingActions.map((item) => (
              <li key={`${item.requestType}-${item.id}`} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-block text-xs font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-2 py-0.5 mr-2">
                    {formatRequestType(item.requestType)}
                  </span>
                  <span className="text-slate-800 font-medium truncate">{item.title}</span>
                  <span className="text-slate-400 text-xs ml-2">{formatAge(item.createdAt)}</span>
                </div>
                <Link
                  to={item.route}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
