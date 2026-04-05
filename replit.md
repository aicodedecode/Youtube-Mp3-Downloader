# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### YouTube to MP3 (`artifacts/yt-mp3`)
- **Type**: React + Vite web app
- **Preview path**: `/`
- **Purpose**: Allows users to input a YouTube URL and download the audio as an MP3 file
- **Features**:
  - URL validation (YouTube links only)
  - Video info preview (title, thumbnail, duration, view count)
  - MP3 conversion via yt-dlp + ffmpeg on the backend
  - File download with proper filename
  - Error handling for private, unavailable, or restricted videos
  - Max file size: 100MB

### API Server (`artifacts/api-server`)
- **Type**: Express 5 API
- **Routes**:
  - `GET /api/healthz` — Health check
  - `GET /api/info?url=<youtube-url>` — Fetch video metadata
  - `POST /api/download` — Convert and download as MP3

## System Dependencies

- **ffmpeg**: Used for audio conversion (pre-installed via Nix)
- **yt-dlp**: Python package for YouTube audio extraction (installed via pip/python-3.12)
- **Python 3.12**: Required runtime for yt-dlp

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
