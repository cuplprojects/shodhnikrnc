import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plane, FileText, CheckCircle2, Clock, Wallet, MapPin, Map, Receipt, Building2, User, CreditCard, Banknote, CalendarDays, Tent, ArrowRight, AlertTriangle } from 'lucide-react';
import { getTravelRequest } from '../../api/travelApi';
import { getWorkflowInstance } from '../../api/workflowApi';
import { getProject } from '../../api/projectsApi';
import { WORKFLOW_STAGE_LABELS } from '../../constants/procurementEnums';
import { TRAVELER_TYPES, TRAVEL_MODES, BOOKING_PLATFORMS } from '../../constants/travelEnums';
import { formatCurrency } from '../projects/utils/currency';
import ApprovalTimeline from '../../components/ApprovalTimeline';
import DocumentUploader from '../../components/DocumentUploader';
// import ProcessTravelBillForm from './components/ProcessTravelBillForm';
import TravelChainActions from './components/TravelChainActions';

const STAGE_STYLES = {
  Approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  Rejected: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  Cancelled: 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400',
  Raised: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
};

const DEFAULT_STAGE_STYLE = 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';

const label = (list, value) => list.find((i) => i.value === value)?.label ?? value;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTravelerDisplay(request) {
  if (!request) return '—';
  const types = request.travelerTypes
    ? (Array.isArray(request.travelerTypes) ? request.travelerTypes : request.travelerTypes.split(','))
    : [request.travelerType];
  return types.map((t) => {
    if (t === 'Other' && request.otherTravelerDetails) {
      return `Other (${request.otherTravelerDetails})`;
    }
    return TRAVELER_TYPES.find((item) => item.value === t)?.label ?? t;
  }).join(', ');
}

function formatModeDisplay(request) {
  if (!request) return '—';
  const modes = request.primaryModes
    ? (Array.isArray(request.primaryModes) ? request.primaryModes : request.primaryModes.split(','))
    : [request.primaryMode];
  return modes.map((m) => {
    if (m === 'Other' && request.otherPrimaryModeDetails) {
      return `Other (${request.otherPrimaryModeDetails})`;
    }
    return TRAVEL_MODES.find((item) => item.value === m)?.label ?? m;
  }).join(', ');
}

