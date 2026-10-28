# RPG Arena on http://localhost:5175 (API reference at /docs).
Set-Location (Join-Path $PSScriptRoot "..")
docker compose -f infra/docker-compose.yml up --build @args
