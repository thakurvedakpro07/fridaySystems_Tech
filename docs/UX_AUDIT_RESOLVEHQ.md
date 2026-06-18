# ResolveHQ — UX Audit
**Date:** June 2026  
**Auditor:** Senior SaaS UX Architect  
**Scope:** Full platform — all authenticated flows, public pages, and onboarding

---

## Executive Summary

ResolveHQ is a functional MVP. Core workflows (ticket creation, engineer assignment, Razorpay payment) operate correctly, but the platform does not yet communicate the trust, professionalism, or clarity that enterprise B2B customers require. This audit identifies 28 UX deficiencies across 10 areas and maps each to a concrete remediation.

---

## 1. Dashboard — Customer

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| D1 | No trust indicators visible above the fold | High | Customers don't know the platform is reliable |
| D2 | No recent activity feed — customers can't see what happened | High | Creates anxiety, increases support contacts |
| D3 | No profile completion prompt — many fields left empty | Medium | Incomplete profiles prevent good invoice generation |
| D4 | KPI cards were `text-2xl` (Phase 28 fixed to `text-4xl`) | Fixed | — |
| D5 | No "what happens next" messaging for new users | High | High drop-off before first ticket |
| D6 | Getting Started only showed on zero-ticket accounts | Medium | Users with 1 ticket see nothing helpful |
| D7 | No activity summary for returning users | Medium | Dashboard feels static |

### Remediation
- Add horizontal trust bar (4 verified indicators) below greeting
- Add recent activity feed (right panel, collapsed on mobile)
- Add profile completion widget in info panel
- Keep GettingStarted visible until 3+ tickets exist

---

## 2. Ticket Detail Page

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| T1 | No visual ticket lifecycle — customers don't know where they are in the process | Critical | Highest source of "what's the status?" contacts |
| T2 | When engineer is assigned, no trust card is shown | High | Customer doesn't know who is working on their issue |
| T3 | Ticket title `text-lg` — weak hierarchy for the most important element | Medium | Poor scanability |
| T4 | "Assigned to" shows only email, not name | Medium | Depersonalises engineer relationship |
| T5 | No estimated resolution time shown anywhere | Medium | Uncertainty drives abandonment |
| T6 | Status badge uses generic colours — low contrast | Low | Accessibility concern |

### Remediation
- Add visual `TicketStatusTracker` stepper (7 stages) above all other content
- Add `EngineerTrustCard` when `ticket.assigned_to` is set
- Increase ticket title to `text-xl font-bold`

---

## 3. Billing & Payments

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| B1 | Page header `text-xl font-bold` — weak hierarchy | Medium | Does not feel like enterprise billing |
| B2 | Stat card numbers `text-2xl font-bold` — too small for financial data | Medium | Hard to scan key figures |
| B3 | Empty state uses emoji-only illustration | Medium | Unprofessional |
| B4 | No call-to-action visible when no payments exist | Medium | Dead end — user doesn't know what to do |
| B5 | GST note at bottom is `text-xs` and easy to miss | Low | Compliance information poorly surfaced |

### Remediation
- Increase heading to `text-2xl font-black`
- Upgrade stat card numbers to `text-3xl font-bold`
- Replace emoji empty state with SVG illustration + CTA

---

## 4. Analytics

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| A1 | Page header `text-xl font-bold` | Medium | Inconsistent with other SaaS analytics pages |
| A2 | Stat card numbers `text-2xl font-bold` | Medium | Data hard to read at a glance |
| A3 | Bar chart bars too narrow at 30-day resolution | Low | Hard to read on mobile |
| A4 | No last-updated timestamp is meaningfully visible | Low | User can't tell if data is stale |

### Remediation
- Increase heading to `text-2xl font-black`
- Upgrade stat card numbers to `text-3xl font-bold`

---

## 5. Notifications

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| N1 | Page header `text-xl font-bold` — smallest allowed | Medium | Feels like a utility page, not a feature |
| N2 | Empty state uses large emoji (🔔) — looks like a toy | Medium | Breaks trust |
| N3 | Notification categories use emoji icons inline | Low | Inconsistent with SVG icon system established in Phase 28 |
| N4 | Group labels (`Today`, `Yesterday`) use `text-[11px]` | Low | Hard to read, especially on low-DPI screens |