export default function TravelDetailPage() {
  const { travelRequestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [project, setProject] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    const data = await getTravelRequest(travelRequestId);
    setRequest(data);

    if (data?.projectId) {
      const proj = await getProject(data.projectId).catch(() => null);
      setProject(proj);
    }

    if (data?.workflowInstanceId) {
      setWorkflow(await getWorkflowInstance(data.workflowInstanceId).catch(() => null));
    }
    return data;
  };

  useEffect(() => {
    let active = true;
    load()
      .catch(() => { if (active) setError('Failed to load the travel request.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelRequestId]);

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading travel request…</div>;
  }

  if (error || !request) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">{error ?? 'Travel request not found.'}</p>
      </div>
    );
  }

  const stageStyle = STAGE_STYLES[request.currentStage] ?? DEFAULT_STAGE_STYLE;
  const canProcessBill = workflow?.phase === 'Indent' && (workflow?.currentStage === 'Approved' || workflow?.currentStage === 'IndentApproved');
  const steps = workflow?.steps ?? [];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-duration-700 ease-out pb-20">
      {/* Navigation */}
      <button
        onClick={() => navigate(-1)}
        className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all duration-300"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" /> Back
      </button>

      {/* Sleek Header Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden flex flex-col md:flex-row md:items-center justify-between">
        <div className="p-1 sm:p-5 flex-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${stageStyle}`}>
              {request.currentStage === 'Approved' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
              {WORKFLOW_STAGE_LABELS[request.currentStage] ?? request.currentStage}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ID: {request.id.split('-')[0]}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            Travel to {request.place}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium flex items-center gap-2">
            Purpose: <span className="text-slate-700 dark:text-slate-300">{request.purpose}</span>
          </p>
        </div>

        <div className="p-6 sm:p-8 bg-slate-50/50 dark:bg-slate-800/20 md:min-w-[280px] flex flex-col justify-center">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Expected Cost</p>
          <p className="text-3xl sm:text-4xl font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
            {formatCurrency(request.expectedCost)}
          </p>
        </div>
      </div>

      {request.currentStage === 'Raised' && (
        <div className="dark:dark:rounded-2xl border border-amber-200/60 dark:border-amber-800/60 p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-2">
              <FileText size={18} className="text-amber-600 dark:text-amber-400" />
              Sign & Seal Required
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shadow-sm border border-amber-200 dark:border-amber-800">
              Mandatory Action
            </span>
          </div>
          <p className="text-sm text-amber-800/80 dark:text-amber-200/80 leading-relaxed font-medium relative z-10 w-full ">
            Please download the Generated Travel Request Form from the documents section, sign and stamp it, and re-upload it to proceed with the workflow.
          </p>
        </div>
      )}

      {workflow && (
        <TravelChainActions
          travelRequestId={travelRequestId}
          workflowInstance={workflow}
          onActed={() => { void load(); }}
        />
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

        <div className="lg:col-span-8 space-y-6 sm:space-y-8">

          {/* Key Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={CalendarDays}
              label="Travel Dates"
              value={`${formatDate(request.onwardDate)}`}
              subValue={`to ${formatDate(request.returnDate)}`}
              color="sky"
            />
            <StatCard
              icon={User}
              label="Traveler Type"
              value={formatTravelerDisplay(request)}
              subValue={request.coPiName ? `Co-PI: ${request.coPiName}` : 'No Co-PI'}
              color="indigo"
            />
            <StatCard
              icon={Map}
              label="Primary Mode"
              value={formatModeDisplay(request)}
              subValue="Travel Mode"
              color="violet"
            />
          </div>

          {/* Budget Allocations Receipt */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Receipt size={20} className="text-emerald-500" />
                Budget Allocation Breakdown
              </h2>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative">
              <div className="p-6">
                {request.allocations && request.allocations.length > 0 ? (
                  <div className="space-y-4">
                    {request.allocations.map((alloc, idx) => {
                      const bh = project?.budgetHeads?.find(h => h.id === alloc.budgetHeadId);
                      const headName = bh ? (bh.displayName || bh.headName) : 'Unknown Head';
                      const percentage = ((alloc.amount / request.expectedCost) * 100).toFixed(1);

                      return (
                        <div key={alloc.budgetHeadId} className="group relative">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                                {idx + 1}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200">{headName}</h4>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                  {percentage}% of total cost
                                </span>
                              </div>
                            </div>
                            <span className="text-md font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                              {formatCurrency(alloc.amount)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div className="mt-6 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Total Allocated</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(request.expectedCost)}
                      </span>
                    </div>
                  </div>
                ) : request.budgetHeadIds && request.budgetHeadIds.length > 0 ? (
                  <div className="space-y-4">
                    {request.budgetHeadIds.map((bId, idx) => {
                      const bh = project?.budgetHeads?.find(h => h.id === bId);
                      const headName = bh ? (bh.displayName || bh.headName) : 'Unknown Head';
                      return (
                        <div key={bId} className="group relative">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                              {idx + 1}
                            </div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200">{headName}</h4>
                          </div>
                        </div>
                      );
                    })}
                    <div className="mt-6 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Total Expected Cost</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(request.expectedCost)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No budget allocations found.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Journey Legs */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Plane size={20} className="text-blue-500" />
                Journey Itinerary
              </h2>
              <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800">
                {request.journeys?.length || 0} Legs
              </span>
            </div>

            <div className="grid gap-3">
              {(request.journeys ?? []).map((leg, i) => (
                <div key={i} className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700/50">
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">

                    <div className="flex items-center gap-4 flex-1">
                      <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 font-bold">
                        {i + 1}
                      </div>

                      <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6">
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">Origin</p>
                          <p className="font-bold text-slate-800 dark:text-white text-lg">{leg.from}</p>
                        </div>

                        <div className="flex items-center justify-center w-full sm:w-auto px-4 py-2 sm:p-0">
                          <div className="h-[1px] bg-slate-200 dark:bg-slate-700 w-full sm:w-12 relative flex items-center justify-center">
                            <Plane size={16} className="text-blue-500 bg-white dark:bg-slate-900 px-1 absolute" />
                          </div>
                        </div>

                        <div className="flex-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">Destination</p>
                          <p className="font-bold text-slate-800 dark:text-white text-lg">{leg.to}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-6 min-w-[140px]">
                      <div className="text-left sm:text-right text-xs">
                        <p className="text-slate-500 dark:text-slate-400 font-semibold uppercase">Dep: {formatDate(leg.date)}</p>
                        {leg.arrivalDate && (
                          <p className="text-slate-500 dark:text-slate-400 font-medium">Planned Arr: {formatDate(leg.arrivalDate)}</p>
                        )}
                        <p className="font-medium text-slate-700 dark:text-slate-300 text-xs mt-0.5">{label(TRAVEL_MODES, leg.mode)}</p>
                      </div>
                      <span className="text-lg font-black text-slate-800 dark:text-white tabular-nums">
                        {formatCurrency(leg.amount)}
                      </span>
                    </div>

                  </div>

                  {/* Actual Arrival Verification Details (if recorded during billing) */}
                  {(leg.actualArrivalDate || leg.actualArrivalTime || leg.actualArrivalKm) && (
                    <div className="mt-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        Actual Leg Arrival Verification:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
                        {leg.actualArrivalDate && (
                          <div>Actual Arr Date: <strong>{formatDate(leg.actualArrivalDate)}</strong></div>
                        )}
                        {leg.actualArrivalTime && (
                          <div>Actual Arr Time: <strong>{leg.actualArrivalTime}</strong></div>
                        )}
                        {leg.actualArrivalKm && (
                          <div>Actual Arr Distance: <strong>{leg.actualArrivalKm}</strong></div>
                        )}
                      </div>
                    </div>
                  )}

                  {leg.remarks && (
                    leg.mode === 'RoadPrivateTaxi' ? (
                      <div className="mt-4 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-sm">Taxi Justification</span>
                            <span className="mt-1 block">{leg.remarks}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">Remarks:</span> {leg.remarks}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Detailed Expenses Breakdown */}
          <section>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
              <CreditCard size={20} className="text-violet-500" />
              Expense Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ExpenseCard
                icon={Plane}
                label="Journey Total"
                amount={request.journeyTotalCost}
                color="blue"
              />
              <ExpenseCard
                icon={Building2}
                label="Accommodation"
                amount={request.accommodationCost}
                color="indigo"
              />
              <ExpenseCard
                icon={Tent}
                label="Other Expenses"
                amount={request.otherExpensesCost}
                color="purple"
              />
              <ExpenseCard
                icon={MapPin}
                label="Taxi Reimbursement"
                amount={request.taxiCost}
                status={request.taxiReimbursementOptedIn ? "Opted In" : "Not Opted"}
                color="amber"
              />
            </div>
          </section>

        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Approval Timeline</h2>
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-6">
              <ApprovalTimeline steps={steps} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-500" />
              Documents
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-4">
              <DocumentUploader
                ownerType="TravelRequest"
                ownerId={travelRequestId}
                requestType="Travel"
                phase={workflow?.phase ?? 'Indent'}
                onUploaded={() => { void load(); }}
              />
            </div>
          </section>

          {/* {canProcessBill && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 "></div>
              <ProcessTravelBillForm
                travelRequest={request}
                onProcessed={() => { void load(); }}
              />
            </section>
          )} */}

        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subValue, color }) {
  const colorMap = {
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-start gap-4">
      <div className={`p-3 rounded-2xl ${colorMap[color]} shrink-0`}>
        <Icon size={24} strokeWidth={2} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="font-black text-slate-800 dark:text-white leading-tight">{value}</p>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-500 mt-1">{subValue}</p>
      </div>
    </div>
  );
}

function ExpenseCard({ icon: Icon, label, amount, status, color }) {
  const colorMap = {
    blue: 'text-blue-500',
    indigo: 'text-indigo-500',
    purple: 'text-purple-500',
    amber: 'text-amber-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 ${colorMap[color]}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</p>
          {status && <p className="text-xs font-semibold text-slate-500 dark:text-slate-500">{status}</p>}
        </div>
      </div>
      <div className="text-right">
        {amount != null ? (
          <span className="font-black text-slate-800 dark:text-white tabular-nums tracking-tight">
            {formatCurrency(amount)}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-600 font-medium">—</span>
        )}
      </div>
    </div>
  );
}
