import { useState, useEffect } from 'react';
import { AlertCircle, List, PenLine, Plus, Trash2 } from 'lucide-react';
import { saveStep2Qualifications } from '../../../../api/recruitmentApi';
import CandidateDocumentSlot from './CandidateDocumentSlot';
import { FIELD_CLASS, LABEL_CLASS, ROW_FIELD_CLASS } from './wizardStyles';
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  ACADEMIC_DIVISIONS,
  NATIONAL_EXAMS,
  PASSING_YEARS,
  SCHOOL_BOARDS,
  UNIVERSITIES_INSTITUTES,
  sortEducationRows,
} from '../../../../constants/recruitmentEnums';

function blankRow() {
  return {
    id: null,
    level: 'Tenth',
    otherLevelName: '',
    subject: '',
    boardInstituteUniv: '',
    year: '',
    marksOrCgpa: '',
    division: '',
    certificateDocumentId: null,
  };
}

/**
 * Step 2: GATE/NET/GPAT qualification plus the education table.
 *
 * The education table is a controlled add/remove-row array, mirroring the
 * pattern in ProposalEquipmentFieldArray.jsx / ProposalManpowerFieldArray.jsx
 * (the proposal form's repeating budget/equipment rows) -- items + onChange,
 * addItem/removeItem, index-keyed rows with a trash-icon remove button.
 */
