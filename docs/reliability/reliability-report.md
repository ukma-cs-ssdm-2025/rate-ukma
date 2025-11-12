
# Reliability Report

## Project Overview

**Date:**  12.11.2025
**Status:** Finished

---

## Identified Reliability Issues

| # | Module / File                                                          | Problem Summary                                   | Fault (code defect)                                       | Error (internal state)                        | Failure (external symptom)                         | Severity | Fixed? |
|:-:|------------------------------------------------------------------------|---------------------------------------------------|-----------------------------------------------------------|-----------------------------------------------|----------------------------------------------------|:--------:|:------:|
| 1 | `scraper/parsers/catalog.py` (`CourseLinkParser._get_match_from_href`) | Broad `except Exception` hides parsing errors     | Overly broad exception swallows unexpected parsing issues | Link list omits entries silently              | Missing course URLs; incomplete catalog            |  Medium  |   ⚠️   |
| 2 | `scraper/parsers/catalog.py` (pagination helpers)                      | Silent `except Exception: pass` without logging   | Exceptions swallowed silently, no telemetry               | Parser returns `None` and loses page state    | Incorrect or truncated pagination                  |  Medium  |   ⚠️   |
| 3 | `rating_app/repositories/student_repository.py`                        | Missing null/existence check in repository        | `None` returned without contract enforcement              | Callers dereference `None`                    | Random 500 errors on missing student               |  Medium  |   ✅    |
| 4 | `rating_app/views/rating_viewset.py`                                   | Repository exceptions caught in wrong layer       | `ViewSet` mixes service/repo boundaries                   | Inconsistent internal error mapping           | Clients receive inconsistent HTTP responses        |  Medium  |   ⚠️   |
| 5 | `scraper/parsers/catalog.py` (`_get_page_number_from_link`)            | Missing type annotations                          | Untyped argument allows wrong object shapes               | `AttributeError` possible if `link` not `Tag` | Pagination crashes or skips pages                  |   Low    |   ⚠️   |
| 6 | `scraper/parsers/catalog.py` (shared helpers)                          | Generic `except Exception: pass` pattern repeated | Exceptions discarded without logging context              | Parser cannot distinguish failure vs. absence | Navigation unreliable due to silent parsing errors |  Medium  |   ⚠️   |
| 7 | `webapp/lib/api/apiClient.ts`                                          | Missing timeout in Axios client                   | No timeout set on HTTP client                             | Promise remains unresolved indefinitely       | UI freezes on stalled backend                      |   High   |   ✅    |

---

## Before / After Fixes

### 1. [Broad Exception Handling](./scavenger-hunt.md#1-broad-exception-handling)

 [Commit](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/246/commits/71de36c377ffdc07c28c1b63027e9237094fe452)

**Before:**

```python
 try:
     path = urlparse(str(href)).path.rstrip("/")
     m = COURSE_PATH_PATTERN.match(path)
     if m:
         links.append(urljoin(base_url, path))
 except Exception:
     continue
```

**After:**

```python
  try:
      href_str = str(href).strip()
      if not href_str:
          return None

      parsed_url = urlparse(href_str)
      if not parsed_url.path:
          return None

      path = parsed_url.path.rstrip("/")
      if not path:
          return None

      return COURSE_PATH_PATTERN.match(path)

  except (ValueError, TypeError) as e:
      logger.debug(f"Failed to parse href '{href}': {e}")
      return None
  except Exception as e:
      logger.warning(f"Unexpected error processing href '{href}': {e}")
      return None
```

### 2. [Broad Exception Handling](./scavenger-hunt.md#2-silent-error-handling-without-logging)

[Commit](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/246/commits/71de36c377ffdc07c28c1b63027e9237094fe452)

**Before:**

```python
 try:
     path = urlparse(str(href)).path.rstrip("/")
     m = COURSE_PATH_PATTERN.match(path)
     if m:
         links.append(urljoin(base_url, path))
 except Exception:
     continue
```

**After:**