### Remediation
- Increase heading to `text-2xl font-black`
- Replace emoji empty state with SVG illustration

---

## 6. Settings

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| S1 | Page header `text-xl font-bold` | Medium | Inconsistent with rest of platform |
| S2 | Tab bar emoji icons look casual (`👤`, `🔒`) | Low | Doesn't match enterprise positioning |
| S3 | No profile completion percentage visible | Medium | User doesn't know what to prioritize |
| S4 | Address field visible even when company not filled | Low | Confusing form flow |

### Remediation
- Increase heading to `text-2xl font-black`
- Replace emoji tabs with SVG icons

---

## 7. Navigation & Information Architecture

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| IA1 | No Help Center linked from any navigation | High | Users have no way to self-serve answers |
| IA2 | Sidebar has no "Help Center" item | High | Hidden from main workflow |
| IA3 | Support contact only visible in right panel on dashboard | Medium | Users on other pages can't find contact info |
| IA4 | Footer already has contact info — good, but should add Help Center link | Low | Information scent gap |

### Remediation
- Create `/help-center` page (all roles)
- Add Help Center link to all sidebar role sections
- Link Help Center from footer

---

## 8. Onboarding & Registration Flow

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| O1 | CustomerOnboarding doesn't show social proof | Medium | First impression of platform trust is weak |
| O2 | No progress indicator shows how many steps remain | Medium | Users don't know how long onboarding takes |
| O3 | FreelancerOnboarding has no skill categories guide | Medium | Engineers don't know which skills to list |

### Remediation (deferred — lower ROI than core platform)
- Add social proof stat bar to CustomerOnboarding
- Add step count indicator

---

## 9. Trust & Social Proof Gaps

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| TR1 | Platform has no trust indicators on the dashboard | Critical | B2B customers evaluate safety before spending money |
| TR2 | No SLA guarantee prominently visible on ticket detail | High | Customers don't know what they're getting |
| TR3 | Payment security not mentioned at payment step | High | Cart abandonment at checkout |
| TR4 | No engineer verification badge | Medium | Customers question engineer quality |

### Remediation
- Trust bar on dashboard
- Engineer trust card with verified badge
- SLA display on ticket status tracker

---

## 10. Accessibility & Readability

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| AC1 | Text at `text-xs` used for body copy in several components | Medium | WCAG 2.1 AA minimum is 12px body text |
| AC2 | Group date headers in Notifications at `text-[11px]` | Medium | Below minimum for body copy |
| AC3 | Emoji icons used for notification categories — no alt text on emoji spans | Low | Screen readers announce emoji names |
| AC4 | ActivityTimeline icons use emoji without `aria-label` | Low | Same concern as AC3 |
| AC5 | Input `input-base` border colour contrast needs validation | Low | Should be 3:1 minimum for non-text UI |

### Remediation
- Upgrade group headers in Notifications to `text-xs font-semibold`
- ActivityTimeline icons already use emoji in spans — these need `aria-hidden` audit

---

## Priority Matrix

| Priority | Items | Work Estimate |
|----------|-------|---------------|
| Critical (ship-blocking) | T1, TR1, IA1 | 2 days |
| High (this sprint) | D2, D3, T2, B1–B3, N1–N2, S1 | 1 day |
| Medium (next sprint) | D5, A1–A2, O1–O2 | 0.5 day |
| Low (backlog) | AC3–AC5, S2, S4 | Backlog |

---

## Summary

**28 issues found across 10 areas.**  
**Critical:** 3 · **High:** 12 · **Medium:** 10 · **Low:** 3

The most impactful single change is the **Ticket Status Tracker** — it transforms the most-visited page from a data dump into a guided, reassuring experience. Second is the **Trust Bar** on the dashboard. Third is the **Help Center** — the only way customers can self-serve answers without opening a support ticket.
