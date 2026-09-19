# Notes from 7th Team Meeting

- [x] Roles confirmed  
- [x] Technical tasks assigned  
- [x] Deadlines and documentation requirements defined  

---

## Tasks Overview

### **Andrii — Documentation Lead**

**Focus:** Documentation completeness, demo data, and presentation.  

**Tasks:**  
- [ ] **Frontend Courses page** + upload demo Courses data (dump/script/other method) — **Deadline: 26.10 23:59**  
- [ ] **Record project presentation video** — **26.10**, reference: `Labs/midterm-presentation.txt`  
  - Evaluation criteria:  
    1. Documentation completeness and integrity (50%)  
    2. Project state and ability to launch (50%)  
- [ ] **Assign project to Copilot** and check progress in RTM.  

---

### **Anastasiia — Integration & CI/CD Lead, Review Manager**

**Focus:** CI/CD, automation, and parallel builds.  

**Tasks:**  
- [ ] Run **build in parallel** with other checks (as a job, not a step).  
- [ ] Set up **versioning in releases**.  
- [ ] Build **webapp** and **backend Docker images** separately.  
  - Trigger builds **only when corresponding directories change**.  
  - Ensure **frontend** rebuild triggers when **OpenAPI docs** are updated.  
- [ ] Research and implement **E2E tests** setup (staging + live).  
  - Initial phase: simple GET tests after deploy + basic monitoring.  
  - Expand later with more test cases (+ POST).

---

### **Kateryna — QA & Testing Planner**

**Focus:** Admin models, data consistency, and analytics.  

**Tasks:**  
- [ ] Add **admin models**.  
- [ ] Update **scraper** with missing fields; ensure consistency with the domain model.  
- [ ] Develop **analytics module**.  
- [ ] Act as **Test Planner** — coordinate test plan structure and documentation.  

---

### **Milana — QA Analyst**

**Focus:** Data scraping, consistency, and deduplication.  

**Tasks:**  
- [ ] Update **scraper** to fetch not only 2025–2026 data but **all courses**.  
  - Implement selection of all years and per-year link fetching with filters.  
- [ ] Continue **deduplication** process.  
  - Rename `Deduplicated...` models to more descriptive names (`External/Parsed/Ukma/...`).  
- [ ] Serve as **QA Analyst**, summarizing other teams’ test review results.  

---

### **Shared / Backlog**

- [ ] **Audit duplicated schema failure** — fix schema conflict (refer to GitHub Actions log:  
  [`rate-ukma/actions/runs/18760101317/job/53522104345`](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/runs/18760101317/job/53522104345))  
- [ ] Enable linking of **Acceptance Criteria** in the testing strategy.  
- [ ] Add **upvotes/downvotes for comments** — move to backlog.  

---

## Team Roles

| Role | Responsibility | Description |
|------|----------------|----------------|
| **Test Planner** | Kateryna |  Coordinates the test plan creation and table structure. |
| **Review Manager** | Anastasiia | Collects and transfers plans between teams, records feedback. |
| **QA Analyst** | Milana | Summarizes the results of other teams’ reviews. |
| **Documentation Lead** | Andrii | Updates `test-plan.md` and creates `review-log.md`. |

