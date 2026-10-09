using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One step in a <see cref="WorkflowDefinition"/>: a stage, its position in the
/// sequence, and the roles permitted to act there.
/// </summary>
/// <remarks>
/// <see cref="Sequence"/> is what makes forwarding data-driven: the engine moves
/// to the row at Sequence + 1 rather than consulting a hardcoded chain.
/// Sequences are 1-based and contiguous within a definition; the validator
/// enforces that, because a gap would strand an instance mid-route.
/// </remarks>
public class WorkflowStageDefinition
{
    public Guid Id { get; set; }
    public Guid WorkflowDefinitionId { get; set; }

    /// <summary>1-based position in the route. Contiguous, unique per definition.</summary>
    public int Sequence { get; set; }

    public WorkflowStage Stage { get; set; }

    /// <summary>
    /// Comma-separated role names permitted to act at this stage, e.g.
    /// "Dean,Director". Empty means the stage is not acted on by a role -- the
    /// initial stage, which belongs to whoever raised the request.
    /// </summary>
    /// <remarks>
    /// A join table is the textbook shape. It is not worth it here: the list is
    /// short, always read whole, never queried by role, and the codebase already
    /// carries role sets this way (FellowshipService.HraOverrideRoles). Revisit
    /// if role-based queries ever appear.
    /// </remarks>
    public required string AllowedRoles { get; set; }

    /// <summary>Where a newly raised instance starts. Exactly one per definition.</summary>
    public bool IsInitial { get; set; }

    /// <summary>No transition leaves this stage.</summary>
    public bool IsTerminal { get; set; }

    /// <summary>
    /// Whether an instance can be finally approved from this stage. Replaces the
    /// hardcoded DecisionStages set, which was what made WorkflowStage.Director a
    /// dead end until it was fixed.
    /// </summary>
    public bool CanApprove { get; set; }

    /// <summary>Whether an instance can be rejected from this stage.</summary>
    public bool CanReject { get; set; }

    /// <summary>Whether an instance can be returned to the requester from this stage.</summary>
    public bool CanReturn { get; set; }

    /// <summary>
    /// Where Forward goes from this stage, when it must not be "next by
    /// sequence". Null for every stage on an ordinary linear route.
    /// </summary>
    /// <remarks>
    /// Exists for branch stages like the research proposal chain's
    /// ReturnedToPI: a stage only <see cref="Return"/>'s explicit jump can
    /// land on (via WorkflowDefinition.ResubmitEntrySequence), sitting outside
    /// the main sequence so ordinary Forward never stops there. Its own exit
    /// still needs to rejoin the main route at a specific point -- this field
    /// says where, mirroring ResubmitEntrySequence's shape at the stage level
    /// instead of the definition level.
    /// </remarks>
    public int? ForwardOverrideSequence { get; set; }

    /// <summary>
    /// Exceptions to ForwardOverrideSequence, keyed by which stage most recently issued
    /// the Return that brought the instance to this branch stage. Only meaningful on a
    /// stage a Return can land on (e.g. ReturnedToPI); null for every stage on every
    /// route except the one row that needs an exception.
    /// </summary>
    /// <remarks>
    /// Stored as comma-separated "FromStage:ToSequence" pairs, e.g. "WithHOD:2" means
    /// "if the instance was returned from WithHOD, forward-out from this stage lands at
    /// sequence 2 instead of ForwardOverrideSequence" -- the same low-cardinality
    /// inline-string pattern AllowedRoles already uses on this entity, not a join
    /// table, since this is rare and always read whole.
    /// </remarks>
    public string? ForwardOverrideSequenceByReturnOrigin { get; set; }

    public WorkflowDefinition? Definition { get; set; }

    /// <summary>The roles as a list. <see cref="AllowedRoles"/> is the stored form.</summary>
    public IReadOnlyList<string> AllowedRoleList() =>
        string.IsNullOrWhiteSpace(AllowedRoles)
            ? []
            : AllowedRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    /// <summary>
    /// Parse <see cref="ForwardOverrideSequenceByReturnOrigin"/> into a map of
    /// return-origin stages to forward sequences. Returns an empty map if the field is null or empty.
    /// </summary>
    /// <remarks>
    /// Example input: "WithHOD:5,WithDean:3"
    /// Returns: { WorkflowStage.WithHOD: 5, WorkflowStage.WithDean: 3 }
    /// </remarks>
    public Dictionary<WorkflowStage, int> ForwardOverrideSequenceByReturnOriginMap()
    {
        if (string.IsNullOrWhiteSpace(ForwardOverrideSequenceByReturnOrigin))
            return [];

        var map = new Dictionary<WorkflowStage, int>();
        var entries = ForwardOverrideSequenceByReturnOrigin.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var entry in entries)
        {
            var parts = entry.Split(':', StringSplitOptions.TrimEntries);
            var stage = Enum.Parse<WorkflowStage>(parts[0]);
            var sequence = int.Parse(parts[1]);
            map[stage] = sequence;
        }

        return map;
    }
}
