
# Debugging Log

## Short Description
- **Date:** 2025-10-22  
- **Module:** Course
- **Layer:** View
- **Responsible:** Kateryna Bratiuk [@katerynabratiuk](https://github.com/katerynabratiuk)

---

## Symptom
The test that was supposed to verify that a `BadRequest` (HTTP 400) is returned when an invalid query parameter is provided failed.  
Instead of returning `400`, the endpoint returned `200 OK`.

---

## Reproduction Steps
1) Run `pytest` in `src/backend`.  
2) The test fixture creates 3 course objects.  
3) The test sends a GET request:  
   `/api/v1/courses/?semesterTerm=winter`  
- **Expected:** `status_code == 400`  
- **Actual:** `status_code == 200`

---

## Scope / Impact
- Affected endpoint: `GET /api/v1/courses/`  
- The filter parameters were not properly validated.  
- **Severity:** Low — functionality works, but incorrect inputs are silently ignored, which can lead to confusion or unexpected behavior later.

---

## Artifacts
**Failed test:** `test_invalid_semester_term`  
**Relevant output:** `FAILED rating_app/views/test_course.py::test_invalid_semester_term - AssertionError: Expected 400, got 200`

---
## Debugging
1. Add print(response.json()) inside the failed test.
2. In response: 
```json
"filters": {
    // ..
    "semester_term": null,
    // ..
  },
```
The response ignored the invalid term and returned default results, with `semester_term` null in the envelope:

---
## Cause

In `course_viewset.py` in case of invalid data the `semester_term` variable was set to None. Therefore, invalid value → `semester_term` set to `None`, so request degraded to default list (page 1, page_size 20).


## Fix
In `course_viewset.py` instead of simply setting `semester_term` to None, a `ValidationError` is raised:
```python
semester_term_raw  =  request.query_params.get("semesterTerm")
semester_term  =  None
if  semester_term_raw:
	normalized_term  =  semester_term_raw.upper()
	if  normalized_term  in  SemesterTerm.values:
		semester_term  =  normalized_term
	else:
		raise  ValidationError({"semesterTerm": ["Invalid value"]})
```
See [commit](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/141/commits/69cfc9e58ddf0dc87e74a129daf6bbff30c594ae).

## Result
1) Run `pytest rating_app/views/test_course.py::test_invalid_semester_term`
2) Result: `=========================================== 1 passed in 1.49s ============================================ 
`

## Lessons
- Silently coercing bad input to `None` hides bugs and confuses clients. Prefer raising `ValidationError` so contracts stay explicit.
- Write tests against the response **envelope** (status, keys, and schema) in addition to business behavior so regressions are caught (e.g., wrong key names, missing fields).
