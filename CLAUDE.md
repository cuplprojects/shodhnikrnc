# Working in this repo

## Test suite time limit

`dotnet test` (full suite or any large subset) has a **hard 2-minute cap**.
If it has not finished within 2 minutes, kill it and move forward with the
task rather than continuing to wait.

- Run it with an explicit timeout no greater than 2 minutes (120000ms).
- If it doesn't finish in time: kill any stuck `testhost.exe`/build-server
  process, note in your response that the full run didn't complete, and
  proceed — do not re-run it in a loop or wait again "just this once."
- Prefer a *targeted* run (`dotnet test --filter "FullyQualifiedName~<Suite>"`)
  scoped to the area you actually changed over a full-suite run when you
  need a fast, reliable signal — the full suite is slow and this repo's
  test hosts are prone to getting stuck (locked files from a previous
  `dotnet build`/`dotnet test`/IDE process are the most common cause).
- A full-suite run is worth doing once, deliberately, when you need the
  real regression count — but even then, respect the 2-minute cap. If it
  times out, that's a signal to investigate why (stale process, resource
  contention) rather than to simply wait longer next time.

This applies to every session and every subagent dispatched to work in
this repo, not just interactively.
