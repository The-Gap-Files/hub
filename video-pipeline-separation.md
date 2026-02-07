---
name: video-pipeline-separation
description: Plan to separate audio, motion, and render stages with manual approval gates.
---

# Video Pipeline Separation & Approval Control

**Project Type:** WEB + BACKEND
**Key Stakeholder:** Product Owner (User)

## Overview

The goal is to decouple the currently **semi-automated cascading** video generation pipeline into distinct, manually triggered stages. Currently, approving one stage automatically triggers the generation of the next; this must change to a fully manual trigger system.

**Current Flow (Cascading):**
1. Script Generated -> User Approves
2. **Auto-Trigger:** Image Generation -> User Approves
3. **Auto-Trigger:** Audio Generation (Immediate)
4. **Auto-Trigger:** Motion Generation (Immediate if enabled)
5. **Auto-Trigger:** Final Render (Immediate after assets exist)

**New Flow (Explicit / Stage-Gated):**
1.  **Script**: Generate -> Review -> Approve -> *Stops*.
2.  **Images**: User Clicks "Generate" -> Review -> Approve -> *Stops*.
3.  **Audio**: User Clicks "Generate" -> Review -> Approve -> *Stops*.
4.  **Motion**: User Clicks "Generate" -> Review -> Approve -> *Stops*.
5.  **Render**: User Clicks "Render Master" -> Checks all approvals -> Executes.

## Success Criteria
1.  **Database**: `Output` model includes `audioApproved` flag.
2.  **Backend**:
    *   `output-pipeline.service.ts` no longer auto-cascades.
    *   Generation methods (`generateImages`, `generateAudio`, `generateMotion`) are exposed publicly.
    *   Rendering is guarded by 4 flags: `scriptApproved`, `imagesApproved`, `audioApproved`, `videosApproved` (if motion enabled).
3.  **Frontend**:
    *   Dashboard UI with 5 distinct sections (Script, Images, Audio, Motion, Render).
    *   Explicit "Generate" buttons for each asset type.
    *   Explicit "Approve" actions for each asset type.

## Tech Stack
*   **Backend**: Node.js, Prisma (PostgreSQL)
*   **Frontend**: Vue 3 / Nuxt 4
*   **Styles**: Tailwind CSS

## File Structure & Changes

### 1. Database
*   `hub/prisma/schema.prisma`: Add `audioApproved` Boolean to `Output`.

### 2. Backend (Logic Decoupling)
*   `hub/server/services/pipeline/output-pipeline.service.ts`:
    *   **Refactor**: Remove the cascading `if (approved) { generateNext() }` logic from `execute()`.
    *   **Public Methods**: Change `generateImages`, `generateAudio`, `generateMotion` from `private` to `public`.
    *   **Validation**: Add explicit checks to `execute()` (or renamed `render()`) to throw if approvals are missing.
*   `hub/server/api/outputs/[id]/...`:
    *   `generate-images.post.ts` (Calls service.generateImages)
    *   `generate-audio.post.ts` (Calls service.generateAudio)
    *   `generate-motion.post.ts` (Calls service.generateMotion)
    *   `approve-stage.patch.ts` (Generic approval endpoint)

### 3. Frontend (UX/UI Dashboard)
*   `hub/app/pages/outputs/[id].vue`:
    *   Complete redesign of the "monitoring" view.
    *   Visual Timeline or Card Grid for the 5 stages.
    *   **State Management**: Handle "Generating...", "Waiting for Approval", "Approved" states for each block.

## Task Breakdown

### Phase 1: Database & Foundation (15 min)
- [ ] **migration-audio-approval** (Backend)
    *   Modify `schema.prisma`: Add `audioApproved` (default false).
    *   Run `npx prisma migrate dev`.
    - *Agent:* backend-specialist

### Phase 2: Decoupling Pipeline Logic (45 min)
- [ ] **refactor-service-methods** (Backend)
    *   Open `output-pipeline.service.ts`.
    *   Change `generateImages`, `generateAudio`, `generateMotion` to `public`.
    *   Remove the "waterfall" logic from `execute()`.
    *   Make `execute()` strictly a "Finalize/Render" method that validates all flags only.
    - *Agent:* backend-specialist

- [ ] **create-granular-endpoints** (Backend)
    *   Implement `POST /api/outputs/[id]/generate-images`.
    *   Implement `POST /api/outputs/[id]/generate-audio`.
    *   Implement `POST /api/outputs/[id]/generate-motion`.
    *   Implement `POST /api/outputs/[id]/render` (Calls the now-strict `execute`).
    - *Agent:* backend-specialist

- [ ] **create-approval-endpoint** (Backend)
    *   Implement `PATCH /api/outputs/[id]/approve-stage`.
    *   Body: `{ stage: 'SCRIPT' | 'IMAGES' | 'AUDIO' | 'MOTION', approved: boolean }`.
    - *Agent:* backend-specialist

### Phase 3: Frontend Dashboard (60 min)
- [ ] **ui-pipeline-dashboard** (Frontend)
    *   Create `components/output/PipelineStage.vue` (Accordion or Card component).
    *   Update `pages/outputs/[id].vue` to use these components.
    *   Fetch latest status via `useFetch`.
    *   Wire up "Generate" and "Approve" buttons to new endpoints.
    - *Agent:* frontend-specialist

### Phase X: Verification
- [ ] **Manual Test**:
    1.  Create Dossier -> Generate Script.
    2.  Approve Script -> Verify **NO** images generated automatically.
    3.  Click "Generate Images" -> Verify images generate.
    4.  Approve Images -> Verify **NO** audio generated automatically.
    5.  Click "Generate Audio" -> Verify audio generates.
    6.  Approve Audio -> Verify **NO** motion/render triggering.
    7.  Click "Render" -> Verify success via FFmpeg.

## Phase X Check
- [ ] Lint Check
- [ ] Build Check
- [ ] Manual Flow Validation
