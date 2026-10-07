var builder = WebApplication.CreateBuilder(args);

// Config-driven routes/clusters live in appsettings.json under "ReverseProxy"
// -- see the Shodhanik-x-RNC integration plan, §9.2. Per-client deployments
// override the cluster destination addresses in their own
// appsettings.Production.json without touching this file.
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapReverseProxy();

app.Run();
