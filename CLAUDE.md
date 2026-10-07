# Working rules

- When running test suites (`dotnet test`, etc.), always pass a timeout of 3 minutes (180000ms). If a run exceeds that, treat it as hung rather than slow: stop it and report rather than waiting further.
