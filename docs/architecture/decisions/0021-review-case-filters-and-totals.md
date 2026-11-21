# ADR-0021: Review Cases Are Filtered and Counted in UKMA Data

## Status

Accepted

## Date

2026-11-21

## Context

The staff section (`/data`) lists UKMA Data's review cases through the Django proxy. `GET /v1/review-cases` took only `after` and `limit`, so the webapp fetched the first 1000 cases, filtered that page in the browser, and showed the open-case count only when the first page held every case (#877). Past 1000 cases the filters missed rows and the count disappeared.

UKMA Data's lists are sync feeds: rows above a change number, in change-number order, removed rows included (spec rule 5). Review cases are also read by staff, who want one status or kind and a count, not a full sync.

## Decision

`GET /v1/review-cases` takes optional `status` and `kind` filters and answers `total`: the cases above `after` that match the filters, across every page. Without filters it pages as before, so a syncing reader sees no change. The page stays in change-number order with the same cursor.

The Django proxy (`GET /api/v1/ukma-data/review-cases/`) validates the two filters, forwards only the ones given and passes `total` through; a page without `total` is an unexpected response (502). The webapp asks the proxy for the filters in the URL instead of filtering a page, and the overview shows `total` of open cases as the count.

## Consequences

- Filters and the count stay right past the first page.
- UKMA Data has to deploy before the proxy that reads `total`; the parser pipeline deploys on the same push, and the proxy answers 502 for the staff page until it does.
- The per-kind counts and the oldest open case on the overview still come from the first 1000 open cases, which is every case today.

## Considered Alternatives

- **Filter and count in the Django proxy** by reading every page from UKMA Data per request: no parser change, but each request would read the whole list.
- **A count per kind in `/v1/stats`** for the overview: the counts exist there, but the list filters would still need server support.
