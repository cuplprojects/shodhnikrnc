// The fixed catalogue of entity-bound tokens
// (API.Application.Recruitment.AdvertisementTokenCatalogue.EntityBoundTokens)
// -- used two ways: AdvertisementTemplateEditor.jsx inserts them as
// {{Token}} placeholder syntax into a saved template's sections;
// GenerateAdvertisementModal.jsx inserts them as already-resolved live
// values via the advertisement-token-values endpoint.
export const ADVERTISEMENT_TOKENS = [
  { key: 'ProjectFileNo', label: 'Project File No.' },
  { key: 'ProjectTitle', label: 'Project Title' },
  { key: 'PiName', label: 'PI Name' },
  { key: 'Department', label: 'Department' },
  { key: 'FundingAgency', label: 'Funding Agency' },
  { key: 'PositionCount', label: 'Number of Positions' },
  { key: 'SalaryJrf', label: 'Salary (JRF)' },
  { key: 'SalaryProjectAssociate', label: 'Salary (Project Associate)' },
  { key: 'AdvertisementNo', label: 'Advertisement No.' },
  { key: 'AdvertisementDate', label: 'Advertisement Date' },
];
