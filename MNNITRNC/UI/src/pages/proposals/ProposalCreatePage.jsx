import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Banknote, CheckCircle2, Info } from 'lucide-react';
import { createProposalDraft } from '../../api/proposalsApi';
import { listActiveFundingAgencies } from '../../api/fundingAgenciesApi';
import { BUDGET_HEAD_NAMES } from '../../constants/proposalEnums';
import { validateProposalBudget } from './validateProposalBudget';
import ProposalBudgetMatrix from './components/ProposalBudgetMatrix';
import ProposalEquipmentFieldArray from './components/ProposalEquipmentFieldArray';
import ProposalManpowerFieldArray from './components/ProposalManpowerFieldArray';
import ProposalCoPiFieldArray from './components/ProposalCoPiFieldArray';

const OTHER_AGENCY_VALUE = '__other__';
const DEFAULT_FUNDING_AGENCIES = ['AICTE', 'CSIR', 'DBT', 'DST', 'ICMR', 'ISRO', 'SERB'];

const FIELD_CLASS =
  'w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-sm shadow-sm';

const LABEL_CLASS = 'text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 mb-2 block ml-1';

export default function ProposalCreatePage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    proposalType: 'ResearchProject',
    agency: '',
    advertisementReference: '',
    durationMonths: 12,
  });
  const [budgetLines, setBudgetLines] = useState([
    { headName: BUDGET_HEAD_NAMES[0].value, includeInOverhead: true, customLabel: '', yearAmounts: [''] },
  ]);
  const [overheadPercent, setOverheadPercent] = useState(0);
  const [equipment, setEquipment] = useState([]);
  const [manpower, setManpower] = useState([]);
  const [coPis, setCoPis] = useState([]);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agencyOptions, setAgencyOptions] = useState(DEFAULT_FUNDING_AGENCIES.map((name) => ({ id: name, name })));
  const [agencySelection, setAgencySelection] = useState('');
  const [isOtherAgency, setIsOtherAgency] = useState(false);

  useEffect(() => {
    listActiveFundingAgencies()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAgencyOptions(data);
        } else {
          setAgencyOptions(DEFAULT_FUNDING_AGENCIES.map((name) => ({ id: name, name })));
        }
      })
      .catch((err) => {
        console.error('Failed to load funding agencies', err);
        setAgencyOptions(DEFAULT_FUNDING_AGENCIES.map((name) => ({ id: name, name })));
      });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAgencySelectionChange = (e) => {
    const value = e.target.value;
    setAgencySelection(value);
    if (value === OTHER_AGENCY_VALUE) {
      setIsOtherAgency(true);
      setFormData((prev) => ({ ...prev, agency: '' }));
    } else {
      setIsOtherAgency(false);
      setFormData((prev) => ({ ...prev, agency: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationError = validateProposalBudget({ budgetLines, equipment, manpower });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const id = await createProposalDraft({
        title: formData.title,
        agency: formData.agency,
        proposalType: formData.proposalType || 'ResearchProject',
        advertisementReference: formData.advertisementReference || null,
        durationMonths: Number(formData.durationMonths) || 1,
        overheadPercent: Number(overheadPercent) || 0,
        budgetLines: budgetLines.map((l) => ({
          headName: l.headName,
          includeInOverhead: Boolean(l.includeInOverhead),
          customLabel: l.customLabel || null,
          yearAmounts: l.yearAmounts.map((a) => Number(a) || 0),
        })),
        equipment: equipment.map((e) => ({ name: e.name, unit: e.unit, amount: Number(e.amount) || 0 })),
        manpower: manpower.map((m) => ({
          designation: m.designation, positions: Number(m.positions) || 1,
          hraPercent: Number(m.hraPercent) || 0,
          stipendByYear: (m.stipendByYear || []).map((s) => Number(s) || 0),
        })),
        coPis: coPis.map((c) => ({
          name: c.name,
          department: c.department,
          designation: c.designation,
          isInsideInstitute: Boolean(c.isInsideInstitute),
          instituteName: c.instituteName || null
        })),
      });
      navigate(`/proposals/${id}`);
    } catch (err) {
      // Error is shown via the global toast notification
      setIsSubmitting(false);
    }
  };

  // A freshly-added, still-blank Co-PI row must not yet trigger the
  // consent-document requirement -- only a row where the PI has actually
  // entered a name counts as "declared" for this purpose.
  const hasDeclaredCoPi = coPis.some((c) => c.name.trim().length > 0);

  return (
    <div className="min-h-screen dark:dark:dark:p-4 lg:p-8">
      <div className="w-full space-y-6 animate-in fade-in slide-in-duration-700">
        <button
          onClick={() => navigate('/proposals')}
          className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to proposals
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="w-full ">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-4">
              <span className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                <FileText size={28} />
              </span>
              Create Research Proposal
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium text-lg leading-relaxed">
              Prepare a comprehensive draft of your research proposal. This draft will remain editable until it is sanctioned.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 shadow-sm animate-in slide-in-">
            {error}
          </div>
        )}

        <div className="w-full">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 text-indigo-500/5 dark:text-indigo-400/5 rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <FileText size={200} />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-8 flex items-center gap-3 relative z-10">
                <span className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Info size={18} />
                </span>
                Basic Information
              </h2>

              <div className="space-y-6 relative z-10">
                <div>
                  <label className={LABEL_CLASS}>Proposal Title <span className="text-rose-500">*</span></label>
                  <input required name="title" value={formData.title} onChange={handleChange} className={FIELD_CLASS} placeholder="Enter a descriptive title for your research" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={LABEL_CLASS}>Proposal Type <span className="text-rose-500">*</span></label>
                    <select required name="proposalType" value={formData.proposalType} onChange={(e) => setFormData(prev => ({ ...prev, proposalType: e.target.value }))} className={FIELD_CLASS}>
                      <option value="ResearchProject">Type-I: Research Projects</option>
                      <option value="IndustrySponsoredProject">Type-II: Industry sponsored Projects</option>
                      <option value="ConsultancyProject">Type-III: Consultancy Project</option>
                      <option value="Testing">Type IV: Testing</option>
                      <option value="OtherActivities">Type V: Other activities</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Funding Agency <span className="text-rose-500">*</span></label>
                    <select required value={agencySelection} onChange={handleAgencySelectionChange} className={FIELD_CLASS}>
                      <option value="" disabled>Select a funding agency</option>
                      {agencyOptions.map((a) => {
                        const name = typeof a === 'string' ? a : (a.name || a.Name || '');
                        const id = typeof a === 'string' ? a : (a.id || a.Id || name);
                        return (
                          <option key={id} value={name}>
                            {name}
                          </option>
                        );
                      })}
                      <option value={OTHER_AGENCY_VALUE}>Other (please specify)</option>
                    </select>
                    {isOtherAgency && (
                      <input
                        required name="agency" value={formData.agency} onChange={handleChange}
                        className={`${FIELD_CLASS} mt-2`} placeholder="Enter the funding agency's name"
                      />
                    )}
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Advertisement Ref.</label>
                    <input name="advertisementReference" value={formData.advertisementReference} onChange={handleChange} className={FIELD_CLASS} placeholder="Optional reference number" />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Duration <span className="text-rose-500">*</span></label>
                    <div className="relative flex items-center w-full ">
                      <input required type="number" min="1" max="60" name="durationMonths"
                        value={formData.durationMonths} onChange={handleChange} className={`${FIELD_CLASS} pr-16`} />
                      <span className="absolute right-4 text-slate-400 font-bold text-xs uppercase tracking-wider pointer-events-none">Months</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 ml-1">
                      {Math.ceil((Number(formData.durationMonths) || 1) / 12)} budget year(s) below.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 text-emerald-500/5 dark:text-emerald-400/5 -rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <Banknote size={200} />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-8 flex items-center gap-3 relative z-10">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Banknote size={18} />
                </span>
                Detailed Budget
              </h2>
              <ProposalBudgetMatrix
                durationMonths={formData.durationMonths}
                lines={budgetLines}
                onChange={setBudgetLines}
                overheadPercent={overheadPercent}
                onOverheadPercentChange={setOverheadPercent}
              />
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-6">Equipment</h2>
              <ProposalEquipmentFieldArray items={equipment} onChange={setEquipment} />
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-6">Manpower</h2>
              <ProposalManpowerFieldArray items={manpower} durationMonths={formData.durationMonths} onChange={setManpower} />
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-2">Co-Investigators</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Optional. If you declare any Co-PI, their signed consent becomes a required upload before this proposal can be submitted for approval.
              </p>
              <ProposalCoPiFieldArray items={coPis} onChange={setCoPis} />
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-3">
                <span className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg">
                  <FileText size={18} />
                </span>
                Mandatory Attachments Checklist
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                The following documents are required before this proposal can be submitted for approval. Create the draft first, then upload each one from its detail page:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-3">
                  <span className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold">1</span>
                  <div>
                    <div className="text-slate-800 dark:text-slate-200 font-bold">Signed Copy of Proposal</div>
                    <div className="text-slate-400">Signed by the PI</div>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-3">
                  <span className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold">2</span>
                  <div>
                    <div className="text-slate-800 dark:text-slate-200 font-bold">Endorsement Certificate</div>
                    <div className="text-slate-400">On institute letterhead</div>
                  </div>
                </div>
                {hasDeclaredCoPi && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-3">
                    <span className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold">3</span>
                    <div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold">Co-PI Signed Consent</div>
                      <div className="text-slate-400">One document covering every declared Co-PI</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/proposals')}
                className="px-6 py-3 font-bold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <div className="relative group/btn">
                <div className="absolute -inset-1 rounded-2xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative flex items-center gap-2 px-10 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                >
                  <CheckCircle2 size={20} />
                  {isSubmitting ? 'Saving Draft...' : 'Save Proposal Draft'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
