# LinkedIn Content Assistant

A private, interactive web application that helps its owner research, develop, draft, review, and organize thoughtful LinkedIn content.

The product is a **human-led, AI-assisted content workspace**. It is not a news aggregator, autonomous social-media manager, or auto-publishing bot.

## Product goals

- Build authority in AI implementation, business processes, and the human side of technology.
- Attract relevant clients, recruiters, and professional connections.
- Turn research, real business problems, project work, and the author's own observations into useful LinkedIn content.
- Reduce the effort required to maintain a consistent publishing rhythm without sacrificing the author's judgment or voice.

## Current decisions

- Private personal application for now.
- Build and test locally first; deploy to Vercel when ready.
- Start with free model/API tiers. Keep AI-provider integration replaceable.
- No LinkedIn account connection or automatic publishing.
- Every post requires the author's review and explicit approval.
- Target: approximately 3 posts per week and 12 per month.
- Research weekly; research depth should match the importance and complexity of the topic.
- Content emphasis: balanced thought leadership and practical implementation.

## Documentation map

- `PRD.md`: product scope, requirements, user stories, and acceptance criteria.
- `PROJECT_INSTRUCTIONS.md`: instructions and boundaries for the coding agent.
- `strategy/CONTENT_STRATEGY.md`: positioning, audience, pillars, and cadence.
- `strategy/BRAND_VOICE.md`: writing voice and style.
- `strategy/CONTENT_RULES.md`: editorial standards and approval rules.
- `agents/AGENT_INSTRUCTIONS.md`: responsibilities and operating workflow for content agents.
- `agents/RESEARCH_GUIDELINES.md`: research, source quality, verification, and synthesis.
- `agents/PROMPTS.md`: reusable task prompts.
- `technical/ARCHITECTURE.md`: proposed technical design and deployment considerations.
- `technical/DATA_MODEL.md`: core entities and relationships.
- `technical/TEST_PLAN.md`: test scenarios and acceptance checks.

## Important implementation note

These files define the product and its operating rules. They do not mean the application has already been implemented. The coding agent must inspect the repository, report the existing state, propose a small implementation plan, and then work in controlled, testable stages.

## Suggested first build sequence

1. Inspect the repository and report the current stack and existing files.
2. Confirm the proposed technical choices in `technical/ARCHITECTURE.md` against the repository.
3. Build the app shell and persistent content workspace with mock data.
4. Add research/source capture and content-idea workflows.
5. Add AI-provider abstraction and drafting/revision flows.
6. Add review, approval, and copy-to-clipboard actions.
7. Add tests, environment documentation, and Vercel deployment readiness.

Do not implement every feature in one large change. Keep the app usable at each milestone.
