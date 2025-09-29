# ADR-0001: N-tier Architecture

## Status
Accepted

## Date
2025-09-26

## Context

The Rate UKMA system must provide a reliable web platform for NaUKMA students to share and view feedback on university courses.  
The system needs to support features such as course ratings, anonymous reviews, interactive analytics, personalized recommendations, and administrator reporting.

**Forces**:

-   [NFR-PE-001](../requirements.md#nfr-s-001) requires page load to be within 1.5 seconds. The architecture must support low-latency responses for course browsing, rating submission, and analytics.
    
-  [NFR-R-002](../requirements.md#nfr-r-002) requires 99.5% monthly uptime and daily backups ([NFR-R-004](../requirements.md#nfr-r-004)) require a simple, maintainable system that minimizes operational complexity.
    
-  Small student team with limited experience favors a simple and widely-understood architecture. Complex architectures (microservices, event-driven) would increase risk and slow development.
    
-  The system will evolve over time. Clear separation of concerns is needed to prevent tightly-coupled code and ease future expansion.


## Decision
We will implement a **layered / N-tier architecture**, with the frontend and the backend as a single deployable Django service (monolithic), maintaining logical separation between layers.

## Consequences
* ✅ Clear separation of concerns makes the system easier to understand and maintain.  
* ✅ Well-suited for a small team, since it uses a simple and widely known architectural style. 
* ✅ Supports system requirements for security (centralized authentication), performance, and reliability.  
* ✅ Provides a path for future scalability (the monolith can be replicated horizontally; individual modules can be extracted later).
* ⚠️ We must keep clear, well-defined boundaries between Python modules; otherwise future extraction or refactoring will become painful
* ⚠️ Less flexible than microservices for scaling specific components in complete isolation.

## Considered Alternatives
1. **Monolith**
    * Combining all functionality into a single, unlayered codebase would make the system harder to maintain and evolve. It would mix UI and server concerns, tie frontend features to HTML + Django templates, reduce modularity, and slow down development and deployment.
2. **Microservices**
    * Rejection Reason: Too complex for a small student team with limited resources. Also introduces overhead without clear short-term benefits.
3. **Event-Driven**
    * Rejection Reason: Too complex for current requirements, requires advanced infrastructure, and does not directly address the main needs.
