# Data Model

This is a logical model. Adapt field names and database types to the selected stack. Keep relationships and workflow meaning intact.

## 1. ResearchSource

Represents an external source or evidence record.

- `id`
- `title`
- `publisher`
- `url`
- `source_type` (primary, research, reporting, commentary, other)
- `publication_date` (nullable)
- `accessed_at`
- `summary`
- `key_findings`
- `evidence_notes`
- `limitations`
- `verification_status` (unreviewed, checked, disputed, outdated, inaccessible)
- `created_at`
- `updated_at`

## 2. ResearchFinding

Represents a synthesized finding that may draw on one or more sources.

- `id`
- `question`
- `summary`
- `business_relevance`
- `problem_or_opportunity`
- `implementation_implications`
- `uncertainties`
- `potential_angles`
- `status` (new, reviewed, archived)
- `created_at`
- `updated_at`

Relationship: many-to-many with ResearchSource.

## 3. ContentIdea

- `id`
- `title`
- `pillar`
- `intended_audience`
- `problem_or_opportunity`
- `central_angle`
- `expertise_demonstrated`
- `author_input_needed` (boolean)
- `author_input_status` (not_needed, requested, supplied, waived)
- `author_input`
- `evidence_notes`
- `status` (idea, in_progress, rejected, archived)
- `created_at`
- `updated_at`

Relationship: many-to-many with ResearchFinding and ResearchSource.

## 4. ContentDraft

- `id`
- `idea_id` (nullable)
- `title`
- `body`
- `pillar`
- `status` (draft, ready_for_review, approved, published, archived)
- `revision_notes`
- `quality_review`
- `visual_recommendation`
- `approved_at` (nullable)
- `published_at` (nullable, manually entered)
- `created_at`
- `updated_at`

Relationship: many-to-many with ResearchSource. A draft may have multiple revisions; retain revision history if practical.

## 5. DraftRevision (recommended)

- `id`
- `draft_id`
- `body`
- `revision_instruction`
- `created_at`

Use this to preserve previous versions and avoid destructive overwrites.

## 6. AuthorProfile / StrategySettings

Stores non-sensitive content preferences and confirmed author context.

- `id`
- `positioning`
- `audiences`
- `content_pillars`
- `voice_preferences`
- `confirmed_projects`
- `confirmed_experiences`
- `avoid_topics_or_patterns`
- `updated_at`

Do not automatically convert AI assumptions into confirmed author facts. Author-confirmed details must be distinguishable from suggestions.

## 7. ProviderSettings

Prefer environment-based secrets rather than storing API keys in ordinary application tables.

- `id`
- `provider_name`
- `model_name`
- `enabled`
- `non_secret_configuration`
- `updated_at`

Actual API keys belong in server-side environment variables or an approved secrets manager, not in client-accessible records.

## 8. Workflow events (optional)

- `id`
- `entity_type`
- `entity_id`
- `from_status`
- `to_status`
- `actor` (user, system)
- `created_at`

Use this to make approval history auditable. A system actor must never set a draft to Approved.

## 9. Data integrity rules

- Source URLs must be stored exactly as accessed.
- A draft generated from an idea should retain its idea relationship and source links.
- A published date is only set when the user manually confirms publication.
- `approved_at` is set only after explicit user approval.
- AI-generated content must not overwrite author input without confirmation.
- Deleting a source should not silently erase the draft text; preserve a source-unavailable marker or detach safely.
