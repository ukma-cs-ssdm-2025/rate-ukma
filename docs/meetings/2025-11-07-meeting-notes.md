### **Action Items**

**Andrii**
- Create an ADR about potential use of *Rust-like return*.  
- Edit E2E task to include better, more clean **Acceptance Criteria**, create separate tasks for other e2e flows  
- Rate Page:
  - Add explanation for how it should look.  
- Scatter Plot
- Responsive task #247
- Classify system errors #218
- Add **external failure test** on frontend (simulate API or network failure).

---

**Nastia**
- Create ADR for **Filters**:
  - Use Pydantic schema heavily.  
  - Questions to investigate:
    - Is it possible to use Pydantic schemas in `extend_schema` parameters?  
    - Can we reuse them instead of the many heavy filter parsers?  
    - What happens if validation fails (what HTTP response is returned)?  
- Proceed with implementation of Filters
- Continue with **E2E** implementation.  
- Add **filters tests** for boundary cases.

---

**Kate**
- Add **year when student attended course** to the Courses Page ratings (#225).  
- Work on **Rate page** (together with Milana).  
- Prepare the **Final Reliability Report**.  

---

**Milana**
- Finish **Grouper (deduplication)** and contact *Andrii or Nastia* to upload to stage/live.  
- Work on **Rate Page** (shared with Kate).  
- Add **badges in Courses Table**:
  - Include specialties and add color-coding by faculty.  
  - Potentially remove separate faculty badge and use its color as the background.  
- Add **injector.py example** or test case in scraper to check error-handling (expected errors).

---

### **Assigned Roles**
| Role | Person |
|------|---------|
| Resilience Engineer | Anastasiia |
| Risk Documentarian | Kate |
| Fault Classifier | Andrii |
| Reliability Explorer | Milana |

---

### **Testing Focus**
- **Frontend tests:** Andrii — external failure case.  
- **Filters:** Nastia — boundary case tests.  
- **Error Handling:** Milana — injector.py or scraper-based test.
