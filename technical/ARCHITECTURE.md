# Technical Architecture

## 1. Architecture goals

- A real, interactive web application.
- Local-first development with a path to Vercel deployment.
- Private single-user use initially.
- Free AI/API tiers initially, with no unapproved paid usage.
- Replaceable AI providers.
- Secure server-side handling of secrets.
- Reliable persistence in both local development and production.
- Human approval as a hard workflow boundary.

## 2. Proposed baseline (confirm against the existing repository)

If the repository has no established stack, a reasonable starting point is:
- Next.js with TypeScript.
- React for the interactive interface.
- A simple, accessible component system and responsive styling.
- Server-side route handlers/actions for AI and research calls.
- A persistence layer behind a small repository/data-access interface.

Do not replace an existing working stack just to match this proposal. Inspect first and explain any material deviation.

## 3. High-level components

1. **Web UI:** dashboard, research library, ideas, editor, review panel, settings.
2. **Application layer:** workflow transitions, validation, orchestration, and business rules.
3. **Content agents/services:** research synthesis, ideation, drafting, revision, quality review.
4. **Provider adapters:** AI model provider interface and research/search provider interface.
5. **Persistence:** content records, sources, preferences, and workflow state.
6. **Deployment configuration:** local environment and Vercel environment variables.

Keep UI components separate from provider-specific logic.

## 4. AI provider abstraction

Define a provider-neutral interface for operations such as:
- Generate structured response.
- Draft or revise text.
- Review content.

Provider adapters may be added for free-tier models/APIs. The first provider should be selected based on currently available free access and compatibility at implementation time, not hard-coded into product logic.

Requirements:
- Model/provider selected through server-side configuration.
- API keys stored only in server environment variables.
- Normalize provider responses into an internal format.
- Handle rate limits, quota exhaustion, timeouts, invalid output, and provider outages.
- Never silently use a paid model.
- Show the user which provider/model was used when practical.
- Allow a provider to be changed without rewriting the content workflow.

Do not assume free tiers are permanent, unlimited, or suitable for commercial use. Check current provider terms during implementation.

## 5. Research/search abstraction

Research search is separate from text generation. An LLM does not automatically have reliable live web access.

Create a research adapter that can use an available search API or tool. Keep manual source entry available as a fallback. Store source URLs and retrieved evidence with the research record.

The research process must not treat model-generated citations or search snippets as verified sources. A source is verified only after its content has actually been accessed and checked.

## 6. Data persistence

Local development may use a convenient local database if appropriate for the repository.

**Production on Vercel must use persistent external storage.** Do not rely on a local SQLite file or local filesystem writes for production data because serverless deployments do not provide a durable shared local filesystem.

A managed database with a suitable free tier (for example, a PostgreSQL provider) may be evaluated when deployment is implemented. Confirm current pricing, limits, region, and terms before choosing. Do not create an account or paid resource without the user's approval.

Keep data access behind a repository layer so the storage implementation can change without rewriting the UI and agent logic.

## 7. Deployment

### Local
- Document setup and required environment variables.
- Provide `.env.example` with placeholders only.
- Keep `.env` out of version control.
- Ensure the app works without AI keys in a limited manual mode.

### Vercel
- Deploy only after local tests pass.
- Configure secrets in Vercel project environment settings.
- Connect a persistent production database before relying on saved data.
- Configure production URL, allowed origins, and any required security controls.
- Verify that AI calls execute server-side.
- Test rate-limit and missing-key states in the deployed environment.

## 8. Privacy and security

- Private single-user application for now.
- Do not collect LinkedIn credentials or session data.
- Never expose provider keys in client bundles, logs, or error messages.
- Validate and constrain user inputs.
- Avoid logging full private drafts or secrets unnecessarily.
- Consider basic authentication or access protection before making the Vercel deployment publicly reachable. A private intention does not make a public URL private.
- Do not add analytics or third-party tracking without approval.

## 9. Workflow state

Suggested states:
- Idea
- In Progress
- Draft
- Ready for Review
- Approved
- Published (manually marked)
- Archived

Only a deliberate user action may set Approved. Published is a manual record of an action the user performed outside the app.

## 10. Resilience

- AI failure must not delete or overwrite user-entered content.
- Save drafts before long-running generation where practical.
- Provide retry controls.
- Handle provider quota and rate limits with clear feedback.
- Allow manual creation and editing without AI access.
- Keep source records even if a provider becomes unavailable.

## 11. Architecture decisions to confirm during implementation

Before coding the persistence and provider integrations, document:
- Existing repository stack and whether it should be retained.
- First free model provider and its current terms/limits.
- First research/search method and its current free-tier limits.
- Local database choice.
- Production database choice.
- Access protection for the Vercel deployment.

These are implementation decisions, not reasons to block the initial UI and workflow prototype.
