# Project Instructions for the Coding Agent

You are helping build a private, interactive LinkedIn Content Assistant web application. Follow the product requirements and editorial documents in this repository.

## Read before acting

At the beginning of a task, read:
1. `PRD.md`
2. `strategy/CONTENT_STRATEGY.md`
3. `strategy/BRAND_VOICE.md`
4. `strategy/CONTENT_RULES.md`
5. `agents/AGENT_INSTRUCTIONS.md`
6. The technical documents relevant to the task.

Do not assume that the existence of a Markdown file means it has been loaded into context. Explicitly inspect and read the relevant files.

## Working method

- Inspect the current repository and existing implementation before making changes.
- First report what exists, what is missing, and the smallest sensible next step.
- Do not overwrite, delete, rename, or restructure existing files without explaining why and obtaining approval when the change is substantial.
- Make focused, incremental changes. Avoid unrelated refactors.
- Preserve working functionality.
- Do not silently change product decisions or scope.
- If requirements conflict or a technical choice has meaningful trade-offs, stop and ask one focused question.
- Do not claim a feature works unless it has been implemented and tested.
- Run relevant tests, linting, type checks, and build checks after changes where available.
- Report exactly what changed, what was tested, the result, and any remaining limitations.
- Update documentation when implementation decisions change.

## Product boundaries

- This is a private, single-user application for now.
- Build locally first; prepare for Vercel deployment.
- Use free model/API tiers initially. Keep provider integrations replaceable.
- Do not add paid services or incur costs without explicit approval.
- Do not collect LinkedIn passwords, session cookies, or credentials.
- Do not implement automatic LinkedIn publishing.
- Human review and explicit approval are mandatory.
- Do not invent personal experience, opinions, client work, metrics, credentials, or project outcomes.
- Do not turn the product into a news aggregator.

## Technical boundaries

- Keep API keys and provider secrets on the server.
- Use environment variables and provide an `.env.example` containing placeholders only.
- Never commit `.env` files, real API keys, or personal secrets.
- Handle provider rate limits, missing configuration, timeouts, and malformed responses.
- Preserve user input if an AI request fails.
- Use persistent storage appropriate to the deployment environment. Do not rely on a local filesystem database for production persistence on Vercel.
- Do not add dependencies without a reason.
- Do not use a paid API by default or silently fall back to one.

## UI expectations

- The interface must be a real, interactive web application, not a static mockup.
- Buttons and controls must perform their stated actions.
- Provide loading, empty, success, and error states.
- Use clear navigation and status labels.
- Make editing and reviewing content comfortable.
- Keep the UI responsive and accessible.
- Avoid decorative complexity that makes the workflow harder.

## Definition of done

A task is done only when:
- The requested behavior is implemented.
- Relevant tests/checks have been run.
- Known limitations are stated.
- Documentation is updated if needed.
- No unrequested destructive changes were made.
