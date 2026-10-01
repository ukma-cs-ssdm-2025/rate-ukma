# Notes from Fourth Team Meeting

- [x] Roles confirmed  
- [x] Testing, debugging, and automation scope defined  
- [x] Next steps and documentation tasks planned  

---

## Roles

### **Andrii — Test Lead**

**Focus:** Writing and organizing high-quality **unit tests** and improving coverage.  

**Responsibilities:**  
- Create and maintain the `/tests/` suite.  
- Ensure at least **10 tests per module**.  
- Use mocks, fixtures, and coverage reports to ensure test reliability.  

**Results:**  
- Comprehensive test suite and coverage reports.  
- Recommendations for improving test quality.  

**TODO:**  
- Implement **end-to-end** (E2E) tests from frontend to backend.  
- Add missing **integration tests** where needed.  
- Introduce **Factory Boy** for test data generation.  

---

### **Katya — Debugger**

**Focus:** Isolating, reproducing, and fixing errors effectively.  

**Responsibilities:**  
- Introduce realistic bugs and perform systematic debugging.  
- Document the debugging process and root cause analysis.  

**Results:**  
- `/docs/testing/debugging-log.md` containing issues, root causes, fixes, and lessons learned.  

**TODO:**  
- Create `debugging-log.md` based on an example from the **serializer** or **auth** module.  
  - **Symptom:** What went wrong.  
  - **Root Cause:** Why it happened.  
  - **Fix:** How it was resolved.  
  - **Lesson:** What would be done differently next time.  
- Document the use of **`pdb` (Python debugger)**.  
- Investigate if the **UI debugger** can be used to inspect the `runserver` process during tests.  

---

### **Milana — QA Planner**

**Focus:** Defining testing goals, coverage metrics, and overall quality strategy.  

**Responsibilities:**  
- Create the core test strategy document: `/docs/testing/testing-strategy.md`.  
- Define testing scope, quality gates, and coverage targets.  
- Select and document testing tools and quality checks.  

**Results:**  
- Clear testing strategy with measurable goals and policies.  

**TODO:**  
- Specify that every new feature or bug fix **must include tests**.  
- Research **property-based testing** approaches.  
- Document the use of **Factory Boy** for consistent data generation.  

---

### **Nastya — Integration Lead**

**Focus:** Building and maintaining **CI/CD pipelines** that ensure reliable automation and deployment.  

**Responsibilities:**  
- Implement automated test and coverage workflows.  
- Integrate quality reporting tools.  
- Ensure the stability and reliability of the pipeline.  

**Results:**  
- Fully functional CI/CD pipeline with automated quality verification.  

**Extra Tasks:**  
- Configure **staging deployment** to run only after all other jobs succeed (or explore more efficient solutions).  
- Handle **deduplication** in the database process.  

---

## TODO (General)

- **Everyone:**  
  - Keep all documentation within `/docs/testing/`.  
  - Ensure every new or modified module has corresponding tests.  