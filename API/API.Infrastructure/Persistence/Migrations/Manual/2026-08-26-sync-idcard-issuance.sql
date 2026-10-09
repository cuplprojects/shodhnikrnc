-- Sync IdCardIssuedAt from IdCardRequests to ManpowerSelections
-- This ensures fellows can claim fellowship once their ID card is issued

-- Direct match by ApplicationUserId
UPDATE ManpowerSelections ms
INNER JOIN IdCardRequests icr ON ms.ApplicationUserId = icr.StudentUserId
SET ms.IdCardIssuedAt = icr.IssuedAt
WHERE ms.IdCardIssuedAt IS NULL
  AND icr.Status = 'Issued'
  AND icr.IssuedAt IS NOT NULL;

-- Fallback: match via Candidate relationship
UPDATE ManpowerSelections ms
INNER JOIN Candidates c ON ms.CandidateId = c.Id
INNER JOIN IdCardRequests icr ON c.ApplicationUserId = icr.StudentUserId
SET ms.IdCardIssuedAt = icr.IssuedAt
WHERE ms.IdCardIssuedAt IS NULL
  AND icr.Status = 'Issued'
  AND icr.IssuedAt IS NOT NULL;
