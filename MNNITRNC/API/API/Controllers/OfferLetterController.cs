using API.Application.Projects;
using API.Contracts.Projects;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/offer-letters")]
[Authorize]
public class OfferLetterController(IProjectService projectService) : ControllerBase
{
    [HttpPost]
    [HttpPost("/api/projects/offer-letters")]
    public async Task<ActionResult<OfferLetterResponse>> CreateOfferLetter([FromBody] CreateOfferLetterRequest request)
    {
        var userId = User.GetUserId();

        var letter = await projectService.CreateOfferLetterAsync(
            userId,
            request.ProjectId,
            request.ManpowerId,
            request.CandidateName,
            request.Gender,
            request.ParentName,
            request.Address,
            request.City,
            request.State,
            request.Pincode,
            request.FellowshipAmount,
            request.HraPercentage,
            request.JoiningDate,
            request.FilePath);

        return Ok(new OfferLetterResponse(
            letter.Id, letter.ProjectId, letter.ManpowerId, letter.CandidateName, letter.Gender,
            letter.ParentName, letter.Address, letter.City, letter.State, letter.Pincode,
            letter.FellowshipAmount, letter.HraPercentage, letter.JoiningDate, letter.FilePath,
            letter.GeneratedBy, letter.GeneratedAt));
    }

    [HttpGet]
    [HttpGet("/api/projects/offer-letters")]
    public async Task<ActionResult<IReadOnlyList<OfferLetterResponse>>> GetOfferLetters([FromQuery] Guid? projectId, [FromQuery] Guid? manpowerId)
    {
        var letters = await projectService.GetOfferLettersAsync(projectId, manpowerId);
        return Ok(letters.Select(letter => new OfferLetterResponse(
            letter.Id, letter.ProjectId, letter.ManpowerId, letter.CandidateName, letter.Gender,
            letter.ParentName, letter.Address, letter.City, letter.State, letter.Pincode,
            letter.FellowshipAmount, letter.HraPercentage, letter.JoiningDate, letter.FilePath,
            letter.GeneratedBy, letter.GeneratedAt)).ToList());
    }
}
