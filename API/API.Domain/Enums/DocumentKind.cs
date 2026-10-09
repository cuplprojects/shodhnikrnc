namespace API.Domain.Enums;

public enum DocumentKind
{
    Indent,
    CoverLetter,
    SignedCopy,
    GemQuotation,
    OfferLetter,
    Proforma,
    StipendForm,
    Advertisement,

    // Appended, never reordered: these persist as ints, so moving an existing
    // member would silently change what already-stored rows mean.
    TravelRequestForm,
    TravelBill,

    // Recruitment (Phase 5). Advertisement, OfferLetter, StipendForm and
    // Proforma already cover the rest -- Proforma is the screening proforma.
    MinutesOfSelection,
    MeritList,
    JoiningLetter,
    IdCard,

    // Fellowship (Phase 6). StipendForm already exists and covers the generated
    // claim form; this is the slip a fellow uploads to claim the HRA component.
    HraSlip,

    // Research proposal (Phase 9, BRD Prompt 1). CoverLetter already exists and
    // is reused for the proposal's cover letter. These three are the remaining
    // mandatory-at-submission documents named in the BRD.
    EndorsementCertificate,
    BudgetCopy,
    SupportingDocument,

    // Candidate application form (stepwise apply flow). All owned by a
    // Candidate row rather than by the recruitment request, since they are the
    // applicant's own uploads.
    CandidatePhoto,
    CandidateCategoryCertificate,
    CandidateEducationCertificate,
    CandidateExperienceCertificate,
    CandidatePublicationList,
    CandidateGateNetCard,

    // Dynamic Indent (new unified form). EstimatePdf is uploaded by the PI at
    // creation time. The four certificate kinds are only required when the
    // PI chooses the Rule 166 (Single Tender Enquiry) procurement route.
    EstimatePdf,
    PecCertificate,
    MacCertificate,
    PacCertificate,
    OtherSingleTenderDoc,
    NonAvailabilityCertificate,
    // Bill Processing Uploads
    BillDocument,
    EWayBill,
    SatisfactoryCertificate,

    // Research proposal Co-PI consent (client request, 2026-09-15). Mandatory
    // only when the proposal declares at least one Co-PI -- checked explicitly
    // in ResearchProposalService.SubmitForApprovalAsync, not via this item's
    // static IsMandatory flag, since that flag can't express "mandatory
    // conditional on other proposal state."
    CoPiConsent,

    // A screening/selection committee member nominated from outside MNNIT
    // entirely (client request, 2026-09-16) -- owned by the CommitteeMember
    // row itself (Document.OwnerType = "CommitteeMember"), not by the
    // recruitment request, since it is that specific person's own consent to
    // serve, not a recruitment-wide document.
    CommitteeMemberConsent,

    // Additional candidate document kinds
    CandidateIdProof,
    CandidateNationalExamCertificate,
    CandidatePublicationsDocument,
    CandidateSignature,
    CandidateResume,

    // Recruitment Phase 2: committee proceedings/minutes uploads, and the
    // 3-document merit-list approval gate that replaces per-member e-signing.
    ScreeningCommitteeProceedings,
    SelectionCommitteeDocuments,
    MinutesOfSelectionScanned,
    SignedMeritList,
    AttendanceSheet,

    // Research proposal Sanction Letter (client request, mandatory when recording sanction)
    SanctionLetter,
    // Recruitment Phase 3: the signed Contract of Engagement, gating the
    // Dean's final joining approval -- same scanned-upload pattern as
    // Phase 2's SignedMeritList/AttendanceSheet/MinutesOfSelectionScanned.
    ContractOfEngagement,

    // Fellow joining document upload (2026-09-24): the signed Offer Letter
    // the Fellow uploads at joining time, alongside ContractOfEngagement --
    // both are now required to submit the joining report at all, owned by
    // the Candidate row (not RecruitmentRequest), since these are the
    // Fellow's own record, not the recruitment's.
    SignedOfferLetter,
}

