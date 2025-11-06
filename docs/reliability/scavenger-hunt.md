# Code Review Notes — Error Handling & Typing Issues

## 1. Broad Exception Handling

**Problem**  
Catching all exceptions (`except Exception`) is too broad; it hides real issues and makes debugging difficult.

**Sample Code**  

```python
def parse(self, html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    links = []

    for a in soup.select(COURSE_LINK_SELECTOR):
        href = a.get("href")
        if not href:
            continue
        try:
            path = urlparse(str(href)).path.rstrip("/")
            m = COURSE_PATH_PATTERN.match(path)
            if m:
                links.append(urljoin(base_url, path))
        except Exception:
            continue

    return links
```

**Why It’s Dangerous**  
Silently ignores possible parsing or network errors, causing data loss or skipped items without visibility.

**Potential Impact**  

- Silent corruption of parsing results  
- Debugging difficulties due to missing logs  
- Hidden edge-case crashes downstream

---

## 2. Silent Error Handling without Logging

**Problem**  
Errors are caught and ignored with no logging or alerting.

**Sample Code**  

```python
def _extract_from_href(self, element) -> int | None:
    try:
        href = element.get("href", "")
        if not href:
            return None
        q = parse_qs(urlparse(str(href)).query)
        if "page" in q:
            return int(q["page"][0])
    except Exception:
        pass
    return None
```

**Why It’s Dangerous**  
Swallows all exceptions, hides unexpected input or parsing issues.

**Potential Impact**  

- No visibility into runtime problems  
- Difficult to trace production issues

---

## 3. Missing Null‑Value or Existence Checks

**Problem**  
No checks for `None` or missing data, leading to potential runtime errors.

**Sample Code**  

```python
def get_by_id(self, student_id: str) -> Student | None:
    ...
```

**Why It’s Dangerous**  
If `student_id` is invalid or the student does not exist, code that assumes a valid `Student` object may fail later.

**Potential Impact**  

- Unhandled `AttributeError`  
- Unexpected service crashes

---

## 4. Catching Repository Errors in the Wrong Layer

**Problem**  
Catching “model does not exist” errors in the API layer couples the API too tightly to repository implementation details.

**Code Summary**  
From repository:

```python
def get_or_create(
    self,
    *,
    title: str,
    department: Department,
    status: str = CourseStatus.PLANNED,
    description: str | None = None,
) -> tuple[Course, bool]:
    return Course.objects.get_or_create(
        title=title,
        department=department,
        status=status,
        description=description,
    )
```

**Why It’s Dangerous**  
If the same service or repo is reused elsewhere, those layers also need to handle the same repository exceptions.

**Potential Impact**  

- Code duplication of exception handling  
- Leaky abstraction between repository and API layers

| Fault                                                                                                                                  | Error                                                                                                                                | Failure                                                                                                                 | Severity                                                               |
|----------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| API layer catches ORM exceptions (DoesNotExist, etc.) instead of handling them inside the repository/service. This **breaks abstraction**. | **Internal state mismatch**: controllers depend on repository implementation details, so changing the backend may break error handling. | **Wrong external behavior**: inconsistent HTTP responses (e.g., 500 instead of 404) or leaking ORM/DB messages to clients. | **Medium**: though may escalate to High if it causes 500 errors or data leakage. |

---

## 5. Missing Type Annotations

**Problem**  
No return type annotations reduce code clarity and hinder static checking.

**Sample Code**  

```python
def _get_page_number_from_link(self, link) -> int | None:
    ...
```

**Why It’s Dangerous**  
Developers and tools cannot easily infer what data type to expect, leading to subtle bugs.

**Potential Impact**  

- Harder to maintain or refactor  
- Reduced IDE and typing support

---

## 6. Generic Exception Without Context

**Problem**  
Using `except Exception: pass` without logging context removes traceability.

**Code Fragment**  

```python
try:
    risky_operation()
except Exception:
    pass
```

**Why It’s Dangerous**  
Completely swallows unexpected runtime errors.

**Potential Impact**  

- Hidden crashes  
- Damaged data integrity  
- No alerts when system misbehaves

## 7. Missing Request Timeout in Axios Client

**Problem**  

The Axios instance does not define a request timeout. Without it, requests may hang indefinitely if the server never responds.

**Sample Code**  

```ts
export const authorizedHttpClient = axios.create({
  withCredentials: true,
  baseURL: env.VITE_API_BASE_URL,
});
```

**Why It’s Dangerous**  

If a backend service stalls or a network issue occurs, pending promises never resolve or reject. This can freeze UI components, block requests, or consume system resources.

**Potential Impact**  

- Hanging HTTP requests  
- Unresponsive frontend components  
- Resource leaks / memory buildup  
- Poor user experience under bad network conditions

**Recommended Fix**  
Add a reasonable timeout (e.g., 10 seconds):

```ts
export const authorizedHttpClient = axios.create({
  withCredentials: true,
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10000, // 10 seconds
});
```