export default function Step2Qualifications({ candidateId, initial, requirements, onNext, onBack }) {
  const [gateNetGpatQualified, setGateNetGpatQualified] = useState(initial?.gateNetGpatQualified ?? false);
  const [selectedExam, setSelectedExam] = useState(() => {
    const raw = initial?.gateNetGpatScore ?? '';
    const match = NATIONAL_EXAMS.find(
      (e) => raw.startsWith(e.value + ':') || raw.startsWith(e.label + ':')
    );
    return match ? match.value : 'GATE';
  });
  const [gateNetGpatRollNo, setGateNetGpatRollNo] = useState(initial?.gateNetGpatRollNo ?? '');
  const [gateNetGpatYear, setGateNetGpatYear] = useState(initial?.gateNetGpatYear ?? '');
  const [gateNetGpatScore, setGateNetGpatScore] = useState(() => {
    const raw = initial?.gateNetGpatScore ?? '';
    const match = NATIONAL_EXAMS.find(
      (e) => raw.startsWith(e.value + ':') || raw.startsWith(e.label + ':')
    );
    if (match) {
      const idx = raw.indexOf(':');
      return raw.slice(idx + 1).trim();
    }
    return raw;
  });
  const [gateNetGpatCertificateDocumentId, setGateNetGpatCertificateDocumentId] = useState(
    initial?.gateNetGpatCertificateDocumentId ?? null
  );
  const [education, setEducation] = useState(() =>
    initial?.education?.length
      ? sortEducationRows(
          initial.education.map((e) => ({
            id: e.id ?? null,
            level: e.level,
            otherLevelName: e.otherLevelName ?? '',
            subject: e.subject ?? '',
            boardInstituteUniv: e.boardInstituteUniv ?? '',
            year: e.year ?? '',
            marksOrCgpa: e.marksOrCgpa ?? '',
            division: e.division ?? '',
            certificateDocumentId: e.certificateDocumentId ?? null,
          }))
        )
      : [blankRow()]
  );
  const [customBoardIndices, setCustomBoardIndices] = useState(() => new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const reqQualList = requirements?.requiredQualifications
    ? requirements.requiredQualifications.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const allowDiplomaFor12th = requirements?.allowDiplomaFor12th ?? true;

  // Auto-seed qualification rows matching PI requirements if initial education is blank
  useEffect(() => {
    if (reqQualList.length > 0) {
      setEducation((prev) => {
        const isDefaultSingleBlank =
          prev.length === 1 &&
          !prev[0].boardInstituteUniv &&
          !prev[0].subject &&
          !prev[0].year &&
          !prev[0].marksOrCgpa;

        if (isDefaultSingleBlank) {
          const seeded = [];
          if (reqQualList.includes('10th')) seeded.push({ ...blankRow(), level: 'Tenth' });
          if (reqQualList.includes('12th')) seeded.push({ ...blankRow(), level: 'Twelfth' });
          if (reqQualList.includes('UG')) seeded.push({ ...blankRow(), level: 'Undergraduate' });
          if (reqQualList.includes('PG')) seeded.push({ ...blankRow(), level: 'Postgraduate' });
          if (reqQualList.includes('PhD')) seeded.push({ ...blankRow(), level: 'Doctorate' });

          return seeded.length > 0 ? sortEducationRows(seeded) : prev;
        }
        return sortEducationRows(prev);
      });
    }
  }, [requirements]);

  const addRow = () => {
    setEducation((prev) => [...prev, blankRow()]);
  };

  const removeRow = (index) => {
    setEducation((prev) => prev.filter((_, i) => i !== index));
    setCustomBoardIndices((prev) => {
      const next = new Set();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  };

  const updateRow = (index, field, value) => {
    setEducation((prev) => {
      const updated = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      return field === 'level' ? sortEducationRows(updated) : updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);

    // Validate mandatory qualification requirements set by PI
    if (reqQualList.length > 0) {
      if (reqQualList.includes('GATE/NET') && !gateNetGpatQualified) {
        setError('GATE / CSIR-NET / GPAT qualification is mandatory for this position.');
        return;
      }

      if (reqQualList.includes('10th')) {
        const has10th = education.some((e) => e.level === 'Tenth' && e.boardInstituteUniv && e.year);
        if (!has10th) {
          setError('10th Standard qualification details are mandatory for this position.');
          return;
        }
      }

      if (reqQualList.includes('12th')) {
        const has12th = education.some((e) => e.level === 'Twelfth' && e.boardInstituteUniv && e.year);
        const hasDiploma = allowDiplomaFor12th && education.some((e) => e.level === 'Diploma' && e.boardInstituteUniv && e.year);
        if (!has12th && !hasDiploma) {
          setError(
            allowDiplomaFor12th
              ? '12th Standard qualification (or Diploma) details are mandatory for this position.'
              : '12th Standard qualification details are mandatory for this position.'
          );
          return;
        }
      }

      if (reqQualList.includes('UG')) {
        const hasUg = education.some((e) => e.level === 'Undergraduate' && e.boardInstituteUniv && e.year);
        if (!hasUg) {
          setError('Undergraduate (UG) qualification details are mandatory for this position.');
          return;
        }
      }

      if (reqQualList.includes('PG')) {
        const hasPg = education.some((e) => e.level === 'Postgraduate' && e.boardInstituteUniv && e.year);
        if (!hasPg) {
          setError('Postgraduate (PG) qualification details are mandatory for this position.');
          return;
        }
      }

      if (reqQualList.includes('PhD')) {
        const hasPhd = education.some((e) => e.level === 'Doctorate' && e.boardInstituteUniv && e.year);
        if (!hasPhd) {
          setError('Ph.D. qualification details are mandatory for this position.');
          return;
        }
      }
    }

    // Validate passing year timeline gaps between qualification levels
    const year10thRow = education.find((e) => e.level === 'Tenth' && e.year);
    const year12thRow = education.find((e) => e.level === 'Twelfth' && e.year);
    const yearDiplomaRow = education.find((e) => e.level === 'Diploma' && e.year);
    const yearUgRow = education.find((e) => e.level === 'Undergraduate' && e.year);
    const yearPgRow = education.find((e) => e.level === 'Postgraduate' && e.year);
    const yearPhdRow = education.find((e) => e.level === 'Doctorate' && e.year);

    const y10 = year10thRow ? Number(year10thRow.year) : null;
    const y12 = year12thRow ? Number(year12thRow.year) : null;
    const yDip = yearDiplomaRow ? Number(yearDiplomaRow.year) : null;
    const yUg = yearUgRow ? Number(yearUgRow.year) : null;
    const yPg = yearPgRow ? Number(yearPgRow.year) : null;
    const yPhd = yearPhdRow ? Number(yearPhdRow.year) : null;

    if (y10 && y12 && y12 < y10 + 2) {
      setError(`12th Standard passing year (${y12}) must be at least 2 years after 10th Standard passing year (${y10}). Minimum valid passing year for 12th is ${y10 + 2}.`);
      return;
    }

    if (y10 && yDip && yDip < y10 + 2) {
      setError(`Diploma passing year (${yDip}) must be at least 2 years after 10th Standard passing year (${y10}). Minimum valid passing year for Diploma is ${y10 + 2}.`);
      return;
    }

    if (y12 && yUg && yUg < y12 + 3) {
      setError(`Undergraduate (UG) passing year (${yUg}) must be at least 3 years after 12th Standard passing year (${y12}). Minimum valid passing year for UG is ${y12 + 3}.`);
      return;
    }

    if (yDip && yUg && !y12 && yUg < yDip + 2) {
      setError(`Undergraduate (UG) passing year (${yUg}) must be at least 2 years after Diploma passing year (${yDip}). Minimum valid passing year for UG is ${yDip + 2}.`);
      return;
    }

    if (yUg && yPg && yPg < yUg + 1) {
      setError(`Postgraduate (PG) passing year (${yPg}) must be after Undergraduate (UG) passing year (${yUg}). Minimum valid passing year for PG is ${yUg + 1}.`);
      return;
    }

    if (yPg && yPhd && yPhd < yPg + 1) {
      setError(`Ph.D. passing year (${yPhd}) must be after Postgraduate (PG) passing year (${yPg}). Minimum valid passing year for Ph.D. is ${yPg + 1}.`);
      return;
    }

    if (yUg && yPhd && !yPg && yPhd < yUg + 3) {
      setError(`Ph.D. passing year (${yPhd}) must be at least 3 years after Undergraduate (UG) passing year (${yUg}). Minimum valid passing year for Ph.D. is ${yUg + 3}.`);
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        candidateId,
        gateNetGpatQualified,
        gateNetGpatRollNo: gateNetGpatQualified ? gateNetGpatRollNo || null : null,
        gateNetGpatYear:
          gateNetGpatQualified && gateNetGpatYear ? parseInt(gateNetGpatYear, 10) : null,
        gateNetGpatScore: gateNetGpatQualified
          ? (gateNetGpatScore ? `${selectedExam}: ${gateNetGpatScore}` : null)
          : null,
        gateNetGpatCertificateDocumentId: gateNetGpatQualified
          ? gateNetGpatCertificateDocumentId || null
          : null,
        education: education.map((e) => ({
          id: e.id || null,
          level: e.level,
          otherLevelName: e.level === 'Other' ? e.otherLevelName || null : null,
          subject: e.subject || null,
          boardInstituteUniv: e.boardInstituteUniv || null,
          year: e.year ? parseInt(e.year, 10) : null,
          marksOrCgpa: e.marksOrCgpa || null,
          division: e.division || null,
          certificateDocumentId: e.certificateDocumentId || null,
        })),
      };
      await saveStep2Qualifications(payload);
      onNext(payload);
    } catch {
      // Error is shown via the global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {reqQualList.length > 0 && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>Mandatory Qualifications Required by PI for this Recruitment:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {reqQualList.map((q) => (
              <span key={q} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded font-semibold text-blue-900 dark:text-blue-200">
                {q === '12th' && allowDiplomaFor12th ? '12th Standard (or Diploma)' : q === '10th' ? '10th Standard' : q === 'UG' ? 'Undergraduate (UG)' : q === 'PG' ? 'Postgraduate (PG)' : q === 'PhD' ? 'Ph.D.' : q}
              </span>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gateNetGpatQualified}
            onChange={(e) => setGateNetGpatQualified(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
          />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Qualified GATE / CSIR-UGC NET / GPAT / National Examination
          </span>
        </label>

        {gateNetGpatQualified && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>Examination</label>
                <select
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className={FIELD_CLASS}
                >
                  {NATIONAL_EXAMS.map((exam) => (
                    <option key={exam.value} value={exam.value}>{exam.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>Roll / Reg. number</label>
                <input
                  type="text"
                  value={gateNetGpatRollNo}
                  onChange={(e) => setGateNetGpatRollNo(e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>Year</label>
                <select
                  value={gateNetGpatYear}
                  onChange={(e) => setGateNetGpatYear(e.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="">-- Select Year --</option>
                  {gateNetGpatYear && !PASSING_YEARS.includes(String(gateNetGpatYear)) && (
                    <option value={gateNetGpatYear}>{gateNetGpatYear}</option>
                  )}
                  {PASSING_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>Score / Percentile / Rank</label>
                <input
                  type="text"
                  placeholder="e.g. 650 (AIR 214)"
                  value={gateNetGpatScore}
                  onChange={(e) => setGateNetGpatScore(e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
            </div>

            <CandidateDocumentSlot
              ownerType="Candidate"
              ownerId={candidateId}
              kind="CandidateNationalExamCertificate"
              label="GATE / CSIR-NET / National Exam Certificate"
              documentId={gateNetGpatCertificateDocumentId}
              onChange={setGateNetGpatCertificateDocumentId}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Academic record</h3>
        <div className="space-y-4">
          {education.map((row, index) => {
            const isSchool = row.level === 'Tenth' || row.level === 'Twelfth';
            const boardOptions = isSchool ? SCHOOL_BOARDS : UNIVERSITIES_INSTITUTES;
            const isCustomBoard = customBoardIndices.has(index);

            return (
              <div
                key={index}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Row {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    aria-label={`Remove education row ${index + 1}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <select
                    value={row.level}
                    onChange={(e) => updateRow(index, 'level', e.target.value)}
                    className={ROW_FIELD_CLASS}
                    aria-label={`Row ${index + 1} level`}
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                    ))}
                  </select>
                  {row.level === 'Other' && (
                    <input
                      value={row.otherLevelName}
                      placeholder="Specify qualification name"
                      onChange={(e) => updateRow(index, 'otherLevelName', e.target.value)}
                      className={ROW_FIELD_CLASS}
                      aria-label={`Row ${index + 1} custom qualification name`}
                    />
                  )}
                  <input
                    value={row.subject}
                    placeholder="Subject / specialisation"
                    onChange={(e) => updateRow(index, 'subject', e.target.value)}
                    className={ROW_FIELD_CLASS}
                    aria-label={`Row ${index + 1} subject`}
                  />

                  {/* Board / Institute / University dropdown with custom entry option */}
                  {isCustomBoard ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        value={row.boardInstituteUniv}
                        placeholder={isSchool ? 'Enter board name' : 'Enter university / institute'}
                        onChange={(e) => updateRow(index, 'boardInstituteUniv', e.target.value)}
                        className={ROW_FIELD_CLASS}
                        autoFocus
                        aria-label={`Row ${index + 1} board/institute`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomBoardIndices((prev) => {
                            const next = new Set(prev);
                            next.delete(index);
                            return next;
                          });
                        }}
                        title="Choose from standard dropdown list"
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shrink-0 transition-colors"
                        aria-label={`Row ${index + 1} choose from list`}
                      >
                        <List size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 items-center">
                      <select
                        value={row.boardInstituteUniv}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__CUSTOM__') {
                            setCustomBoardIndices((prev) => new Set(prev).add(index));
                            updateRow(index, 'boardInstituteUniv', '');
                          } else {
                            updateRow(index, 'boardInstituteUniv', val);
                          }
                        }}
                        className={ROW_FIELD_CLASS}
                        aria-label={`Row ${index + 1} board/institute`}
                      >
                        <option value="">
                          {isSchool ? '-- Select Board --' : '-- Select University / Institute --'}
                        </option>
                        <option value="__CUSTOM__">Other (Specify manually)...</option>
                        {row.boardInstituteUniv &&
                          !boardOptions.some((b) => b.value === row.boardInstituteUniv) && (
                            <option value={row.boardInstituteUniv}>{row.boardInstituteUniv}</option>
                          )}
                        {boardOptions.map((b) => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomBoardIndices((prev) => new Set(prev).add(index));
                        }}
                        title="Type custom board or institute name"
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 transition-colors"
                        aria-label={`Row ${index + 1} enter custom name`}
                      >
                        <PenLine size={15} />
                      </button>
                    </div>
                  )}

                  {/* Passing Year dropdown */}
                  <select
                    value={row.year ?? ''}
                    onChange={(e) => updateRow(index, 'year', e.target.value)}
                    className={ROW_FIELD_CLASS}
                    aria-label={`Row ${index + 1} year`}
                  >
                    <option value="">-- Passing Year --</option>
                    {row.year && !PASSING_YEARS.includes(String(row.year)) && (
                      <option value={row.year}>{row.year}</option>
                    )}
                    {PASSING_YEARS.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>

                  <input
                    value={row.marksOrCgpa}
                    placeholder="Marks (%) or CGPA"
                    onChange={(e) => updateRow(index, 'marksOrCgpa', e.target.value)}
                    className={ROW_FIELD_CLASS}
                    aria-label={`Row ${index + 1} marks or CGPA`}
                  />
                  <select
                    value={row.division}
                    onChange={(e) => updateRow(index, 'division', e.target.value)}
                    className={ROW_FIELD_CLASS}
                    aria-label={`Row ${index + 1} division`}
                  >
                    <option value="">-- Division / Grade --</option>
                    {ACADEMIC_DIVISIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                {/*
                Owned by the candidate, not the row: SaveStep2QualificationsAsync
                replaces the whole CandidateEducation table on every save and
                assigns each row a brand-new Id server-side (the Id the client
                sends is never read back), so a row-scoped ownerId would point
                at an Id that no longer exists moments after the next save. The
                uploaded document's id is instead carried directly as this
                row's certificateDocumentId field and submitted with the rest
                of the row's data.
              */}
                <CandidateDocumentSlot
                  ownerType="Candidate"
                  ownerId={candidateId}
                  kind="CandidateEducationCertificate"
                  label="Certificate / marksheet"
                  documentId={row.certificateDocumentId}
                  onChange={(id) => updateRow(index, 'certificateDocumentId', id)}
                />
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Plus size={14} /> Add education row
        </button>
      </section>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/10 transition-all"
        >
          {isSaving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  );
}
