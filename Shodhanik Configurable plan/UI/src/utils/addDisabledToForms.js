// Utility script to add disabled={isReadOnly} to all form elements
// This is a helper script to systematically update form elements

export const addDisabledAttribute = (content, isReadOnlyVar = 'isReadOnly') => {
  // Pattern to match form elements that need disabled attribute
  const patterns = [
    // Input elements
    {
      regex: /(<input[^>]*onChange=\{handleChange\}[^>]*)(>)/g,
      replacement: (match, p1, p2) => {
        if (p1.includes('disabled=')) return match; // Already has disabled
        return `${p1} disabled={${isReadOnlyVar}}${p2}`;
      }
    },
    // Select elements
    {
      regex: /(<select[^>]*onChange=\{handleChange\}[^>]*)(>)/g,
      replacement: (match, p1, p2) => {
        if (p1.includes('disabled=')) return match; // Already has disabled
        return `${p1} disabled={${isReadOnlyVar}}${p2}`;
      }
    },
    // Textarea elements
    {
      regex: /(<textarea[^>]*onChange=\{handleChange\}[^>]*)(>)/g,
      replacement: (match, p1, p2) => {
        if (p1.includes('disabled=')) return match; // Already has disabled
        return `${p1} disabled={${isReadOnlyVar}}${p2}`;
      }
    }
  ];

  let updatedContent = content;
  patterns.forEach(pattern => {
    updatedContent = updatedContent.replace(pattern.regex, pattern.replacement);
  });

  return updatedContent;
};

// List of form elements that need disabled attribute (for manual reference)
export const formElementsToUpdate = [
  'title', 'fullName', 'fatherName', 'dateOfBirth', 'retirementDate',
  'gender', 'designation', 'nationality', 'IfOtherPleaseSpecify',
  'identityProofType', 'identityProofNo', 'coAddress', 'coState',
  'coDistrict', 'coPinCode', 'sameAsCorrespondence', 'peAddress',
  'peState', 'peDistrict', 'pePinCode'
];