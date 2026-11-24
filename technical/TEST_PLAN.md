# Test Plan

## 1. Product workflow tests

| ID | Scenario | Expected result |
|---|---|---|
| WF-01 | Open dashboard with no records | Helpful empty state and clear next action |
| WF-02 | Create and edit a research source | Record persists after refresh |
| WF-03 | Create an idea linked to research | Idea and source relationship persist |
| WF-04 | Select an idea requiring personal input | App requests author input before drafting |
| WF-05 | Supply author input and generate draft | Draft uses supplied input without inventing additional personal claims |
| WF-06 | Revise a draft | Revised version is saved and previous version is retained where revision history is implemented |
| WF-07 | Run quality review | Issues and unsupported claims are clearly identified |
| WF-08 | Move draft to Ready for Review | Status changes only after user action or an explicitly permitted review workflow |
| WF-09 | Attempt automatic approval | System does not approve autonomously |
| WF-10 | User approves draft | Status becomes Approved and approval time is recorded |
| WF-11 | Copy approved post | Correct text is copied |
| WF-12 | User manually marks post Published | Published status/date are recorded |
| WF-13 | Search/filter records | Results match selected filters |
| WF-14 | Review previous posts | Prior content is visible for repetition checks |

## 2. AI and research tests

| ID | Scenario | Expected result |
|---|---|---|
| AI-01 | No provider API key configured | Manual app features work; AI action explains missing configuration |
| AI-02 | Provider returns rate limit | Clear error and retry guidance; user content is preserved |
| AI-03 | Provider times out | Request fails gracefully; no data loss |
| AI-04 | Provider returns malformed output | Response is validated and rejected or safely handled |
| AI-05 | Research search unavailable | Manual source entry remains available |
| AI-06 | Search result snippet only | Not labelled verified |
| AI-07 | Source cannot be opened | Verification status records inaccessible/unverified |
| AI-08 | Draft includes unsupported statistic | Quality review flags it |
| AI-09 | Topic requires personal experience | Agent asks author instead of inventing a story |
| AI-10 | Draft summarizes news without insight | Review flags weak analysis and requests a stronger angle |
| AI-11 | AI suggests paid provider fallback | App does not switch without explicit user approval |
| AI-12 | AI produces em dash or generic filler | Voice review flags or corrects it |

## 3. Security tests

- Confirm no API key appears in browser network responses or client bundles.
- Confirm `.env` is ignored by version control.
- Confirm `.env.example` contains placeholders only.
- Confirm server errors do not expose secrets.
- Confirm the deployed app has access protection appropriate to a private application.
- Confirm no LinkedIn credentials are requested or stored.

## 4. Persistence and deployment tests

- Confirm records survive local application restart.
- Confirm production data is stored in a persistent external database.
- Confirm a Vercel deployment does not depend on local filesystem persistence.
- Confirm environment variables are configured separately for development and production.
- Confirm missing database configuration produces a clear error rather than silent data loss.

## 5. UI tests

- Responsive layout at desktop and mobile widths.
- Keyboard access for navigation, forms, dialogs, and editor controls.
- Visible loading, empty, success, and error states.
- Clear distinction between Draft, Ready for Review, Approved, and Published.
- Destructive actions require confirmation.
- Text editing remains usable when AI services are unavailable.

## 6. Release gate

Do not call the MVP complete until:
- Core workflow tests pass.
- Type checks, linting, and production build pass where configured.
- Security checks pass.
- No known data-loss issue remains.
- Manual mode works without AI credentials.
- Vercel deployment and persistent storage behavior have been verified before production use.
