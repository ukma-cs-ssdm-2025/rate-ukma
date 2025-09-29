# High-Level Architecture Overview

The **Rate UKMA** system is built using a **layered / N-tier architecture** (see [ADR-0001: N-tier Architecture](../decisions/0001-n-tier-arch.md)), separating the application into presentation, edge/API, business logic, data access, and data layers, while integrating external systems.

See diagrams:
- [High-Level Design Diagram](./uml/high-level-design.svg)
- [PlantUML Source](./uml/high-level-design.puml)

## System Context

The Rate UKMA platform enables students of NaUKMA to browse courses, share ratings, read reviews, and receive personalized recommendations.  

- **Users** interact through a Single Page Application (SPA).  
- **Backend services** process requests, enforce authentication, and persist data.  
- **External systems** provide authentication (Microsoft OIDC Identity Provider) and supply course data (university portal).  

---

## Components

### Presentation Layer
A **Single Page Application (SPA)** that provides the user interface for students to browse courses, submit ratings, view reviews, and interact with analytics. The SPA communicates with the backend via REST API calls.

### Edge Layer
Exposes a **REST API (OpenAPI v3)** and enforces authentication through a middleware component.

### Business Logic Layer
Encapsulates core services:
- `Course Service` – manages course data and metadata  
- `Rating Service` – processes student ratings and reviews  
- `User Service` – manages student accounts and activity  
- `Recommendation Service` – generates personalized course suggestions  
- `Scraper Service` – gathers course data from the university portal and updates the system  

#### Service Interactions

- **Rating Service → Course Service**  
  Fetches course metadata to update ratings when students submit feedback.

- **Rating Service → User Service**  
  Validates student existence and records who submitted each rating.

- **Recommendation Service → Rating Service**  
  Reads aggregated ratings to generate personalized recommendations.

- **Recommendation Service → Course Service**  
  Retrieves course information (e.g., name, professor, faculty) to include in recommendations.

- **Scraper Service → Course Service**  
  Updates course records with newly scraped data.

- **Scraper Service → File Storage**  
  Stores raw files or documents collected from the university portal.

### Data Access Layer
Provides an **ORM** that abstracts database operations for the business logic, ensuring clean separation between application logic and persistence.

### Data Layer
Consists of:
- **PostgreSQL** for structured data  
- **File Storage** for scraped course information  

### External Systems
- **Microsoft OIDC Identity Provider** – for authentication and secure access

---

## Data Flows

1. The SPA sends requests to the REST API for actions such as browsing courses, submitting ratings, or fetching recommendations.  
2. The Authentication Middleware validates sessions by communicating with the Microsoft OIDC Identity Provider.  
3. The REST API forwards requests to the appropriate Business Logic Service (Course, Rating, User, Recommendation, or Scraper).  
4. Business Logic Services interact with the Data Access Layer (ORM) to read or write data in PostgreSQL.  
5. The Scraper Service collects course data from the university portal, stores raw files in File Storage, and updates course records via the Course Service.  
6. Processed data (ratings, recommendations, course info) is returned through the REST API back to the SPA for display to the user.  
