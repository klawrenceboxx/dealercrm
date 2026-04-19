# DealerCRM - Production Gap List And Roadmap

## Overview

DealerCRM has a usable shell, authentication, core pages, and parts of the lead intake pipeline. It is not yet a full AutoRaptor replacement because the current product still lacks several daily-use workflows, action-first sales UI, and end-to-end communication automation.

This document is the working standard for production completion. It is not a demo checklist.

## Current Surface Assessment

### Leads

Current state in `src/pages/Leads.jsx`:
- readable list view with search and stage filter
- basic stage and intent badges
- click-through into lead detail

Missing for production:
- assigned rep visibility
- last inbound and outbound activity
- overdue follow-up status
- next action / next scheduled task
- appointment state
- quick actions for call, text, email, and note
- saved filters for sales workflows such as hot, no reply, overdue, sold, lost, source, rep
- clearer urgency hierarchy so reps know what to work first

### Lead Detail

Current state in `src/pages/LeadDetailPage.jsx`:
- lead fetch with messages, notes, activity, and files
- stage updates
- notes
- file upload and deletion
- sold financial inputs for managers

Missing for production:
- action-first contact controls
- clearer summary strip for status, intent, assignment, source, and next follow-up
- appointment booking and tracking
- communication composer for SMS and email
- template usage from the page
- explicit task ownership and due dates
- stronger timeline grouping so activity is readable at a glance
- better rep workflow around "what do I do next"

### Pipeline

Current state in `src/pages/Pipeline.jsx`:
- stage columns
- lead cards
- manual stage move through select control

Missing for production:
- stronger card metadata such as rep, last touch, age, and follow-up deadline
- clear visibility into stalled leads
- better stage movement UX
- at-risk and high-priority indicators
- column summaries that reflect actual work, not just counts
- filtering and manager views by rep and source

### Dashboard

Current state in `src/pages/Dashboard.jsx`:
- sales totals
- rep KPI metrics
- trend chart
- leaderboard

Missing for production:
- daily operating metrics for managers
- stuck leads / overdue follow-up visibility
- pending replies and no-response segments
- appointment metrics
- source quality breakdown
- conversion funnel by stage
- "needs attention now" sections instead of only historical reporting

## Production Requirements By Area

### 1. Rep Workspace

Goal: a sales rep can work a full day inside the app without external tracking.

Required outcomes:
- find the highest-priority leads fast
- see assignment, urgency, and last touch immediately
- contact a lead from the lead list or detail view
- log notes and communication history without friction
- move leads through stages with clear context
- manage next follow-up and appointments

Recommended build order:
1. Rebuild Leads into an action-first queue
2. Upgrade Lead Detail into the primary operating screen
3. Add communication actions and templates into daily workflows

### 2. Manager Workspace

Goal: a manager can monitor rep activity, lead flow, and sales outcomes without pulling data elsewhere.

Required outcomes:
- see team workload and response performance
- detect overdue leads and stalled pipeline movement
- compare rep output and source quality
- review closed-deal financials and trends
- access admin controls and audit-sensitive actions safely

Recommended build order:
1. Add operational KPI cards and "attention now" panels to Dashboard
2. Add rep/source filters across major views
3. Tighten role-aware navigation and permissions

### 3. Messaging And Automation

Goal: communication workflows are complete, traceable, and production-safe.

Required outcomes:
- inbound and outbound SMS workflows run end-to-end
- form-intake leads can move into SMS follow-up automatically when appropriate
- templates are manageable from the app
- open/click/reply events write back to activity history
- message history is visible per lead

Recommended build order:
1. finish n8n workflows 01-05
2. finish Resend webhook tracking
3. add templates UI
4. connect communication actions in Lead Detail and Leads

### 4. Reliability And Launch Readiness

Goal: the application is safe to operate as the primary CRM.

Required outcomes:
- permissions are enforced by role
- critical paths have verification scripts or manual checklists
- live deployment is validated
- production environment variables are complete
- failure states are visible in UI and logs

Recommended build order:
1. verify RLS and manager/rep boundaries
2. complete deployment verification
3. define launch checklist for lead intake, messaging, notes, files, and reporting

## UI Priorities

The highest-impact UI work is:

1. Leads as a ranked work queue instead of a plain table
2. Lead Detail as the main command center for one lead
3. Dashboard as an operating console, not just a reporting page
4. Pipeline as a stage-management tool with urgency context

## Suggested Implementation Phases

### Phase 1 - Rep Daily Workflow

Focus:
- Leads queue redesign
- Lead Detail summary and next-action panel
- communication history readability improvements

Done when:
- a rep can open the app and know exactly who to contact next

### Phase 2 - Communication System

Focus:
- SMS workflow completion
- templates UI
- message actions from the lead UI
- event tracking into activity history

Done when:
- outbound and inbound communication is handled inside the product

### Phase 3 - Manager Operating Console

Focus:
- dashboard operational panels
- overdue/stalled lead reporting
- rep comparison and source conversion visibility

Done when:
- a manager can inspect team health and intervene from inside the app

### Phase 4 - Launch Hardening

Focus:
- deployment verification
- permission review
- production QA across the full lead lifecycle

Done when:
- the product can be used as the real CRM with no demo-only assumptions

## Immediate Next Build Priorities

1. Rework `Leads.jsx` into a priority queue with assignment, last touch, overdue state, and quick actions
2. Rework `LeadDetailPage.jsx` into a command center with next action, communication actions, and appointment/task context
3. Expand `Dashboard.jsx` with operational panels for overdue leads, pending replies, and appointments
4. Complete SMS workflow and template management so UI actions connect to real automation
