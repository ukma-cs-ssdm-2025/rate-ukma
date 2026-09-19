# Meeting Notes

## Performance & Optimization

- **Milana** - Set up local e2e tests to verify delete grade flow changes pass correctly
- Axes in scatter plot doesn't support [something unclear]
- **Scatter plot heaviness issues:**
  - **Nastia** - Consider adding cron to warm up cache (~10 min intervals)
    - MVP: Send requests to heavy endpoints
    - Consider moving cache to service layer for easier warmup
  - **Andrii** - Check frontend reactivity during large timeouts
  - **Nastia** - Calculate and set explicit average usefulness/difficulty in service/repo layers
  - **Nastia** - Check possibility of reducing worker count
  - Check RAM scaling requirements for production
- Remove `page_size: 500` on scatter plot
- Add brotli and gzip (fallback) middleware (**important:** place in correct middleware order)

## Recommendations

- **Backend (Kate):**
  - Find balance in formula, keep it simple
  - Two layers:
    1. If no matching course history exists, use similar attendance history
    2. Ensure students can't be recommended ineligible courses (norms requirements)
  - Target: MVP
- **Frontend (Andrii):** Display indicator for attendance vs. rating-based recommendations

## User & Data Management

- **Milana** - Handle authenticated users inactive for 30+ minutes
- **Milana** - Add toaster + Sentry for rating/review submission failures
- **Nastia** - Ensure daily backups include newly submitted ratings/comments (simpler cron approach, keep in codebase)
- **Copilot** - Generate aliases for specialties with parentheses (#356)
- **Copilot** - Drop scraper commands from coverage (rating_app) — important despite lacking tests
- **Andrii** - Fix cmd+click and scroll-click not working as links
- **Milana** - Verify usefulness/difficulty color indicators work correctly