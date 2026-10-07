using RMS.Models;

namespace RMS.Services
{
    public interface IWorkflowService
    {
        Task<WorkflowInstance> StartWorkflowAsync(string workflowName, int entityId, string entityType);
        Task<WorkflowInstance> ProcessActionAsync(int instanceId, int actionByUserId, string action, string comments, string? filePath = null);
        Task<WorkflowInstance> ProcessActionByEntityAsync(int entityId, string entityType, int actionByUserId, string action, string comments, string? workflowName = null, string? filePath = null);
        Task<WorkflowInstance> ProcessActionWithDataAsync(int instanceId, int actionByUserId, string action, string comments, Dictionary<string, string> stepData, string? filePath = null);
        Task<WorkflowInstance> GetOrCreateWorkflowInstanceAsync(string workflowName, int entityId, string entityType, int? targetStepOrder = null);
        Task<IEnumerable<WorkflowInstance>> GetPendingApprovalsAsync(int roleId);
    }
}
