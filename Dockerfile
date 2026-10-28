FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props ./
COPY src/RpgArena.Core/RpgArena.Core.csproj src/RpgArena.Core/
COPY src/RpgArena.Api/RpgArena.Api.csproj src/RpgArena.Api/
RUN dotnet restore src/RpgArena.Api/RpgArena.Api.csproj
COPY src src
RUN dotnet publish src/RpgArena.Api/RpgArena.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ConnectionStrings__Arena="Data Source=/data/arena.db"
COPY --from=build /app/publish .
RUN mkdir -p /data && chown -R $APP_UID /data
USER $APP_UID
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["dotnet", "RpgArena.Api.dll"]
