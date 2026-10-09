using API.Application.Procurement;
using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Travel;

public static class TravelDocumentModelFactory
{
    public static TravelDocumentModel Build(
        TravelRequest request,
        IReadOnlyList<TravelJourneyLeg> journeys,
        Project project,
        BudgetHead head,
        FacultyProfileInfo faculty,
        string travelerName) =>
        new(
            project.ProjectTitle,
            project.Agency,
            project.SanctionNo,
            head.CustomLabel ?? HeadLabel(head.HeadName),
            faculty.Name,
            faculty.Designation,
            faculty.Department,
            travelerName,
            BuildTravelerTypeLabel(request),
            request.Place,
            request.Purpose,
            request.OnwardDate,
            request.ReturnDate,
            BuildPrimaryModeLabel(request),
            request.TaxiReimbursementOptedIn,
            request.AccommodationDetails,
            request.AccommodationCost,
            request.OtherExpensesDetails,
            request.OtherExpensesCost,
            request.JourneyTotalCost,
            request.ExpectedCost,
            [
                .. journeys
                    .OrderBy(j => j.SequenceOrder)
                    .Select((j, index) => new TravelJourneyLegRow(
                        index + 1,
                        j.JourneyFrom,
                        j.JourneyTo,
                        j.JourneyDate,
                        ModeLabel(j.Mode),
                        PlatformLabel(j.BookingPlatform),
                        j.Amount,
                        j.Remarks))
            ]);

    public static string BuildTravelerTypeLabel(TravelRequest request)
    {
        var types = !string.IsNullOrWhiteSpace(request.TravelerTypes)
            ? request.TravelerTypes.Split(',').Select(Enum.Parse<TravelerType>).ToList()
            : [request.TravelerType];

        var labels = types.Select(t => t switch
        {
            TravelerType.Self => "Self (Principal Investigator)",
            TravelerType.Manpower => "Project Manpower",
            TravelerType.CoPi => "Co-Principal Investigator",
            TravelerType.Other => !string.IsNullOrWhiteSpace(request.OtherTravelerDetails) ? $"Other ({request.OtherTravelerDetails})" : "Other",
            _ => t.ToString(),
        });

        return string.Join(", ", labels);
    }

    public static string BuildPrimaryModeLabel(TravelRequest request)
    {
        var modes = !string.IsNullOrWhiteSpace(request.PrimaryModes)
            ? request.PrimaryModes.Split(',').Select(Enum.Parse<TravelMode>).ToList()
            : [request.PrimaryMode];

        var labels = modes.Select(m => m switch
        {
            TravelMode.Air => "Air",
            TravelMode.Rail => "Rail",
            TravelMode.RoadPrivateTaxi => "Road: Private Taxi",
            TravelMode.RoadPersonalCar => "Road: Personal Car",
            TravelMode.RoadCommonTransport => "Road: Common Transport Mode",
            TravelMode.Other => !string.IsNullOrWhiteSpace(request.OtherPrimaryModeDetails) ? $"Other ({request.OtherPrimaryModeDetails})" : "Other",
            _ => m.ToString(),
        });

        return string.Join(", ", labels);
    }

    /// <summary>Legacy's travel_by display strings, preserved for the printed form.</summary>
    public static string ModeLabel(TravelMode mode) => mode switch
    {
        TravelMode.Air => "Air",
        TravelMode.Rail => "Rail",
        TravelMode.RoadPrivateTaxi => "Road: Private Taxi",
        TravelMode.RoadPersonalCar => "Road: Personal Car",
        TravelMode.RoadCommonTransport => "Road: Common Transport Mode",
        TravelMode.Other => "Other",
        _ => mode.ToString(),
    };

    public static string PlatformLabel(BookingPlatform platform) => platform switch
    {
        BookingPlatform.IRCTC => "IRCTC",
        BookingPlatform.AshokaTravel => "Ashoka Travel",
        BookingPlatform.BalmerLawrie => "Balmer Lawrie",
        BookingPlatform.Other => "Other",
        _ => platform.ToString(),
    };

    private static string TravelerTypeLabel(TravelerType type) => type switch
    {
        TravelerType.Self => "Self (Principal Investigator)",
        TravelerType.Manpower => "Project Manpower",
        TravelerType.CoPi => "Co-Principal Investigator",
        TravelerType.Other => "Other",
        _ => type.ToString(),
    };

    private static string HeadLabel(BudgetHeadName name) => name switch
    {
        BudgetHeadName.RecurringTravel => "Recurring - Travel",
        _ => name.ToString(),
    };
}
