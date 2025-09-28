# ADR-0000: Use Architecture Decision Records

## Status

Accepted

## Date

2025-09-28

## Context

Right now, architecture and major design choices are made on the fly, often communicated through discussions. As the project grows, this approach leads to several problems:

* **Knowledge Loss:** We might forget why we made certain choices.
* **Wasted Time:** We may repeatedly discuss and revisit decisions that were already made.
* **High Onboarding Cost:** Potential new team members will find it harder to understand the evolution of the architecture.

## Decision

We will start  using **Architecture Decision Records (ADRs)** to document all major design choices.

1. Every major design choice will be a numbered **Markdown file** (e.g., `0000-use-adrs.md`) stored in a dedicated `docs/architecture/decisions/` folder.
2. Each file will follow a standard template (`TEMPLATE.md`) covering the **Status**, **Date**, **Context**, **Decision**, **Consequences** and **Considered Alternatives**.
3. The `Status` field within each ADR will be actively maintained (e.g., updated from Proposed to Accepted when approved, or marked as Deprecated if superseded).
4. A main `INDEX.md` file will serve as the central, categorized log of all ADRs.

## Consequences

* ✅ Clear History of design choices.
* ✅ Faster Onboarding for new team members.
* ✅ Less time will be spent re-discussing old choices.
* ⚠️ We must maintain the ADRs, adding a small amount of overhead to the development process.
* ⚠️ There is a risk that ADRs could become outdated if they are not consistently updated when the architecture changes.

## Considered Alternatives

1. **Random Notes or Project Documents**
    * Rejection Reason: Lacks a clear structure, easy to lose.
2. **Separate Wiki**
    * Rejection Reason: Another system to manage, not that close to code.
3. **Code Comments or Inline Documentation**
    * Rejection Reason: Too focused on small details, rather implementation than high-level architectural decisions, spread across the codebase.
