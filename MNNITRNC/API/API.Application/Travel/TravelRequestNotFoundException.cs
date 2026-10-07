namespace API.Application.Travel;

public class TravelRequestNotFoundException(Guid travelRequestId)
    : Exception($"Travel request '{travelRequestId}' was not found.");
