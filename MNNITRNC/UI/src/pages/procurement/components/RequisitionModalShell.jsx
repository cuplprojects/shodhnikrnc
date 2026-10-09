import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, FileText, AlertCircle, Users, CheckCircle2, ShieldCheck, FileCheck, ChevronDown, ChevronUp, Wallet, AlertTriangle } from 'lucide-react';
import { raiseDynamicIndent, downloadDynamicIndentDocument } from '../../../api/dynamicIndentApi';
import { getProject } from '../../../api/projectsApi';
import { getAllFacultyUsers, getFacultyUserById } from '../../../api/facultyUsersApi';
import { useAuth } from '../../../auth/useAuth';
import { computeTierPreview, COMMITTEE_TIER, PROCUREMENT_TIERS } from '../../../constants/procurementEnums';
import IndentTierPreview from './IndentTierPreview';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-xs';

const LABEL_CLASS = 'text-xs font-semibold text-slate-700 dark:text-slate-300';
const HEADING_CLASS = 'text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1 mb-3 flex items-center gap-2';

function MultiSelectDropdown({ options, selectedValues = [], onChange, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const removeOption = (e, val) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== val));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`${FIELD_CLASS} min-h-[42px] cursor-pointer flex flex-wrap items-center gap-1.5 justify-between py-1.5`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedValues.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          ) : (
            selectedValues.map((val) => {
              const opt = options.find((o) => o.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800"
                >
                  {opt?.label || val}
                  <button
                    type="button"
                    onClick={(e) => removeOption(e, val)}
                    className="hover:text-blue-900 dark:hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600"
                />
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultiHeadAvailabilityBadge({ selections, estimatedCost }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!selections || selections.length === 0) {
      setSnapshot(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    import('../../../api/procurementApi').then(({ getIndentBudget }) => {
      Promise.all(selections.map((s) => getIndentBudget(s.budgetHeadId, s.subHead)))
        .then((data) => {
          if (!active) return;
          const total = data.reduce((acc, curr) => ({
            sanctioned: acc.sanctioned + (curr?.sanctioned || 0),
            committed: acc.committed + (curr?.committed || 0),
            paid: acc.paid + (curr?.paid || 0),
            available: acc.available + (curr?.available || 0),
          }), { sanctioned: 0, committed: 0, paid: 0, available: 0 });
          setSnapshot(total);
          setLoading(false);
        })
        .catch(() => {
          if (active) {
            setError('Could not load budget availability.');
            setLoading(false);
          }
        });
    });

    return () => { active = false; };
  }, [selections]);

  if (!selections || selections.length === 0) return null;

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        {error}
      </div>
    );
  }

  if (loading || !snapshot) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        Loading budget availability…
      </div>
    );
  }

  const cost = Number(estimatedCost);
  const exceeds = Number.isFinite(cost) && cost > 0 && cost > snapshot.available;

  const shellClass = exceeds
    ? 'border-red-300 bg-red-50 dark:border-red-700/60 dark:bg-red-900/20'
    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20';

  const iconClass = exceeds
    ? 'text-red-600 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`p-4 rounded-xl border ${shellClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {exceeds
          ? <AlertTriangle size={16} className={iconClass} />
          : <Wallet size={16} className={iconClass} />}
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Total Budget Availability ({selections.length} head{selections.length !== 1 ? 's' : ''})
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Sanctioned</dt>
          <dd className="mt-0.5 tabular-nums text-slate-800 dark:text-slate-200 font-medium">{formatCurrency(snapshot.sanctioned)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Committed</dt>
          <dd className="mt-0.5 tabular-nums text-slate-800 dark:text-slate-200 font-medium">{formatCurrency(snapshot.committed)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Paid</dt>
          <dd className="mt-0.5 tabular-nums text-slate-800 dark:text-slate-200 font-medium">{formatCurrency(snapshot.paid)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Available</dt>
          <dd className="mt-0.5 tabular-nums font-bold text-slate-900 dark:text-white">{formatCurrency(snapshot.available)}</dd>
        </div>
      </dl>

      {exceeds && (
        <p className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300">
          The estimated cost exceeds the total available balance.
        </p>
      )}
    </div>
  );
}

export default function RequisitionModalShell({
  title,
  indentType,
  projectId,
  budgetHeads = [],
  sanctionedEquipment = null,
  prefill = null,
  onClose,
  onRaised,
}) {
  const { user } = useAuth();
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadedHeads, setLoadedHeads] = useState(budgetHeads || []);

  const [formData, setFormData] = useState({
    purpose: '',
    purposeOfAcquiring: 'Research',
    installationRequired: false,
    trainingRequired: false,
    perpetualLicense: '',
    qualificationCriterion: '',
    maxDeliveryPeriod: '',
    numberOfEnclosures: '',
    gemAvailability: 'Yes',
    gemCategoryType: 'Product',
    stockAvailability: 'Yes',
    isRule166: 'No',
    committeeFacultyUserId: '',
    nonAvailabilityCertificateNumber: '',
    nonAvailabilityCertificateIssueDate: '',
    nonAvailabilityCertificateValidityDate: '',
  });

  const [selectedHeads, setSelectedHeads] = useState([]); // [{ value: 'headId' | 'headId:Pdf' | 'headId:Ddf', budgetHeadId, subHead }]
  const [manualSplitEnabled, setManualSplitEnabled] = useState(false);
  const [manualAmounts, setManualAmounts] = useState({}); // { [selectionValue]: string }
  const [overheadAvailability, setOverheadAvailability] = useState({ pdfAvailable: false, ddfAvailable: false, overheadHeadId: null });

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    import('../../../api/projectsOverheadApi').then(({ getOverheadSubHeadAvailability }) => {
      getOverheadSubHeadAvailability(projectId)
        .then((data) => { if (active) setOverheadAvailability(data); })
        .catch(() => { if (active) setOverheadAvailability({ pdfAvailable: false, ddfAvailable: false, overheadHeadId: null }); });
    });
    return () => { active = false; };
  }, [projectId]);

  const [stockItems, setStockItems] = useState([
    {
      id: Date.now(),
      stockBookPage: '',
      stockBookDate: '',
      stockDescription: '',
      stockQuantity: '',
      stockActualCost: '',
      stockCondition: 'Working',
      qty: '',
      actualCost: '',
    }
  ]);

  const [items, setItems] = useState([
    {
      id: Date.now(),
      name: prefill?.name || '',
      isConsumable: indentType === 'Consumable',
      technicalSpecs: '',
      unitOfMeasurement: prefill?.unit || '',
      quantity: '',
      estimatedCostInclTax: prefill?.amount || '',
    }
  ]);

  const [estimatePdf, setEstimatePdf] = useState(null);
  const [gemQuotation, setGemQuotation] = useState(null);
  const [gemQuotationDate, setGemQuotationDate] = useState('');
  const [pecCertificate, setPecCertificate] = useState(null);
  const [macCertificate, setMacCertificate] = useState(null);
  const [pacCertificate, setPacCertificate] = useState(null);
  const [otherSingleTenderDoc, setOtherSingleTenderDoc] = useState(null);
  const [nonAvailabilityCertificate, setNonAvailabilityCertificate] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successIndentId, setSuccessIndentId] = useState(null);
  const [isIndentInfoOpen, setIsIndentInfoOpen] = useState(false);

  useEffect(() => {
    let active = true;

    if (user?.userId) {
      getFacultyUserById(user.userId).then(profile => {
        if (active && profile) setFacultyProfile(profile);
      }).catch(() => {});
    }

    getAllFacultyUsers().then(list => {
      if (active && list) setFacultyList(list);
    }).catch(() => {});

    if (projectId) {
      getProject(projectId).then((proj) => {
        if (!active) return;
        setProjectDetails(proj);
        if (loadedHeads.length === 0) {
          setLoadedHeads(proj?.budgetHeads || []);
        }
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [projectId, loadedHeads.length, user]);

  const totalEstimatedCost = items.reduce((acc, item) => {
    const cost = Number(item.estimatedCostInclTax) || 0;
    return acc + cost;
  }, 0);

  const tier = computeTierPreview(formData.gemAvailability, totalEstimatedCost);
  const biddingRequired = tier === 'BiddingRequired';

  const isRule155 = formData.gemAvailability === 'No' && 
                    totalEstimatedCost > 200000 && 
                    totalEstimatedCost <= 2500000 && 
                    formData.isRule166 === 'No';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems([...items, {
      id: Date.now(),
      name: '',
      isConsumable: indentType === 'Consumable',
      technicalSpecs: '',
      unitOfMeasurement: '',
      quantity: '',
      estimatedCostInclTax: '',
    }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleStockItemChange = (id, field, value) => {
    setStockItems(stockItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addStockItem = () => {
    setStockItems([...stockItems, {
      id: Date.now(),
      stockBookPage: '',
      stockBookDate: '',
      stockDescription: '',
      stockQuantity: '',
      stockActualCost: '',
      stockCondition: 'Working'
    }]);
  };

  const removeStockItem = (id) => {
    if (stockItems.length > 1) {
      setStockItems(stockItems.filter(item => item.id !== id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || biddingRequired) return;

    if (selectedHeads.length === 0) {
      setError('At least one Budget Head must be selected.');
      document.getElementById('modal-scroll-area').scrollTop = 0;
      return;
    }

    if (manualSplitEnabled) {
      const manualSum = selectedHeads.reduce((sum, s) => sum + (Number(manualAmounts[s.value]) || 0), 0);
      if (Math.abs(manualSum - totalEstimatedCost) > 0.01) {
        setError(`Manually entered amounts (₹${manualSum.toFixed(2)}) must sum to the total estimated cost (₹${totalEstimatedCost.toFixed(2)}).`);
        document.getElementById('modal-scroll-area').scrollTop = 0;
        return;
      }
    }

    if (totalEstimatedCost <= 0) {
      setError('Estimated cost must be greater than zero.');
      document.getElementById('modal-scroll-area').scrollTop = 0;
      return;
    }

    if (isRule155 && !formData.committeeFacultyUserId) {
      setError('You must select a Faculty/Official member for the Rule 155 Committee.');
      document.getElementById('modal-scroll-area').scrollTop = 0;
      return;
    }

    if (formData.gemAvailability !== 'Yes' && !estimatePdf) {
      setError('Estimate PDF is required.');
      document.getElementById('modal-scroll-area').scrollTop = 0;
      return;
    }

    if (formData.gemAvailability === 'Yes' && totalEstimatedCost > 50000) {
      if (!gemQuotation) {
        setError('GeM Quotation / Estimate is required for GeM purchases over ₹50,000.');
        document.getElementById('modal-scroll-area').scrollTop = 0;
        return;
      }
      if (!gemQuotationDate) {
        setError('GeM Quotation / Estimate Date is required for GeM purchases over ₹50,000.');
        document.getElementById('modal-scroll-area').scrollTop = 0;
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    const body = new FormData();
    body.append('ProjectId', projectId);
    const headSelectionsJson = selectedHeads.map((s) => ({
      BudgetHeadId: s.budgetHeadId,
      SubHead: s.subHead || null,
      ManualAmount: manualSplitEnabled ? Number(manualAmounts[s.value] || 0) : null,
    }));
    body.append('HeadSelectionsJson', JSON.stringify(headSelectionsJson));

    const typeInt = indentType === 'Consumable' ? 0 : indentType === 'Contingency' ? 1 : 2;
    body.append('IndentType', typeInt);

    body.append('GemAvailability', formData.gemAvailability === 'Yes' ? 0 : 1);
    if (formData.gemAvailability === 'Yes') {
      body.append('GemCategoryType', formData.gemCategoryType === 'Product' ? 0 : 1);
    } else {
      if (formData.nonAvailabilityCertificateNumber) body.append('NonAvailabilityCertificateNumber', formData.nonAvailabilityCertificateNumber);
      if (formData.nonAvailabilityCertificateIssueDate) body.append('NonAvailabilityCertificateIssueDate', formData.nonAvailabilityCertificateIssueDate);
      if (formData.nonAvailabilityCertificateValidityDate) body.append('NonAvailabilityCertificateValidityDate', formData.nonAvailabilityCertificateValidityDate);
      if (nonAvailabilityCertificate) body.append('NonAvailabilityCertificate', nonAvailabilityCertificate);
    }
    
    body.append('StockAvailability', formData.stockAvailability === 'Yes' ? 0 : 1);
    body.append('PurposeOfAcquiring', formData.purposeOfAcquiring === 'Research' ? 0 : 1);
    body.append('IsRule166', formData.isRule166 === 'Yes');

    body.append('Purpose', formData.purpose);
    body.append('InstallationRequired', !!formData.installationRequired);
    body.append('TrainingRequired', !!formData.trainingRequired);

    // Qualification criterion and perpetual license are separate fields
    if (formData.qualificationCriterion) body.append('QualificationCriterion', formData.qualificationCriterion);
    if (formData.perpetualLicense) body.append('PerpetualLicense', formData.perpetualLicense);
    if (formData.maxDeliveryPeriod) body.append('MaxDeliveryPeriod', formData.maxDeliveryPeriod);
    if (formData.numberOfEnclosures) body.append('NumberOfEnclosures', formData.numberOfEnclosures);

    if (formData.stockAvailability === 'Yes') {
      body.append('StockDescription', JSON.stringify(stockItems));
    }

    if (isRule155 && formData.committeeFacultyUserId) {
      body.append('CommitteeFacultyUserId', formData.committeeFacultyUserId);
    }

    const cleanItems = items.map(item => ({
      Name: item.name,
      IsConsumable: item.isConsumable,
      TechnicalSpecs: item.technicalSpecs,
      UnitOfMeasurement: item.unitOfMeasurement,
      Quantity: Number(item.quantity),
      EstimatedCostInclTax: Number(item.estimatedCostInclTax),
    }));
    body.append('ItemsJson', JSON.stringify(cleanItems));

    if (estimatePdf) body.append('EstimatePdf', estimatePdf);
    
    if (formData.gemAvailability === 'Yes') {
      if (gemQuotation) body.append('GemQuotation', gemQuotation);
      if (gemQuotationDate) body.append('QuotationDate', gemQuotationDate);
    }

    if (formData.isRule166 === 'Yes') {
      if (pecCertificate) body.append('PecCertificate', pecCertificate);
      if (macCertificate) body.append('MacCertificate', macCertificate);
      if (pacCertificate) body.append('PacCertificate', pacCertificate);
      if (otherSingleTenderDoc) body.append('OtherSingleTenderDoc', otherSingleTenderDoc);
    }

    try {
      const indentId = await raiseDynamicIndent(body);
      setSuccessIndentId(indentId);
    } catch (err) {
      setIsSubmitting(false);
      setError('Failed to raise indent. Please try again.');
      document.getElementById('modal-scroll-area').scrollTop = 0;
    }
  };

  const handleDownload = async () => {
    try {
      await downloadDynamicIndentDocument(successIndentId);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  if (successIndentId) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => { onRaised?.(successIndentId); onClose(); }} />
        <div className="relative bg-white dark:bg-slate-900 rounded shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 mb-3">
            <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Indent Raised!</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-5">Your indent has been successfully raised.</p>
          <div className="space-y-2">
            <button onClick={handleDownload} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-all flex items-center justify-center gap-2">
              <FileText size={16} /> Download
            </button>
            <button onClick={() => { onRaised?.(successIndentId); onClose(); }} className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded transition-all">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedFaculty = facultyList.find(f => String(f.userId) === String(formData.committeeFacultyUserId));

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div id="modal-scroll-area" className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          <form id="requisition-form" onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto text-xs">
            
            {error && (
              <div className="p-3 rounded border border-red-300 bg-red-50 font-semibold text-red-700 flex items-start gap-2 shadow-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Budget Heads *</label>
              <MultiSelectDropdown
                options={[
                  // When PDF/DDF sub-heads are offered, the plain RecurringOverhead
                  // head is hidden from the options entirely -- it and its sub-heads
                  // draw from the same underlying overhead money via two disjoint
                  // Sanctioned pools with no reconciliation between them, so allowing
                  // both to be selected on the same Indent risks double-committing
                  // the same funds. Overhead becomes reachable ONLY via PDF/DDF once
                  // either is available.
                  ...loadedHeads
                    .filter((h) => !(
                      (overheadAvailability.pdfAvailable || overheadAvailability.ddfAvailable)
                      && h.headName === 'RecurringOverhead'
                    ))
                    .map((h) => ({ value: h.id, label: h.displayName || h.headName })),
                  ...(overheadAvailability.pdfAvailable
                    ? [{ value: `${overheadAvailability.overheadHeadId}:Pdf`, label: 'PDF (Overhead)' }]
                    : []),
                  ...(overheadAvailability.ddfAvailable
                    ? [{ value: `${overheadAvailability.overheadHeadId}:Ddf`, label: 'DDF (Overhead)' }]
                    : []),
                ]}
                selectedValues={selectedHeads.map((s) => s.value)}
                onChange={(values) => {
                  const next = values.map((v) => {
                    const [budgetHeadId, subHead] = v.split(':');
                    return { value: v, budgetHeadId, subHead: subHead || null };
                  });
                  setSelectedHeads(next);
                  setManualAmounts((prev) => {
                    const filtered = {};
                    next.forEach((s) => { if (prev[s.value] !== undefined) filtered[s.value] = prev[s.value]; });
                    return filtered;
                  });
                }}
                placeholder="Select one or more budget heads..."
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Costs will be deducted in the order selected if the first head runs out of funds.
              </p>

              <div className="mt-3">
                <MultiHeadAvailabilityBadge selections={selectedHeads} estimatedCost={totalEstimatedCost} />
              </div>

              {selectedHeads.length > 0 && (
                <label className="flex items-center gap-2 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={manualSplitEnabled}
                    onChange={(e) => setManualSplitEnabled(e.target.checked)}
                  />
                  Split manually instead
                </label>
              )}

              {manualSplitEnabled && selectedHeads.length > 0 && (
                <div className="mt-2 space-y-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {selectedHeads.map((s) => {
                    const opt = loadedHeads.find((h) => h.id === s.budgetHeadId);
                    const label = s.subHead ? `${s.subHead} (Overhead)` : (opt?.displayName || opt?.headName || s.budgetHeadId);
                    return (
                      <div key={s.value} className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                          value={manualAmounts[s.value] ?? ''}
                          onChange={(e) => setManualAmounts((prev) => ({ ...prev, [s.value]: e.target.value }))}
                        />
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Amounts must sum to the total estimated cost ({formatCurrency(totalEstimatedCost)}).
                  </p>
                </div>
              )}
            </div>


            {/* ITEM REQUISITION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={HEADING_CLASS}>Items</h3>
                <button type="button" onClick={addItem} className="flex items-center gap-1 px-2 py-1 font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                  <Plus size={14} /> Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">S.No. {index + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Item Name <span className="text-red-500">*</span></label>
                        <input required type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Type <span className="text-red-500">*</span></label>
                        <select required value={item.isConsumable ? 'Consumable' : 'Non-consumable'} onChange={(e) => handleItemChange(item.id, 'isConsumable', e.target.value === 'Consumable')} className={FIELD_CLASS}>
                          <option value="Consumable">Consumable</option>
                          <option value="Non-consumable">Non-consumable</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className={LABEL_CLASS}>Technical Specs <span className="text-red-500">*</span></label>
                        <input required type="text" value={item.technicalSpecs} onChange={(e) => handleItemChange(item.id, 'technicalSpecs', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Unit <span className="text-red-500">*</span></label>
                        <input required type="text" placeholder="e.g. Nos" value={item.unitOfMeasurement} onChange={(e) => handleItemChange(item.id, 'unitOfMeasurement', e.target.value)} className={FIELD_CLASS} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Quantity <span className="text-red-500">*</span></label>
                        <input required type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Estimated Cost (₹) <span className="text-red-500">*</span></label>
                        <input required type="number" step="0.01" min="0.01" value={item.estimatedCostInclTax} onChange={(e) => handleItemChange(item.id, 'estimatedCostInclTax', e.target.value)} className={FIELD_CLASS} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              
            </div>

            <div className="space-y-2">
                <span className={LABEL_CLASS}>Last entry recorded in the Stock Register for indented item (s)? <span className="text-red-500">*</span></span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="stockAvailability" value="Yes" checked={formData.stockAvailability === 'Yes'} onChange={handleChange} className="w-4 h-4" /> Yes
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="stockAvailability" value="No" checked={formData.stockAvailability === 'No'} onChange={handleChange} className="w-4 h-4" /> No
                  </label>
                </div>
              </div>

              {formData.stockAvailability === 'Yes' && (
                <div className="space-y-2">
                  {stockItems.map((sItem, sIndex) => (
                    <div key={sItem.id} className="p-3 bg-orange-50/50 border border-orange-100 rounded grid grid-cols-2 gap-3 relative">
                      {stockItems.length > 1 && (
                        <button type="button" onClick={() => setStockItems(p => p.filter(s => s.id !== sItem.id))} className="absolute top-1 right-1 text-slate-400 hover:text-red-500"><X size={12}/></button>
                      )}
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Page No.</label>
                        <input type="text" value={sItem.stockBookPage} onChange={(e) => handleStockItemChange(sItem.id, 'stockBookPage', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Date</label>
                        <input type="date" value={sItem.stockBookDate} onChange={(e) => handleStockItemChange(sItem.id, 'stockBookDate', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Qty (as per stock book)</label>
                        <input type="number" min="0" value={sItem.qty} onChange={(e) => handleStockItemChange(sItem.id, 'qty', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Actual Cost in ₹ (as per stock book)</label>
                        <input type="number" min="0" step="0.01" value={sItem.actualCost} onChange={(e) => handleStockItemChange(sItem.id, 'actualCost', e.target.value)} className={FIELD_CLASS} />
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Condition</label>
                        <select value={sItem.stockCondition} onChange={(e) => handleStockItemChange(sItem.id, 'stockCondition', e.target.value)} className={FIELD_CLASS}>
                          <option value="Working">Working</option>
                          <option value="Not Working">Not Working</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Description</label>
                        <input type="text" value={sItem.stockDescription} onChange={(e) => handleStockItemChange(sItem.id, 'stockDescription', e.target.value)} className={FIELD_CLASS} />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addStockItem} className="text-orange-600 font-semibold flex items-center gap-1 text-xs"><Plus size={12}/> Add Stock Entry</button>
                </div>
              )}
           
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className={LABEL_CLASS}>GeM Availability <span className="text-red-500">*</span></span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="gemAvailability" value="Yes" checked={formData.gemAvailability === 'Yes'} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 dark:bg-slate-700 dark:border-slate-600" /> Yes
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="gemAvailability" value="No" checked={formData.gemAvailability === 'No'} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 dark:bg-slate-700 dark:border-slate-600" /> No
                    </label>
                  </div>
                </div>
                
                {formData.gemAvailability === 'Yes' && (
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>GeM Category <span className="text-red-500">*</span></label>
                    <select required name="gemCategoryType" value={formData.gemCategoryType} onChange={handleChange} className={FIELD_CLASS}>
                      <option value="Product">Product</option>
                      <option value="Service">Service</option>
                    </select>
                  </div>
                )}
              </div>

              {formData.gemAvailability === 'No' && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Non-Availability Certificate Number <span className="text-red-500">*</span></label>
                      <input required type="text" name="nonAvailabilityCertificateNumber" value={formData.nonAvailabilityCertificateNumber} onChange={handleChange} className={FIELD_CLASS} />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Non-Availability Certificate Upload <span className="text-red-500">*</span></label>
                      <input required type="file" accept="application/pdf" onChange={(e) => setNonAvailabilityCertificate(e.target.files?.[0] ?? null)} className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Issue Date <span className="text-red-500">*</span></label>
                      <input required type="date" name="nonAvailabilityCertificateIssueDate" value={formData.nonAvailabilityCertificateIssueDate} onChange={handleChange} className={FIELD_CLASS} />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Valid Till Date <span className="text-red-500">*</span></label>
                      <input required type="date" name="nonAvailabilityCertificateValidityDate" value={formData.nonAvailabilityCertificateValidityDate} onChange={handleChange} className={FIELD_CLASS} />
                    </div>
                  </div>
                </div>
              )}

              {formData.gemAvailability === 'Yes' && (
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>GeM Quotation / Estimate {totalEstimatedCost > 50000 && <span className="text-red-500">*</span>}</label>
                    <input required={totalEstimatedCost > 50000} type="file" accept="application/pdf" onChange={(e) => setGemQuotation(e.target.files?.[0] ?? null)} className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>GeM Quotation / Estimate Date {totalEstimatedCost > 50000 && <span className="text-red-500">*</span>}</label>
                    <input required={totalEstimatedCost > 50000} type="date" value={gemQuotationDate} onChange={(e) => setGemQuotationDate(e.target.value)} className={FIELD_CLASS} />
                  </div>
                </div>
              )}

              

              {formData.isRule166 !== 'Yes' && (
                <div className="mt-2 scale-95 origin-left">
                  <IndentTierPreview gemAvailability={formData.gemAvailability} estimatedCost={totalEstimatedCost} />
                </div>
              )}

              {isRule155 && (
                <div className="mt-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded space-y-2">
                  <label className={LABEL_CLASS}>Rule 155 Committee Member <span className="text-red-500">*</span></label>
                  <select required name="committeeFacultyUserId" value={formData.committeeFacultyUserId} onChange={handleChange} className={FIELD_CLASS}>
                    <option value="">-- Select Faculty/Official --</option>
                    {facultyList.map(f => (
                      <option key={f.userId} value={f.userId}>{f.name} ({f.department})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
              
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Purpose & Justification <span className="text-red-500">*</span></label>
                <textarea required name="purpose" value={formData.purpose} onChange={handleChange} rows="3" className={FIELD_CLASS} />
              </div>


            {/* ADDITIONAL CONFIG */}
            <div className="space-y-3">
              <h3 className={HEADING_CLASS}>Additional Configuration</h3>

              {/* Checkboxes row */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input type="checkbox" name="installationRequired" checked={!!formData.installationRequired} onChange={(e) => setFormData(p => ({...p, installationRequired: e.target.checked}))} className="w-3.5 h-3.5" />
                  Installation Required
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input type="checkbox" name="trainingRequired" checked={!!formData.trainingRequired} onChange={(e) => setFormData(p => ({...p, trainingRequired: e.target.checked}))} className="w-3.5 h-3.5" />
                  Training Required
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>No. of Enclosures</label>
                  <input type="number" min="0" name="numberOfEnclosures" value={formData.numberOfEnclosures} onChange={handleChange} className={FIELD_CLASS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Maximum Delivery Period</label>
                  <input type="text" name="maxDeliveryPeriod" placeholder="e.g. 30 days" value={formData.maxDeliveryPeriod} onChange={handleChange} className={FIELD_CLASS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Purpose of Acquiring</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input type="radio" name="purposeOfAcquiring" value="Research" checked={formData.purposeOfAcquiring === 'Research'} onChange={handleChange} className="w-3.5 h-3.5" /> Research
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input type="radio" name="purposeOfAcquiring" value="NonResearch" checked={formData.purposeOfAcquiring === 'NonResearch'} onChange={handleChange} className="w-3.5 h-3.5" /> Non-Research
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Perpetual License <span className="text-slate-400">(software only)</span></label>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input type="radio" name="perpetualLicense" value="Perpetual" checked={formData.perpetualLicense === 'Perpetual'} onChange={handleChange} className="w-3.5 h-3.5" /> Perpetual
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input type="radio" name="perpetualLicense" value="NonPerpetual" checked={formData.perpetualLicense === 'NonPerpetual'} onChange={handleChange} className="w-3.5 h-3.5" /> Non-Perpetual
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input type="radio" name="perpetualLicense" value="" checked={formData.perpetualLicense === ''} onChange={handleChange} className="w-3.5 h-3.5" /> N/A
                    </label>
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className={LABEL_CLASS}>Qualification Criterion for Vendors</label>
                  <input name="qualificationCriterion" value={formData.qualificationCriterion} onChange={handleChange} className={FIELD_CLASS} />
                </div>
              </div>
            </div>

            {/* ATTACHMENTS */}
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Estimate PDF {formData.gemAvailability !== 'Yes' && <span className="text-red-500">*</span>}</label>
                  <input required={formData.gemAvailability !== 'Yes'} type="file" accept="application/pdf" onChange={(e) => setEstimatePdf(e.target.files?.[0] ?? null)} className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700" />
                </div>
                

                
                {formData.isRule166 === 'Yes' && (
                  <>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>PEC Cert</label>
                      <input type="file" accept="application/pdf" onChange={(e) => setPecCertificate(e.target.files?.[0] ?? null)} className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>MAC Cert</label>
                      <input type="file" accept="application/pdf" onChange={(e) => setMacCertificate(e.target.files?.[0] ?? null)} className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>PAC Cert</label>
                      <input type="file" accept="application/pdf" onChange={(e) => setPacCertificate(e.target.files?.[0] ?? null)} className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SYSTEM & PI INFORMATION COLLAPSIBLE */}
            <div className="border border-slate-200 rounded">
              <button type="button" onClick={() => setIsIndentInfoOpen(!isIndentInfoOpen)} className="w-full flex justify-between p-3 bg-slate-50 font-bold text-slate-700">
                System & Context Data {isIndentInfoOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>
              {isIndentInfoOpen && (
                <div className="p-3 grid grid-cols-2 gap-2 bg-white">
                  <div><span className="text-slate-500">PI Name:</span> {user?.fullName}</div>
                  <div><span className="text-slate-500">Designation:</span> {facultyProfile?.designation}</div>
                  <div><span className="text-slate-500">Dept:</span> {facultyProfile?.department}</div>
                  <div><span className="text-slate-500">Project:</span> {projectDetails?.projectNumber}</div>
                </div>
              )}
            </div>

            <button disabled={isSubmitting || biddingRequired} type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow transition-all flex items-center justify-center gap-2">
              {isSubmitting ? 'Submitting...' : biddingRequired ? 'Cannot Raise (Bidding Req)' : 'Raise Indent'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
