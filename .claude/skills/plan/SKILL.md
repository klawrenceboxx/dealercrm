# Plan Skill

Use this skill when the user asks to plan a feature, task, or multi-step implementation.

## Context Budget Rules

**Hard limit: read at most 5 files before writing the plan.** If you need more context, write the plan with what you know and note assumptions.

### What to read (in priority order, stop when you have enough):
1. The specific file(s) the feature touches (e.g., the page, the schema section)
2. `src/lib/constants.js` if the feature involves stages, intents, or shared config
3. `supabase/schema.sql` if the feature involves database changes
4. The relevant n8n workflow JSON if the feature involves automation

### What to NEVER read during planning:
- `context/*.md` files (client history — not needed for technical planning)
- `SYSTEM_CONTEXT.md` (too large — 574 lines. Read specific sections only if needed)
- Every page file "to understand patterns" — read ONE page as a reference, infer the rest
- `node_modules/` anything

## Plan Format

Write plans as markdown in the Claude Code plan system. Structure:

```
# [Feature Name] — Implementation Plan

## Overview
1-3 sentences. What are we building and why.

## Files to Create/Modify
- `path/to/file.ext` — what changes

## Phase 1: [Name]
**Goal:** One sentence.
**Changes:**
- Bullet list of specific changes
**Test:** How to verify this phase works.

## Phase 2: [Name]
...

## Assumptions
- List anything you assumed without reading a file
```

## Rules
- Each phase must be self-contained and testable
- No phase should require more than 30 minutes of work
- If a phase is too large, split it
- Do NOT spawn sub-agents during planning — read files directly
- Do NOT duplicate work by exploring AND planning simultaneously
