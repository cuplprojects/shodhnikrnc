using API.Application.Common;
using API.Application.Workflow;
using API.Contracts.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

/// <summary>
/// The SuperAdmin surface for the stored approval routes.
/// </summary>
/// <remarks>
/// SuperAdmin only, and deliberately not Dean or Director: those roles decide
/// individual requests, while this decides who decides. Because the engine now
/// reads AllowedRoles from these rows, editing them is the more powerful of the
/// two -- it is worth keeping the two capabilities in separate hands.
/// </remarks>
[ApiController]
[Route("api/admin/workflow-definitions")]
[Authorize(Roles = "SuperAdmin")]
public class WorkflowDefinitionsController(
    IApplicationDbContext db,
    IWorkflowDefinitionValidator validator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkflowDefinitionResponse>>> GetAll(CancellationToken ct)
    {
        var definitions = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .OrderBy(d => d.RequestType).ThenBy(d => d.Phase)
            .ToListAsync(ct);

        return Ok(definitions.Select(ToResponse).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkflowDefinitionResponse>> Get(Guid id, CancellationToken ct)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        return definition is null ? NotFound() : Ok(ToResponse(definition));
    }

    /// <summary>Validates a proposed route without persisting it.</summary>
    /// <remarks>
    /// Lets the editor show what is wrong before the operator commits to it,
    /// rather than only on save.
    /// </remarks>
    [HttpPost("{id:guid}/validate")]
    public async Task<ActionResult<WorkflowValidationResponse>> Validate(
        Guid id, UpdateWorkflowDefinitionRequest request, CancellationToken ct)
    {
        var definition = await db.WorkflowDefinitions
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (definition is null)
        {
            return NotFound();
        }

        var errors = await validator.ValidateAsync(
            definition.RequestType, definition.Phase, ToStages(request, definition.Id),
            definition.ResubmitEntrySequence, ct);

        return Ok(new WorkflowValidationResponse(errors.Count == 0, errors));
    }

    /// <summary>Replaces a route's stage list wholesale.</summary>
    /// <remarks>
    /// The whole list is replaced in a single SaveChangesAsync, which EF sends
    /// as one transaction -- so a rejected edit cannot leave a definition with
    /// its old stages deleted and no new ones in place.
    ///
    /// Validation runs first and nothing is written when it fails: the point of
    /// the rules is to refuse a route that would strand live requests, which is
    /// only true if the refusal happens before persistence.
    /// </remarks>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorkflowDefinitionResponse>> Update(
        Guid id, UpdateWorkflowDefinitionRequest request, CancellationToken ct)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (definition is null)
        {
            return NotFound();
        }

        var replacement = ToStages(request, definition.Id);

        var errors = await validator.ValidateAsync(
            definition.RequestType, definition.Phase, replacement,
            definition.ResubmitEntrySequence, ct);

        if (errors.Count > 0)
        {
            return BadRequest(new WorkflowValidationResponse(false, errors));
        }

        db.WorkflowStageDefinitions.RemoveRange(definition.Stages);
        foreach (var stage in replacement)
        {
            db.WorkflowStageDefinitions.Add(stage);
        }

        definition.Name = request.Name;
        definition.IsActive = request.IsActive;
        definition.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var saved = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstAsync(d => d.Id == id, ct);

        return Ok(ToResponse(saved));
    }

    private static List<WorkflowStageDefinition> ToStages(
        UpdateWorkflowDefinitionRequest request, Guid definitionId) =>
        request.Stages.Select(s => new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(),
            WorkflowDefinitionId = definitionId,
            Sequence = s.Sequence,
            Stage = s.Stage,
            AllowedRoles = string.Join(",", s.AllowedRoles),
            IsInitial = s.IsInitial,
            IsTerminal = s.IsTerminal,
            CanApprove = s.CanApprove,
            CanReject = s.CanReject,
            CanReturn = s.CanReturn,
        }).ToList();

    private static WorkflowDefinitionResponse ToResponse(WorkflowDefinition d) =>
        new(d.Id, d.RequestType, d.Phase, d.Name, d.IsActive, d.CreatedAt, d.UpdatedAt,
            d.Stages
                .OrderBy(s => s.Sequence)
                .Select(s => new WorkflowStageResponse(
                    s.Sequence, s.Stage, s.AllowedRoleList(),
                    s.IsInitial, s.IsTerminal, s.CanApprove, s.CanReject, s.CanReturn))
                .ToList());
}
