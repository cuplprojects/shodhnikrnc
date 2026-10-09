using System;
using System.Collections.Generic;

namespace API.Domain.Entities;

public class LeaveCancellationRequest
{
    public Guid Id { get; set; }
    
    public Guid LeaveRequestId { get; set; }
    public LeaveRequest? LeaveRequest { get; set; }
    
    public Guid WorkflowInstanceId { get; set; }
    
    public List<DateOnly> CancelledDates { get; set; } = [];
    
    public string? Reason { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
}
