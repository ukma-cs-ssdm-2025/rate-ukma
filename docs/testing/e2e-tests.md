# E2E Testing Strategy

## Running E2E Tests Locally

### Prerequisites

1. Ensure the webapp is running locally on `http://localhost:3000` (or set `BASE_URL` environment variable)
2. Set up Microsoft authentication credentials:

   ```bash
   export CORPORATE_EMAIL="your-email@domain.com"
   export CORPORATE_PASSWORD="your-password"
   ```

### Running Tests

```bash
# Navigate to the webapp directory
cd src/webapp

# Install dependencies (if not already done)
pnpm install

# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e -- login.test.ts

# Run tests in headed mode (see browser)
pnpm test:e2e -- --headed

# Run tests for specific project
pnpm test:e2e -- --project=chromium-auth
```

### Test Structure

- **Login Project**: Handles Microsoft authentication and saves session state
- **Chromium Auth Project**: Runs authenticated tests using saved session state
- Tests use Playwright with Chrome browser in headless mode by default

### Important Notes

- **Post-Development Checks**: Always verify and update E2E tests after modifying webapp UI or exposed API logic to ensure they reflect current application behavior
- **Pre-commit Exclusion**: E2E tests are not included in pre-commit hooks due to their time-consuming nature (authentication flows and full browser interactions)
