# Plan: Places & Recommendations

## Overview

Allow users to discover, save, and share travel places with personal recommendations.

## User Stories

- As a traveler, I can browse places by category (restaurant, hotel, attraction, etc.)
- As a traveler, I can save places I want to visit or have visited
- As a user, I can add personal notes and ratings to saved places
- As a user, I can sign up / log in to sync my saved places across devices

## Core Features

### Phase 1 — Schema & Terminology
- Define `Place`, `Recommendation`, `User` data models
- Define `PlaceCategory` enum

### Phase 2 — Convention
- TypeScript strict mode
- Component naming: PascalCase
- API calls: via `src/lib/bkend.ts`

### Phase 3 — Mockup
- Places browse page (grid layout)
- Place detail modal/page
- Save/bookmark button

### Phase 4 — API
- `GET /data/places` — list places with filters
- `POST /data/places` — create a place
- `GET /data/places/:id` — get place detail
- `POST /data/recommendations` — add recommendation
- `GET /data/recommendations?placeId=...` — get place recommendations

### Phase 5 — Design System
- Button, Card, Badge, Input components
- PlaceCard component

### Phase 6 — UI Integration
- Connect TanStack Query to bkend.ai
- Places browse page with filters
- Save/unsave place functionality

## Success Criteria

- [ ] Users can browse places
- [ ] Users can save places (requires login)
- [ ] Users can add recommendations with rating + notes
- [ ] Works on mobile (responsive)
