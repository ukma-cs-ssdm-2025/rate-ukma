# ADR-0003: Technology Stack


## Status
Accepted


## Date
2025-09-26


## Context
The Rate UKMA system requires a modern, maintainable, and scalable technology stack to support features like course ratings, anonymous reviews, personalized recommendations, and administrator reporting.
The team is small, with limited resources, so technologies should be simple, widely known, and well-documented.

**Forces**
- **Small team vs. long-term scalability:** The team needs a stack that is simple enough for a small group to deliver quickly, but also robust enough to grow with future demand.
- **Maintainability & Scalability:** The system will evolve over time. Chosen technologies should allow modular development, easy maintenance, and future expansion without massive refactoring.


## Decision
The technology stack will consist of:

* **Frontend/UI:** React JS 
* **Backend:** Django  
* **Database:** PostgreSQL  


## Consequences
* ✅ Clear separation of concerns: React handles UI, Django handles backend logic, and PostgreSQL handles data persistence. This reduces coupling and improves maintainability.  
* ✅ Rapid development: Django provides built-in ORM, authentication, and admin interface, enabling faster feature implementation.  
* ✅ Wide community support: All chosen technologies are mature, well-documented, and widely used, reducing the risk of knowledge gaps or unsupported features.  
* ✅ Scalable architecture: The monolithic Django backend can be horizontally replicated; modules can be extracted into separate services later if needed.  
* ✅ Cross-platform compatibility: React is browser-based, Django supports multiple OS deployments, and PostgreSQL runs on most platforms.  
* ⚠️ Module boundaries must be enforced: Without careful modularization, the monolith could become tightly coupled and harder to maintain.  
* ⚠️ Limited component-level scaling: Unlike microservices, specific parts of the system (e.g., recommendation engine) cannot be independently scaled without scaling the whole backend. 


## Considered Alternatives

### Backend Programming Language
1. **Java**
   * Mature, performant, strong typing. Rejected due to higher complexity for a small team.
2. **Rust**
   * High performance and safety. Rejected due to steep learning curve and lack of rapid web development libraries.

### Backend Framework
1. **Flask**
   * Lightweight, flexible. Rejected because Django provides built-in ORM, authentication, and admin interface, speeding up development.  

### UI Framework
1. **Angular**
   * Full-featured, strongly-typed. Rejected for being more complex and having a steeper learning curve compared to React.  

### Database
1. **MySQL**
   * Popular, relational. Rejected since PostgreSQL provides better support for complex queries, JSON fields, and advanced features.  
2. **SQLite**
   * Easy for prototyping. Rejected due to lack of concurrency and scaling for production.  
