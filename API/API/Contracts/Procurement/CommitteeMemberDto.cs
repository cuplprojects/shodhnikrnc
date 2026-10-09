using API.Domain.Enums;

namespace API.Contracts.Procurement;

/// <summary>
/// The shape of one entry in <c>RaiseIndentRequest.CommitteeMembersJson</c>.
/// Documentation for API consumers and Swagger; the roster is parsed by
/// <c>CommitteeMembersJson</c> rather than bound to this type directly, because
/// it arrives as a string inside multipart form data.
/// </summary>
public record CommitteeMemberDto(string Name, CommitteeMemberRole Role);
