using API.Application.NewsEvents;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/news-events")]
public class NewsEventsController(INewsEventService newsEventService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NewsEventResponse>>> GetAll([FromQuery] string? type, CancellationToken cancellationToken)
    {
        var result = await newsEventService.GetAllAsync(type, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<NewsEventResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var result = await newsEventService.GetByIdAsync(id, cancellationToken);
        if (result is null)
        {
            return NotFound(new { detail = $"News/Event with ID '{id}' not found." });
        }

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<NewsEventResponse>> Create([FromBody] CreateNewsEventRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await newsEventService.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            var message = ex.InnerException != null ? $"{ex.Message} -> {ex.InnerException.Message}" : ex.Message;
            return StatusCode(500, new { detail = message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<NewsEventResponse>> Update(int id, [FromBody] UpdateNewsEventRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await newsEventService.UpdateAsync(id, request, cancellationToken);
            if (result is null)
            {
                return NotFound(new { detail = $"News/Event with ID '{id}' not found." });
            }

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            var message = ex.InnerException != null ? $"{ex.Message} -> {ex.InnerException.Message}" : ex.Message;
            return StatusCode(500, new { detail = message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var success = await newsEventService.DeleteAsync(id, cancellationToken);
        if (!success)
        {
            return NotFound(new { detail = $"News/Event with ID '{id}' not found." });
        }

        return NoContent();
    }
}
