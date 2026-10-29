# ІНП Planner API

| | |
|---|---|
| Source | branch `draft/personal-plan-backend` (`PersonalPlanViewSet`) |
| Error body | [Error Handling Contract](api-design.md#error-handling-contract) |

## Error codes

| Error code | HTTP status | When it happens | Rule ID from the digest |
|---|---|---|---|
| `plan_semester_unavailable` | 400 | `study_year` is a past (`done`) year or above the programme length, or `term` is `SUMMER` of the final year | BR-05, TA-06 |
| `course_not_offered` | 400 | The course has no offering, so it has no credits or hours | BR-01, TA-07 |
| `course_already_taken` | 409 | The course is taken per САЗ: it cannot be added, moved or marked as backup | PR-01, PR-02, BR-04 |
| `planned_course_not_found` | 404 | The course is not among the student's own picks | PR-01, BR-08 |
| `course_not_offered_in_term` (proposed) | 400 | The chosen `term` is not a term of the course's newest offering | BR-01, BR-02, TA-07 |
| `course_is_mandatory` (proposed) | 409 | Removing, or marking as backup, a mandatory course of the student's programme | PR-01 |
| `invalid_course_identifier` (existing) | 400 | `course_id` in the path is not a UUID | — |
| `course_not_found` (existing) | 404 | No course with this `course_id` | BR-01 |
| `only_student_action_allowed` (existing) | 403 | The signed-in user has no student profile | TA-01 |
| `not_authenticated` (DRF) | 403 | No session | TA-01 |
| `invalid` (DRF validation) | 400 | The body fails its Pydantic model; `fields` lists the bad fields | — |

Mismatch: the Error Handling Contract gives 401 for missing authentication, but the configured DRF authentication returns 403 `not_authenticated`.

## Endpoints

### `GET /api/v1/students/me/plan/` — US-5.9 — `implemented`

| | |
|---|---|
| Does | The plan by study year and semester: courses taken per САЗ, then the student's picks |
| Auth | Signed-in student (`require_student`) |
| Request | none |

**Success:** `200 OK`

```json
{
  "enrollment_year_start": 2023,
  "current_year_start": 2024,
  "years": [
    {
      "study_year": 1,
      "academic_year_start": 2023,
      "status": "done",
      "semesters": [
        {
          "term": "FALL",
          "is_graduation_summer": false,
          "main": [
            {
              "course_id": "3f2a…",
              "title": "Алгоритми",
              "kind": "PROF_ORIENTED",
              "faculty_name": "ФІ",
              "credits": "5.0",
              "weekly_hours": 4,
              "is_mandatory": true
            }
          ],
          "backup": []
        },
        { "term": "SPRING", "is_graduation_summer": false, "main": [], "backup": [] },
        { "term": "SUMMER", "is_graduation_summer": false, "main": [], "backup": [] }
      ]
    }
  ]
}
```

| Field | Values |
|---|---|
| `status` | `done` (read-only), `current` (taken plus picks), `planned` (picks) |
| `kind` | type for the student's own speciality; `ELECTIVE` if it is not listed (BR-13, PR-05) |
| `is_mandatory` | `true` for courses taken per САЗ |
| `credits` | decimal string (BR-06) |

**Errors:** `403 not_authenticated`, `403 only_student_action_allowed`.

Mismatch: BR-04 — mandatory courses of the programme for future years are not pre-filled.
Mismatch: `is_mandatory` means "taken", so it is `true` for taken electives too.

### `PUT /api/v1/students/me/plan/courses/{course_id}/` — US-5.1 — `implemented`

| | |
|---|---|
| Does | Adds the course to one semester, or moves it there; a repeat call moves it, so it is never duplicated (PR-02); never blocked by limits (BR-14, PR-04) |
| Auth | Signed-in student (`require_student`) |

| Param / field | In | Type | Required |
|---|---|---|---|
| `course_id` | path | uuid | yes |
| `study_year` | body | integer, ≥ 1 | yes |
| `term` | body | `FALL` / `SPRING` / `SUMMER` | yes |
| `slot` | body | `MAIN` / `BACKUP` | yes |

```json
{ "study_year": 3, "term": "FALL", "slot": "MAIN" }
```

**Success:** `200 OK`, the whole plan (same body as `GET /api/v1/students/me/plan/`).

**Errors:** `400 invalid_course_identifier`, `400 invalid`, `400 plan_semester_unavailable`, `400 course_not_offered`, `403 not_authenticated`, `403 only_student_action_allowed`, `404 course_not_found`, `409 course_already_taken`.

Mismatch: BR-02 — a multi-term course is stored in the one chosen `term` only.
Mismatch: if the course does not run in `term`, credits come from another term of its newest offering.

### `DELETE /api/v1/students/me/plan/courses/{course_id}/` — US-5.10a — `implemented`

| | |
|---|---|
| Does | Drops one of the student's own picks; taken courses cannot be removed (PR-01) |
| Auth | Signed-in student (`require_student`) |

| Param | In | Type | Required |
|---|---|---|---|
| `course_id` | path | uuid | yes |

**Success:** `204 No Content`.

**Errors:** `400 invalid_course_identifier`, `403 not_authenticated`, `403 only_student_action_allowed`, `404 planned_course_not_found`.

### `GET /api/v1/students/me/plan/courses/{course_id}/` — US-5.1 — `proposed`

| | |
|---|---|
| Does | Where one course sits in the plan, so the course page can show "Ваш курс вже додано в ІНП" (BR-03) without loading the whole plan |
| Implementation | Same route and `PersonalPlanViewSet` as `PUT` / `DELETE`, as a `get` → `placement` action |
| Auth | Signed-in student (`require_student`) |

| Param | In | Type | Required |
|---|---|---|---|
| `course_id` | path | uuid | yes |

**Success:** `200 OK`

```json
{ "course_id": "3f2a…", "study_year": 3, "term": "FALL", "slot": "MAIN", "is_mandatory": false }
```

**Errors:** `400 invalid_course_identifier`, `403 not_authenticated`, `403 only_student_action_allowed`, `404 planned_course_not_found`.

### `PATCH /api/v1/students/me/plan/courses/{course_id}/` — US-5.2, US-5.10b — `proposed`

| | |
|---|---|
| Does | Switches `MAIN` ↔ `BACKUP` without resending the year and term; backups are not counted anywhere (BR-07, PR-03); promoting never fails on limits (PR-04) |
| Implementation | New `PlanCourseSlotRequest` Pydantic model (ADR-0005) |
| Auth | Signed-in student (`require_student`) |

| Param / field | In | Type | Required |
|---|---|---|---|
| `course_id` | path | uuid | yes |
| `slot` | body | `MAIN` / `BACKUP` | yes |

```json
{ "slot": "BACKUP" }
```

**Success:** `200 OK`, the whole plan (same body as `GET /api/v1/students/me/plan/`).

**Errors:** `400 invalid_course_identifier`, `400 invalid`, `403 not_authenticated`, `403 only_student_action_allowed`, `404 planned_course_not_found`, `409 course_already_taken`, `409 course_is_mandatory`.

### `GET /api/v1/students/me/plan/summary/` — US-6.1, US-6.2, US-6.3 — `proposed`

| | |
|---|---|
| Does | Credit and hour checks from `MAIN` courses only (BR-07), calculated in the backend as the one source of truth (ADR-0012); warnings only, never blocking (BR-14) |
| Implementation | Separate read, so the implemented plan body stays unchanged; the webapp refetches it after `PUT`, `PATCH` and `DELETE` |
| Auth | Signed-in student (`require_student`) |
| Request | none |

**Success:** `200 OK`

```json
{
  "years": [
    {
      "study_year": 3,
      "credits": "64.0",
      "credits_min": "58.0",
      "credits_max": "62.0",
      "semesters": [
        { "term": "FALL", "credits": "34.0", "weekly_hours": 26, "weekly_hours_max": 24 },
        { "term": "SPRING", "credits": "30.0", "weekly_hours": 22, "weekly_hours_max": 24 },
        { "term": "SUMMER", "credits": "0.0", "weekly_hours": 0, "weekly_hours_max": 24 }
      ],
      "warnings": ["YEAR_CREDITS_ABOVE_MAX", "WEEKLY_HOURS_ABOVE_MAX"]
    }
  ],
  "programme": {
    "credits": "180.0",
    "credits_required": "240.0",
    "credits_left": "60.0",
    "prof_oriented_credits": "50.0",
    "prof_oriented_min": "54.0",
    "free_choice_credits": "27.0",
    "free_choice_max": "25.0",
    "warnings": ["PROF_ORIENTED_BELOW_MIN", "FREE_CHOICE_ABOVE_MAX"]
  }
}
```

| Warning | Rule |
|---|---|
| `YEAR_CREDITS_BELOW_MIN`, `YEAR_CREDITS_ABOVE_MAX` | BR-09 (58–62, summer included) |
| `WEEKLY_HOURS_ABOVE_MAX` | BR-10 (24 h per semester) |
| `PROF_ORIENTED_BELOW_MIN`, `FREE_CHOICE_ABOVE_MAX` | BR-11, BR-13 |
| Gap or excess: `credits` minus the bound, worked out by the client | BR-09 |
| `credits_left` | BR-12 |

**Errors:** `403 not_authenticated`, `403 only_student_action_allowed`.

### Proposed changes to implemented endpoints

| Endpoint | Change | Rule |
|---|---|---|
| `PUT /api/v1/students/me/plan/courses/{course_id}/` | `term` becomes optional: when omitted, the course lands in every term of its newest offering in `study_year`; a `term` the course does not run in fails with `course_not_offered_in_term` | BR-01, BR-02, BR-08 |
| `PUT /api/v1/students/me/plan/courses/{course_id}/` | Moving or backing up a mandatory course fails with `course_is_mandatory` | PR-01 |
| `DELETE /api/v1/students/me/plan/courses/{course_id}/` | Removing a mandatory course fails with `409 course_is_mandatory` instead of `404` | PR-01 |

## Coverage

| Story ID | Endpoint(s) | Status |
|---|---|---|
| US-5.1 | `PUT …/plan/courses/{course_id}/`; `GET …/plan/courses/{course_id}/` for BR-03 | implemented (mismatch BR-02); `GET` proposed |
| US-5.9 | `GET …/plan/` | implemented (mismatch BR-04) |
| US-5.2 | `PATCH …/plan/courses/{course_id}/` (`slot: BACKUP`); today via `PUT` | proposed |
| US-5.10a | `DELETE …/plan/courses/{course_id}/` | implemented |
| US-5.10b | `PATCH …/plan/courses/{course_id}/` (`slot: MAIN`); today via `PUT` | proposed |
| US-6.1 | `GET …/plan/summary/` | proposed (today computed in the webapp) |
| US-6.2 | `GET …/plan/summary/` | proposed (today computed in the webapp) |
| US-6.3 | `GET …/plan/summary/` | proposed (today computed in the webapp) |
