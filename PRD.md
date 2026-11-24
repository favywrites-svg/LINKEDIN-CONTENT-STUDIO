# Product Requirements Document (PRD)

## 1. Product summary

**Product name:** LinkedIn Content Assistant (working title)

A private web application that supports the author's LinkedIn content workflow from research through approval. It combines structured research, content opportunity discovery, author input, AI-assisted drafting, quality review, and a simple dashboard.

The application must help the author demonstrate expertise and authority. It must not turn the author's LinkedIn presence into a stream of headlines or generic AI-generated posts.

## 2. Problem

Maintaining a consistent, credible LinkedIn presence requires more than generating text. The author needs to identify worthwhile problems, understand relevant developments, form a useful perspective, connect ideas to practical implementation, and produce clear posts in a recognizable voice.

A generic AI writer can produce fluent but shallow content, invent personal experiences, repeat common takes, or summarize news without demonstrating expertise. This product addresses those weaknesses through research standards, explicit editorial rules, author contribution, and mandatory human approval.

## 3. Goals

1. Help the author publish approximately 3 thoughtful posts per week (12 per month).
2. Build credibility in AI implementation, business processes, practical automation, and the human side of technology.
3. Attract potential clients, recruiters, hiring managers, founders, and operations leaders.
4. Make digital health and pharmaceutical technology recurring areas of perspective without restricting all content to healthcare.
5. Reduce research, planning, drafting, and organization effort.
6. Create a portfolio-worthy product demonstrating product thinking, agent workflows, research discipline, human-in-the-loop design, and practical implementation.

## 4. Non-goals

- Automatically publishing to LinkedIn.
- Connecting to or storing LinkedIn credentials.
- Acting as a real-time news feed or headline aggregator.
- Generating posts without author input when personal experience or opinion is required.
- Guaranteeing reach, engagement, leads, employment, or business outcomes.
- Building a multi-tenant SaaS product in the first version.
- Requiring paid AI subscriptions or paid APIs for the initial version.
- Generating an image for every post.
- Replacing the author's judgment or professional accountability.

## 5. Users

**Primary user:** One private user, the author.

The interface may be designed cleanly enough to support future productization, but multi-user accounts, teams, billing, and public sign-up are out of scope unless separately approved.

## 6. Positioning and audience

The author is an AI implementation professional with a pharmacy background and an understanding of business operations. The distinguishing perspective is the ability to recognize process problems, evaluate where AI is useful, and translate ideas into practical solutions.

Primary audiences:
- Recruiters and hiring managers.
- Business owners and founders.
- Operations managers and process leaders.
- Health-tech and digital-health organizations.

The pharmacy background should add credibility and a distinctive lens in healthcare, digital health, and pharmaceutical technology. It should not dominate every post or make the author appear limited to healthcare.

## 7. Content strategy

### Central theme

**AI implementation, business processes, and the human side of technology.**

The editorial emphasis is balanced:
- Thought leadership: analysis, interpretation, critical thinking, and useful professional perspectives.
- Practical implementation: workflows, project builds, technical decisions, examples, and lessons.

Guiding philosophy: **Think critically. Build practically. Communicate clearly.**

### Content pillars and monthly allocation

| Pillar | Monthly target | Purpose |
|---|---:|---|
| Practical business problems and AI implementation | 4 | Show understanding of real operational problems and how technology may help |
| Project builds and workflow demonstrations | 3 | Demonstrate practical ability, decisions, trade-offs, and learning |
| AI industry commentary and business developments | 3 | Interpret developments and explain business implications, not merely report news |
| Human reflections and professional perspectives | 2 | Make the author relatable through considered views on work, productivity, and technology |

Digital health and pharmaceutical technology should recur across the pillars rather than being isolated in a separate pillar.

### Topic emphasis

- AI implementation and identifying where AI is genuinely useful.
- AI-powered business process automation.
- AI in healthcare and pharmaceutical technology.
- Business operations, task management, and process optimization.
- Healthcare operations and digital-health workflows.
- Marketing, content creation, and business growth where relevant.
- Some AI agents and agentic workflows, without making them the only subject.

### Cadence

- Approximately 3 posts per week.
- Target 12 posts per month.
- Weekly research and planning.
- The schedule is a target, not a reason to publish weak or repetitive content.

## 8. Core user workflow

1. The system conducts or supports a weekly research pass.
2. It saves research findings with sources, dates, evidence, limitations, and business relevance.
3. It proposes content opportunities with a clear audience, problem, angle, and expertise demonstrated.
4. The author selects an idea.
5. Where the topic requires the author's experience or opinion, the system asks for input before drafting.
6. The system performs focused follow-up research and fact-checking as needed.
7. It drafts a LinkedIn post in the author's voice.
8. It checks the draft against editorial, factual, originality, and tone requirements.
9. It suggests a visual only when one genuinely improves comprehension or impact.
10. It saves the draft and its source trail in the dashboard.
11. The author edits, requests revisions, approves, copies, and publishes manually.

