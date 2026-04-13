# Kbia — Knowledge Base AI

## Overview
Personal knowledge base and second brain app. Saves, categorizes and analyzes web content (articles, TikToks, YouTube, PDFs), with AI-powered analysis, semantic search, chat, and note-taking.

## Architecture
- **Frontend:** Next.js 18 + React + TypeScript + Zustand + TailwindCSS + Tiptap (rich text editor)
- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic migrations
- **Database:** PostgreSQL 16 with pgvector (shared `spcapps-postgres`, DB name: `kbia`)
- **Search:** pgvector for semantic similarity, full-text search via SQLAlchemy
- **AI:** OpenAI embeddings (1536 dim), Anthropic Claude for analysis/chat
- **Domain:** https://kbia.spcapps.com
- **Repo:** spc74-hub/knowledge-base-ai (PRIVATE)

## Key modules
- **Content ingestion:** Save URLs, auto-scrape metadata, classify with IAB taxonomy
- **Explore/Search:** Faceted search (type, category, concepts, entities, tags) + full-text + semantic
- **Notes:** Quick notes (standalone_notes table) + full notes (contents with type=note)
- **Chat:** RAG-powered chat using content embeddings
- **Daily Journal:** Morning/evening journaling with AI insights
- **Habits:** Habit tracking with daily logs
- **Areas/Projects/Objectives:** PARA-inspired organization system
- **Mental Models:** Tagging system for thinking frameworks

## Database (key tables)
- `contents` — 8400+ items (articles, tiktoks, youtube, notes, apple_notes)
- `standalone_notes` — Quick notes/reflections
- `areas_of_responsibility`, `projects`, `objectives` — Organization
- `habits`, `habit_logs`, `daily_journal` — Life tracking
- `mental_models`, `taxonomy_tags` — Classification
- `users` — Single user (sergio.porcar@gmail.com)

## Auth
- JWT-based (self-hosted, migrated from Supabase auth)
- Login: email + password (bcrypt)
- Default password: `changeme` (should be changed)
- User ID from Supabase migration: `8a4dbac6-7da6-4838-a119-a19698e0a2e0`

## Important technical details
- **CompatDB** (`backend/app/db/compat.py`): Supabase-compatible query builder over SQLAlchemy. Mimics `db.table("x").select(...).eq(...).execute()` API
- **Column name mismatch:** Content model has `content_metadata = Column("metadata", JSONB)` — the Python attribute differs from DB column name. CompatDB uses `_resolve_column()` with SQLAlchemy mapper to handle this
- **Session rollback:** CompatDB's `execute()` does rollback on failure to prevent cascading `InFailedSQLTransactionError`
- **Frontend API URL:** Set via `NEXT_PUBLIC_API_URL` env var in Dockerfile (build-time). Must be `https://kbia.spcapps.com`

## Deployment
- Backend: container `kbia-backend` (FastAPI on port 8000)
- Frontend: container `kbia-frontend` (Next.js on port 3000)
- Compose: `/opt/spcapps-infra/projects/kbia/docker-compose.yml`
- Auto-deploy via webhook on `git push`

## Known issues
- Background worker error: `_process_pending_content: 'function' object has no attribute 'is_'` (non-blocking)
- `raw_content` and `embedding` fields not fully imported from Supabase (data too large for session pooler)
- Supabase still active (not yet deleted) — has the original data

## History
- Migrated from Supabase + Railway to VPS on 2026-04-13
- 42 files had hardcoded Railway URLs replaced with env var
- CompatDB fixed 3 times for metadata column resolution
- Data imported: 8407 contents, 30 notes, 12 habits, 17 projects, etc.

## Conventions
- **When making changes to this app, update this CLAUDE.md**
- All API routes under `/api/v1/`
- Endpoints use CompatDB wrapper, not raw SQLAlchemy
- Frontend hooks in `src/hooks/`, pages in `src/app/`