```python
  try:
      href_str = str(href).strip()
      if not href_str:
          return None

      parsed_url = urlparse(href_str)
      if not parsed_url.path:
          return None

      path = parsed_url.path.rstrip("/")
      if not path:
          return None

      return COURSE_PATH_PATTERN.match(path)

  except (ValueError, TypeError) as e:
      logger.debug(f"Failed to parse href '{href}': {e}")
      return None
  except Exception as e:
      logger.warning(f"Unexpected error processing href '{href}': {e}")
      return None
```

### 3. [Missing Null-Value or Existence Checks](./scavenger-hunt.md#3-missing-null-value-or-existence-checks)

[Commit](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/246/commits/fe856b70ee22c5c3796ae4ad6f5ff183848511ff)

**Before:**

```python
 def get_by_id(self, student_id: str) -> Student | None:
     try:
         return Student.objects.select_related("speciality").get(id=student_id)
     except Student.DoesNotExist:
         logger.error("student_not_found", student_id=student_id)
         return None
```

**After:**

```python
def get_by_id(self, course_id: str) -> Course:
        try:
            return (
                Course.objects.select_related("department__faculty")
                .prefetch_related("offerings__semester", "course_specialities__speciality")
                .annotate(
                    avg_difficulty_annot=Avg("offerings__ratings__difficulty"),
                    avg_usefulness_annot=Avg("offerings__ratings__usefulness"),
                    ratings_count_annot=Count("offerings__ratings__id", distinct=True),
                )
                .get(id=course_id)
            )
        except Course.DoesNotExist as exc:
            logger.info("course_not_found", course_id=course_id)
            raise CourseNotFoundError(course_id) from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise InvalidCourseIdentifierError(course_id) from exc
```

### 4. [Catching Repository Errors in the Wrong Layer](./scavenger-hunt.md#4-catching-repository-errors-in-the-wrong-layer)

[PR](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/262)

**Before:**

```python
 try:
     rating = self.rating_service.get_rating(rating_id)
     # ...
 except Rating.DoesNotExist as exc:
     raise NotFound(RATING_NOT_FOUND_MSG) from exc
```

**After:**

```python
def retrieve(self, request, rating_id: str | None = None, *args, **kwargs):
        assert self.rating_service is not None

        try:
            params = RatingReadParams.model_validate({"rating_id": rating_id})
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        rating = self.rating_service.get_rating(params.rating_id)

        serializer = RatingReadSerializer(rating)
        return Response(serializer.data, status=status.HTTP_200_OK)
```

### 5. [Missing Type Annotations](./scavenger-hunt.md#5-missing-type-annotations)

[Commit](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/246/commits/5f218255ff1084b91a994cea7b6d938c06e75cd0)

**Before:**

```python
 def _get_page_number_from_link(self, link) -> int | None:
  t = link.text.strip()
  # ...
```

**After:**

```python
def _get_page_number_from_link(self, link: Tag) -> int | None:
 t = link.text.strip()
  # ...
```

### 6. [Generic Exception Without Context](./scavenger-hunt.md#6-generic-exception-without-context)

[Commit](-)

**Before:**

```python
        try:
            dp = element.get("data-page")
            if dp and str(dp).isdigit():
                return int(str(dp)) + 1
        except Exception:
            pass
```

**After:**

```python
    def _extract_from_data_attribute(self, element: Tag) -> int | None:
        dp = element.get("data-page")
        if not dp:
            return None

        dp_str = str(dp)
        if not dp_str.isdigit():
            return None
            
        try:
            return int(dp_str) + 1
        except ValueError as exc:
            logger.debug("pagination_data_page_invalid", data_page=dp_str, err=exc)
            return None
```

### 7. [Missing Request Timeout in Axios Client](./scavenger-hunt.md#7-missing-request-timeout-in-axios-client)

[Commit](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/246/commits/b5fdcafcc276cf946b02a1db61de2cbc939cfe33)

**Before:**

```typescript
export const authorizedHttpClient = axios.create({
  withCredentials: true,
  baseURL: env.VITE_API_BASE_URL,
});
```

**After:**

```typescript
export const authorizedHttpClient = axios.create({
 withCredentials: true,
 baseURL: env.VITE_API_BASE_URL,
 timeout: 10000, // 10 seconds
});
```
