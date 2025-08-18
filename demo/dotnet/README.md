# Demo .NET Project

This demo solution provides a minimal ASP.NET Core API (`Api`) and corresponding test project (`Api.Tests`).

## Structure
```
/demo/dotnet
  demo.sln
  Directory.Build.props
  src/Api
    Api.csproj
    Program.cs
  tests/Api.Tests
    Api.Tests.csproj
    ApiTests.cs
```

## Endpoints
- `/` returns a JSON hello message
- `/health` returns OK
- `/add/{a}/{b}` returns JSON with sum

## Run locally
```bash
dotnet build demo/dotnet/demo.sln
dotnet test demo/dotnet/demo.sln
dotnet run --project demo/dotnet/src/Api
```