## 9. Functional requirements

### FR-01: Dashboard
The home screen must show useful summaries and clear entry points to Ideas, Research, Drafts, and Approved content. It should show content counts and the current workflow state without pretending to provide LinkedIn analytics.

### FR-02: Research library
The user can create, view, edit, and archive research records. Each record should include title, source URL, publisher, publication date (if known), date accessed, summary, key evidence, limitations, business relevance, possible content angles, and verification status.

### FR-03: Content ideas
The user can review proposed ideas, inspect their supporting research, select an idea, edit it, reject it, or save it for later. Each idea should state the problem/opportunity, intended reader, central angle, expertise demonstrated, and why it is worth discussing.

### FR-04: Author input
Before drafting a topic that depends on personal experience, personal opinion, or a project result, the system must request the author's contribution. The app must distinguish supplied author input from AI suggestions.

### FR-05: Drafting
The user can generate a draft from an approved idea and relevant context. Drafts must be editable in the interface and linked to their source records and originating idea.

### FR-06: Revision
The user can request revisions with instructions such as shorter, clearer, more conversational, more practical, stronger opening, less formal, or more analytical. Revisions must preserve factual accuracy and author-provided meaning.

### FR-07: Quality review
The system must evaluate factual support, clarity, originality, audience relevance, voice, practical value, and whether the post demonstrates expertise. It must flag unsupported claims and invented personal experience.

### FR-08: Workflow states
At minimum, content must support: Idea, In Progress, Draft, Ready for Review, Approved, Published (manually marked), and Archived. Approval must be a deliberate user action.

### FR-09: Copy and manual publishing
The user can copy the final post text. The interface may provide a reminder that the user must publish manually. No automated publishing or LinkedIn credential collection.

### FR-10: Visual guidance
The system can recommend no image, a sourced image, or a simple explanatory visual when appropriate. It must explain why a visual adds value. It must not force an image onto every post.

### FR-11: Search and organization
The user can search/filter content by status, pillar, topic, date, and keyword. The user can view previous posts to reduce repetition.

### FR-12: Settings and provider configuration
AI provider/model settings must be configurable through environment variables or a safe settings interface. API keys must remain server-side and never be exposed to browser code or committed to source control.

### FR-13: Failure handling
The app must show understandable errors for unavailable providers, rate limits, missing API keys, malformed responses, and network failures. User-entered content must not be lost when an AI request fails.

## 10. Non-functional requirements

- Private-by-default application.
- Responsive, usable web interface.
- Secure handling of API keys and user data.
- Clear separation between UI, application logic, provider adapters, and persistence.
- Local development support and Vercel deployment readiness.
- Graceful handling of free-tier limits.
- Data export or backup should be considered before public deployment.
- No claim that research has been verified unless the source was actually checked.

## 11. MVP scope

MVP should include:
- Interactive dashboard.
- Ideas, research, drafts, and approved-content views.
- Persistent storage.
- Manual creation/editing of records.
- AI-assisted research synthesis and idea generation where a supported search capability exists.
- AI-assisted drafting and revision through a provider adapter.
- Source links and evidence notes.
- Author input checkpoint.
- Quality review.
- Explicit approval and copy-to-clipboard.
- Local setup and Vercel deployment instructions.

A reliable manual source-entry workflow must exist even if free search APIs are unavailable or rate-limited.

## 12. Future enhancements (not MVP commitments)

- Optional performance tracking entered manually by the author.
- Content calendar and reminders.
- More advanced duplicate/topic-similarity checks.
- Visual/diagram generation if separately approved.
- Additional model providers and research integrations.
- Multi-user support only if the product direction changes.

## 13. Acceptance criteria

The MVP is acceptable when:
1. The user can open the web app locally and navigate the main workspace.
2. The user can create, edit, search, and change the status of ideas and drafts.
3. Research records retain source URLs and evidence notes.
4. An idea can be converted into a draft while preserving its research links.
5. The system asks for author input when personal experience or opinion is needed.
6. The system does not invent personal stories, credentials, results, or project outcomes.
7. A draft can be revised and reviewed against the editorial rules.
8. A post cannot become Approved without an explicit user action.
9. The user can copy an approved post and publish it manually.
10. Missing or rate-limited AI providers do not crash the app or erase user work.
11. Secrets are not exposed in client-side code or committed to the repository.
12. The app can be prepared for Vercel deployment with a persistent production data store.

## 14. Product success measures

Measure only after real use:
- Time spent researching and preparing a post.
- Percentage of AI drafts accepted after editing.
- Average editing time per draft.
- Number of posts prepared and manually published.
- Frequency of unsupported claims caught during review.
- User-rated usefulness of suggested ideas.

Do not invent baseline values or claim improvements before collecting evidence.
