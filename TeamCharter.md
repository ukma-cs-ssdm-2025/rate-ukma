# Team Charter

## 1. Team & Members

**Team Name:** ABVH

| Name | GitHub | NaUKMA Email |
|------|---------|--------------|
| Anastasiia Aleksieienko | [@stasiaaleks](https://github.com/stasiaaleks) | `a.aleksieienko@ukma.edu.ua` |
| Kateryna Bratiuk | [@katerynabratiuk](https://github.com/katerynabratiuk) | `k.bratiuk@ukma.edu.ua` |
| Andrii Valenia | [@Fybex](https://github.com/Fybex) | `a.valenia@ukma.edu.ua` |
| Milana Horalevych | [@miqdok](https://github.com/miqdok) | `m.horalevych@ukma.edu.ua` |

## 2. Roles & Responsibilities

| Name | Core | Project Requirements | Architecture & Design | API Design & Implementation | Construction I | Testing & Debugging | Verification & Validation | Refactoring & Evolution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Anastasiia** | CI Maintainer | Documentation Lead | Requirements–Architecture Mapper | Integration Lead | Code Reviewer | Integration Lead | Review Manager | Release Manager |
| **Kateryna** | Repo Maintainer | Traceability Lead | Architecture Lead | Backend Lead | Quality Lead | Debugger | Test Planner | Code Analyst |
| **Andrii** | Issue Tracker Lead | Requirements Lead | UML Lead | Quality Lead | Security Analyst | Test Lead | Documentation Lead | QA Engineer |
| **Milana** | Documentation Lead | Quality Lead | Documentation Lead | Documentation Lead | Documentation Lead | QA Planner | QA Analyst | Refactoring Lead |

### Verification & Validation Roles

| Role | Responsibility | Description |
|------|----------------|-------------|
| Test Planner | Kateryna | Coordinates the test plan creation and table structure. |
| Review Manager | Anastasiia | Collects and transfers plans between teams, records feedback. |
| QA Analyst | Milana | Summarizes the results of other teams' reviews. |
| Documentation Lead | Andrii | Updates test-plan.md and creates review-log.md. |

---

Backend / Frontend Responsibilities:

* **Anastasiia:** Backend++ (focus: authorization)
* **Kateryna:** Frontend+, Backend+ (focus: API)
* **Andrii:** Frontend+, Backend+ (focus: parser)
* **Milana:** Frontend+, Backend+ (focus: deduplication)

## 3. Communication Plan

* **Primary Channel:** Discord  
* **Weekly Meetings:** Every **Friday at 13:00** Kyiv time. Additional meetings can be scheduled as needed.  
* **Reply Expectation:** Within **24 hours**  

## 4. Collaboration Workflow

* **Task Workflow:** Tasks tracked on **Kanban board**. Tasks must be small and atomic, larger features split into smaller increments.  
* **Branching Strategy:** GitHub Flow. The `main` branch is always stable and updated only via PRs. Branches deleted after merge.  
* **Branch Naming:** `type/#<issue-number>-short-description` (e.g., `docs/#3-teamcharter-setup`).  
* **Commit Conventions:** `<type>(#<issue-number>): short message` (e.g., `docs(#3): add TeamCharter.md`).  
* **Code Review Rules:** Each PR requires at least one approval. [CodeRabbit](https://www.coderabbit.ai/) is used for automated review.  
* **Team Charter Changes:** All PRs with Team Charter changes must be approved by every team member before merging. This ensures full visibility and alignment on foundational team agreements.
* **Integration:** Merge frequently to avoid long-lived branches.  
* **User Story Review:** All user stories must be reviewed before merging. At least one approval required, all comments resolved. Recommended that all members review.  
* **Non-Functional Requirements Verification:** Evaluated in a team review session. If no consensus, resolved via vote.  

## 5. Artifact Management

* **Requirements Storage:** `/docs/requirements/` directory.  
* **Architecture Storage:** `/docs/architecture/` directory.
* **API Documentation:** `/docs/api/` directory.
* **README Maintenance:** `README.md` kept up-to-date and approved by all team members.  

## 6. Coding Standards & Quality Policy

### Coding Standards

* All Python code must follow [PEP8](https://peps.python.org/pep-0008/) and be linted with [ruff](https://github.com/astral-sh/ruff).
* All TypeScript/JavaScript code must follow [biome](https://biomejs.dev/) formatting and linting rules.
* Both ruff and biome are enforced automatically on pre-commit using configured hooks to ensure consistency and prevent style regressions.
* Code must be readable, well-documented and use meaningful naming conventions.

### Quality Processes

* All code changes require review and approval before merging.
* CI/CD must pass for every PR.
* One assigned from CODEOWNERS is responsible for reviewing the code for standards logic and test coverage.
* Other roles (Quality Lead, Security Analyst, Documentation Lead) operate asynchronously — each ensures compliance within their scope if the changes affect their area.
* **Security Analyst** monitors for security vulnerabilities and best practices.
* **Documentation Lead** ensures that any affected public APIs or modules are properly documented.
* CodeRabbit may be used for automated review, but human approval remains mandatory.

## 7. Individual Contributions

* **Contribution Evidence:** Each member records a **Loom video** showing their contribution (e.g., user stories, requirements, RTM entries).  
* **Collection and Verification:** Videos shared with the team and stored in `/labs/` directory.  

## 8. Conflict Resolution

1. **Majority Vote**  
2. **Seek Compromise**  
3. **Instructor Mediation**  

## 9. Availability & Workload

* Each member contributes ~**6 hours per week**.  
* If workload becomes unbalanced, tasks will be redistributed.  
* Healthy work-life balance prioritized.  

## 10. Ethics

* Follow **ACM Code of Ethics**.  
* Maintain **academic honesty**.  
* No plagiarism.  
* Respect all team members.  

---

## 11. Signatures

* [x] Kateryna (GitHub: [@katerynabratiuk](https://github.com/katerynabratiuk))  
* [x] Anastasiia (GitHub: [@stasiaaleks](https://github.com/stasiaaleks))  
* [x] Milana (GitHub: [@miqdok](https://github.com/miqdok))  
* [x] Andrii (GitHub: [@Fybex](https://github.com/Fybex))
