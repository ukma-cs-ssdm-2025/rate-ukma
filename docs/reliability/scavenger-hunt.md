<!-- markdownlint-disable MD024 -->

# Code Review Notes — Error Handling & Typing Issues

## 1. Broad Exception Handling

### Problem

`CourseLinkParser._get_match_from_href` wraps the link parsing logic in a bare `except Exception`, hiding parsing failures and preventing visibility into unexpected HTML shapes.

```python
        try:
            path = urlparse(str(href)).path.rstrip("/")
            m = COURSE_PATH_PATTERN.match(path)
            if m:
                links.append(urljoin(base_url, path))
        except Exception:
            continue
```

### Potential Impact

- Silent data loss for valid courses
- Harder debugging when the parser skips malformed or malicious links

### Field Classification

| Field    | Explanation                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| Fault    | The parser catches every `Exception`, so any parsing hiccup is swallowed instead of being surfaced and traced. |
| Error    | The internal link list quietly omits entries from poorly formatted `href`s without marking the failure.        |
| Failure  | Consumers miss course URLs, making the catalog incomplete and unpredictable.                                   |
| Severity | Medium                                                                                                         |

_Location: `src/backend/scraper/parsers/catalog.py`:48-69 (approx.)_

---

## 2. Silent Error Handling without Logging

### Problem

Pagination helpers swallow every error with `except Exception: pass`, leaving no telemetry or fallback when HTML attributes are missing or malformed.

```python
        try:
            href = element.get("href", "")
            if not href:
                return None
            q = parse_qs(urlparse(str(href)).query)
            if "page" in q:
                return int(q["page"][0])
        except Exception:
            pass
```

### Potential Impact

- No visibility into broken pagination parsing
- User interfaces may report incorrect page counts silently

### Field Classification

| Field    | Explanation                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fault    | `_extract_from_href` and `_extract_from_data_attribute` swallow all exceptions without logging, so malformed links disappear without notice. |
| Error    | The parser returns `None`, leaving the pagination state unaware of the failure.                                                              |
| Failure  | UI pagination can stop prematurely or show incorrect totals, disrupting navigation.                                                          |
| Severity | Medium                                                                                                                                       |

_Location: `src/backend/scraper/parsers/catalog.py`:104-123 (approx.)_

---

## 3. Missing Null-Value or Existence Checks

### Problem

`StudentRepository.get_by_id` returns `None` for missing students but callers often assume a `Student` was resolved, so invalid inputs propagate.

```python
    def get_by_id(self, student_id: str) -> Student | None:
        try:
            return Student.objects.select_related("speciality").get(id=student_id)
        except Student.DoesNotExist:
            logger.error("student_not_found", student_id=student_id)
            return None
```

### Potential Impact

- Upstream code dereferences `None`, throwing `AttributeError`s
- Requests for missing students surface as 500s instead of controlled 404s

### Field Classification

| Field    | Explanation                                                                          |
| -------- | ------------------------------------------------------------------------------------ |
| Fault    | The repository returns `None` without guaranteeing consumers guard against it.       |
| Error    | Services assume the returned value has attributes and end up in invalid state.       |
| Failure  | Missing-student requests fail unpredictably in higher layers, degrading reliability. |
| Severity | Medium                                                                               |

_Location: `src/backend/rating_app/repositories/student_repository.py`:13-22 (approx.)_

---

## 4. Catching Repository Errors in the Wrong Layer

### Problem

Multiple `RatingViewSet` endpoints catch `Rating.DoesNotExist` themselves, scattering repository knowledge across the API instead of handling it centrally.

```python
        try:
            rating = self.rating_service.get_rating(rating_id)
            ...
        except Rating.DoesNotExist as exc:
            raise NotFound(RATING_NOT_FOUND_MSG) from exc
```

### Potential Impact

- Each endpoint must repeat the same catch logic
- Risk of inconsistent responses if one view forgets translation

### Field Classification

| Field    | Explanation                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Fault    | The `ViewSet` embeds repository-specific exception handling instead of relying on services to normalize the fault. |
| Error    | The contract between layers becomes unclear, and each controller reinterprets the missing record differently.      |
| Failure  | Clients may receive inconsistent HTTP statuses or miss clear failure messages, complicating integrations.          |
| Severity | Medium                                                                                                             |

_Location: `src/backend/rating_app/views/rating_viewset.py`:186-262 (approx.)_

---

## 5. Missing Type Annotations

### Problem

`CatalogParser._get_page_number_from_link` accepts an untyped `link`, so callers cannot rely on the expected structure during pagination extraction.

```python
    def _get_page_number_from_link(self, link) -> int | None:
        t = link.text.strip()
        ...
```

### Potential Impact

- Unexpected `AttributeError`s if `link` is not a `Tag`
- Harder to reason about parser invariants or import typing tools

### Field Classification

| Field    | Explanation                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------- |
| Fault    | Lack of type annotations prevents static guarantees about the HTML node shape.                 |
| Error    | Parsers may misinterpret the node or encounter missing attributes, corrupting pagination data. |
| Failure  | Pagination may skip pages or crash under invalid links, reducing reliability.                  |
| Severity | Low                                                                                            |

_Location: `src/backend/scraper/parsers/catalog.py`:133-142 (approx.)_

---

## 6. Generic Exception Without Context

### Problem

The pagination helpers (`_extract_from_href`, `_extract_from_data_attribute`, `_get_page_number_from_link`) share the same `except Exception: pass` pattern, so any DOM parsing hiccup in these helpers disappears without logging.

```python
        try:
            dp = element.get("data-page")
            if dp and str(dp).isdigit():
                return int(str(dp)) + 1
        except Exception:
            pass
```

This is just one example; catalog and course services also use the same blanket `except Exception: pass`, so the issue is widespread and worth cleaning up.

### Potential Impact

- Failures disappear silently across multiple helpers
- No fallback logic triggers, so pagination defaults may misreport the last page

### Field Classification

| Field    | Explanation                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Fault    | Multiple helpers swallow every exception, removing any signal that parsing failed.                   |
| Error    | Each parser returns `None`, so pagination state cannot distinguish between absence and failure.        |
| Failure  | Pagination reverts to defaults without signaling broken links, making navigation unreliable.          |
| Severity | Medium                                                                                                |

_Location: `src/backend/scraper/parsers/catalog.py`:104-142 (approx.)_

---

## 7. Missing Request Timeout in Axios Client

### Problem

The Axios client was initially created without a `timeout`, so stalled backend responses could hang the frontend forever (the fix now adds `timeout`, but the risk was real).

```ts
export const authorizedHttpClient = axios.create({
  withCredentials: true,
  baseURL: env.VITE_API_BASE_URL,
});
```

### Potential Impact

- UI requests hang indefinitely under network issues
- Resource leaks; components stay in loading state with unresolved promises

### Field Classification

| Field    | Explanation                                                                |
| -------- | -------------------------------------------------------------------------- |
| Fault    | Missing `timeout` means no upper bound on HTTP waits.                      |
| Error    | Pending promises remain unresolved, leaving component state limbo.         |
| Failure  | UI interactions freeze when the backend stalls, degrading user experience. |
| Severity | High                                                                       |

_Location: `src/webapp/src/lib/api/apiClient.ts`:1-9 (approx.)_
