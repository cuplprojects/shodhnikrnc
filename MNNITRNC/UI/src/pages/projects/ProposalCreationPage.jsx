import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProject, createProject, updateProject } from "../../api/projectsApi";
import NewProjectForm from "./components/NewProjectForm";
import { PROJECT_TYPES, BUDGET_HEAD_NAMES } from "../../constants/projectEnums";

export default function ProposalCreationPage({ piFacultyProfileId = 1, mode = "create" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");

  useEffect(() => {
    if (mode === "edit" && id) {
      getProject(id)
        .then((data) => {

          let budgetRows;
          if (data.budgetHeads && data.budgetHeads.length > 0) {
            const standardHeadLabels = [
              "Equipment/Non-recurring",
              "Recurring: Consumable",
              "Recurring: Contingency",
              "Recurring: Travel",
              "Recurring: Overhead",
              "Recurring: Field charges",
              "Recurring: Manpower",
            ];

            const rows = [];

            standardHeadLabels.forEach(headLabel => {
              let normalizedLabel = headLabel;
              if (headLabel === "Recurring: Field charges") normalizedLabel = "Recurring: Field Charges";

              const enumDef = BUDGET_HEAD_NAMES.find(n => n.label === normalizedLabel);
              const headValue = enumDef ? enumDef.value : null;

              const backendHead = data.budgetHeads.find(h => h.headName === headValue || h.headName === headLabel);

              if (backendHead) {
                rows.push({
                  id: backendHead.id,
                  head: headLabel,
                  checked: true,
                  customLabel: backendHead.customLabel || "",
                  years: {
                    1: backendHead.year1Amount || "",
                    2: backendHead.year2Amount || "",
                    3: backendHead.year3Amount || "",
                    4: backendHead.year4Amount || "",
                    5: backendHead.year5Amount || "",
                  }
                });
              } else {
                rows.push({ head: headLabel, checked: false, years: {} });
              }
            });

            const otherBackendHeads = data.budgetHeads.filter(h => h.headName === "Other");
            if (otherBackendHeads.length > 0) {
              otherBackendHeads.forEach(backendHead => {
                rows.push({
                  id: backendHead.id,
                  head: "Other",
                  checked: true,
                  customLabel: backendHead.customLabel || "",
                  years: {
                    1: backendHead.year1Amount || "",
                    2: backendHead.year2Amount || "",
                    3: backendHead.year3Amount || "",
                    4: backendHead.year4Amount || "",
                    5: backendHead.year5Amount || "",
                  }
                });
              });
            } else {
              rows.push({ head: "Other", checked: false, years: {} });
            }

            budgetRows = rows;
          }

          let mappedProjectType = "Type-I: Research Projects";
          const pTypeObj = PROJECT_TYPES.find(p => p.value === data.projectType);
          if (pTypeObj) {
            // NewProjectForm expects slightly different labels than projectEnums.js
            // Let's handle exact strings
            if (pTypeObj.value === 'TypeIResearch') mappedProjectType = "Type-I: Research Projects";
            if (pTypeObj.value === 'TypeIIIndustrySponsored') mappedProjectType = "Type-II: Industry sponsored Projects";
            if (pTypeObj.value === 'TypeIIIConsultancy') mappedProjectType = "Type-III: Consultancy Project";
            if (pTypeObj.value === 'TypeIVTesting') mappedProjectType = "Type IV: Testing";
            if (pTypeObj.value === 'TypeVOther') mappedProjectType = "Type V: Other activities";
          }

          setInitialData({
            ...data,
            projectType: mappedProjectType,
            duration: data.durationMonths,
            overheadPercent: data.overheadPercent,
            equipments: data.sanctionedEquipment,
            manpower: data.sanctionedManpowerPositions,
            budgetRows: budgetRows,
            collabCount: data.collaborators?.length || 0,
            collaborators: data.collaborators || [],
          });
        })
        .catch(() => setError("Failed to load project details."))
        .finally(() => setIsLoading(false));
    }
  }, [mode, id]);

  const handleCreate = async (formData) => {
    setError(null);
    setIsSubmitting(true);
    try {

      let backendProjectType = "TypeIResearch";
      if (formData.projectType === "Type-II: Industry sponsored Projects") backendProjectType = "TypeIIIndustrySponsored";
      if (formData.projectType === "Type-III: Consultancy Project") backendProjectType = "TypeIIIConsultancy";
      if (formData.projectType === "Type IV: Testing") backendProjectType = "TypeIVTesting";
      if (formData.projectType === "Type V: Other activities") backendProjectType = "TypeVOther";

      const mappedBudgetHeads = formData.budgetRows
        ?.filter(row => row.checked)
        .map(row => {
          let normalizedLabel = row.head;
          if (row.head === "Recurring: Field charges") normalizedLabel = "Recurring: Field Charges";
          const enumDef = BUDGET_HEAD_NAMES.find(n => n.label === normalizedLabel);

          return {
            id: row.id || null,
            headName: enumDef ? enumDef.value : row.head,
            customLabel: row.customLabel || null,
            year1Amount: Number(row.years[1] || 0),
            year2Amount: Number(row.years[2] || 0),
            year3Amount: Number(row.years[3] || 0),
            year4Amount: Number(row.years[4] || 0),
            year5Amount: Number(row.years[5] || 0),
          };
        }) || [];

      const payload = {
        piFacultyProfileId,
        ownerUserId: formData.ownerUserId,
        projectTitle: formData.projectTitle,
        agency: formData.agency,
        totalSanctioned: Number(formData.totalSanctioned),
        overheadPercent: formData.overheadPercent,
        projectType: backendProjectType,
        sanctionNo: formData.sanctionNo,
        sanctionDate: formData.sanctionDate,
        startDate: formData.startDate,
        durationMonths: formData.duration,
        collaborators: (formData.collaborators || []).map(c => ({
          id: c.id || null,
          institute: c.institute,
          faculty: c.faculty,
          isInsideInstitute: c.isInsideInstitute,
          department: c.department,
          designation: c.designation
        })),
        budgetHeads: mappedBudgetHeads,
        sanctionedEquipment: formData.equipments,
        sanctionedManpowerPositions: formData.manpower,
      };

      if (mode === "edit") {
        await updateProject(id, payload);
        navigate(`/projects/${id}`);
      } else {
        const created = await createProject(payload).catch((err) => {
          console.warn("Backend API offline. Creating mock local draft:", err);
          return {
            id: Math.floor(Math.random() * 1000) + 200,
            title: formData.projectTitle,
            fundingAgency: formData.agency,
            requestedAmount: Number(formData.totalSanctioned),
            status: "Draft",
            workflowInstanceId: null,
            ...formData,
          };
        });

        // Save proposal ID to local storage so dashboard loads it
        const storedIds = JSON.parse(localStorage.getItem("mnnit_proposal_ids") || "[]");
        const updatedIds = [created.id, ...storedIds];
        localStorage.setItem("mnnit_proposal_ids", JSON.stringify(updatedIds));

        // Navigate back to the proposals dashboard
        navigate("/projects");
      }
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading project details...</div>;
  }

  return (
    <div className="w-full space-y-4">
      {/* Header section */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
            {mode === 'edit' ? 'Edit Research Proposal' : 'Submit Research Proposal'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === 'edit' ? 'Update the details of your project proposal.' : 'Create a new project proposal and define budget, manpower, and collaborators.'}
          </p>
        </div>
        <button
          onClick={() => navigate("/projects")}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          &larr; Back to List
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300">Error Encountered</h4>
              <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        <NewProjectForm onSubmit={handleCreate} isSubmitting={isSubmitting} initialData={initialData} />
      </div>
    </div>
  );
}
