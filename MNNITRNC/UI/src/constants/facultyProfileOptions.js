// Shared between CreateFacultyUser.jsx (the admin-facing tool) and the
// self-service profile form (CompleteProfilePage.jsx/ProfilePage.jsx) --
// a single source for these fixed option lists so the two forms never
// drift apart. Department options come from the real Departments table
// (GET /api/departments/active) instead of a static list here, so newly
// added departments show up without a frontend deploy.
export const GENDER_OPTIONS = ["Male", "Female", "Other"];

export const QUALIFICATION_OPTIONS = [
  "B.Tech",
  "M.Tech",
  "B.E.",
  "M.E.",
  "MCA",
  "MBA",
  "Ph.D.",
  "Other",
];
