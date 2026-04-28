## ADDED Requirements

### Requirement: Community blog posts SHALL support managed publication lifecycle
The system SHALL allow authorized admin users to create, edit, publish, unpublish, and delete community blog posts while preserving draft and published states.

#### Scenario: Admin creates a draft post
- **WHEN** an authorized admin submits a valid blog post in draft state
- **THEN** the system stores the post with draft status and makes it visible only to authorized admins

#### Scenario: Admin publishes a post
- **WHEN** an authorized admin publishes a draft blog post
- **THEN** the system marks the post as published, records publication metadata, and exposes it to public community readers

### Requirement: Public community readers SHALL only access published posts
The system SHALL restrict public read access to posts in published state and SHALL prevent public access to drafts or unpublished content.

#### Scenario: Public reader opens published post
- **WHEN** a public reader requests a blog post that is published
- **THEN** the system returns the post content and metadata for rendering

#### Scenario: Public reader requests draft post
- **WHEN** a public reader requests a blog post that is draft or unpublished
- **THEN** the system denies access and returns a not-found or unauthorized outcome without leaking draft content

### Requirement: Community blog listing SHALL provide deterministic user states
The system SHALL provide community blog list and detail views with consistent loading, empty, and error states.

#### Scenario: Blog list has results
- **WHEN** published posts are available
- **THEN** the system renders the list ordered by publication recency with post summary metadata

#### Scenario: Blog list has no published content
- **WHEN** no published posts are available
- **THEN** the system renders an explicit empty state message in the community section

### Requirement: Blog post data SHALL enforce validation constraints
The system SHALL validate required post fields before persistence and SHALL reject invalid payloads with actionable errors.

#### Scenario: Missing required fields
- **WHEN** an admin submits a blog post without required title or body content
- **THEN** the system rejects the request and returns validation feedback identifying missing fields

#### Scenario: Valid post payload
- **WHEN** an admin submits all required fields in valid format
- **THEN** the system accepts and persists the post successfully
