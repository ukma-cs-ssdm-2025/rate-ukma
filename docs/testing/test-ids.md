# Test ID Convention

This document describes the conventions and best practices for using `data-testid` attributes in the Rate UKMA frontend to support reliable E2E (end-to-end) testing.

## Overview

Test IDs (`data-testid` attributes) provide stable selectors for E2E tests, making tests more resilient to UI changes compared to relying on CSS classes, text content, or DOM structure.

## Convention

### Naming Pattern

Use kebab-case with a descriptive structure:

```
<feature>-<component>-<element>-<type>
```

Where:
- **feature**: The feature area (e.g., `login`, `courses`, `rating`)
- **component**: The component name (e.g., `form`, `modal`, `table`)
- **element**: The specific element (e.g., `submit`, `search`, `difficulty`)
- **type**: The element type suffix (e.g., `-button`, `-input`, `-modal`)

### Type Suffixes

Always end test IDs with a type suffix to clarify the element type:

| Suffix | Usage |
|--------|-------|
| `-button` | Clickable buttons, icon buttons |
| `-input` | Text inputs, search fields |
| `-textarea` | Multi-line text inputs |
| `-checkbox` | Checkbox controls |
| `-select` | Dropdown/select controls |
| `-slider` | Range/slider controls |
| `-modal` | Modal dialogs |
| `-drawer` | Side drawers |
| `-panel` | Filter panels, info panels |
| `-form` | Form containers |
| `-card` | Card components |
| `-table` | Data tables |
| `-row` | Table rows |

### Examples

```tsx
// Good examples
data-testid="login-microsoft-button"
data-testid="courses-search-input"
data-testid="rating-difficulty-slider"
data-testid="filters-reset-button"
data-testid="header-mobile-menu"

// Avoid
data-testid="btn1"           // Not descriptive
data-testid="loginBtn"       // Not kebab-case
data-testid="search"         // Missing type suffix
data-testid="submitButton"   // Not kebab-case
```

## Using the Test ID Library

The project provides a centralized test ID library at `src/lib/test-ids.ts` for consistent test IDs across the codebase.

### Pre-defined Test IDs

Import and use the pre-defined test IDs object:

```tsx
import { testIds } from "@/lib/test-ids";

// In your component
<Button data-testid={testIds.login.submitButton}>Login</Button>
<Input data-testid={testIds.courses.searchInput} />
```

### Available Test ID Categories

The `testIds` object is organized by feature:

- `testIds.login` - Login page elements
- `testIds.header` - Header and navigation elements
- `testIds.courses` - Courses page elements
- `testIds.filters` - Course filter elements
- `testIds.courseDetails` - Course details page elements
- `testIds.rating` - Rating modal and form elements
- `testIds.deleteDialog` - Delete confirmation dialog elements
- `testIds.myRatings` - My ratings page elements
- `testIds.common` - Common/shared elements

### Helper Functions

For dynamic or one-off test IDs, use the helper functions:

```tsx
import { getTestId, createTestIds } from "@/lib/test-ids";

// Simple test ID creation
const searchTestId = getTestId("courses", "search", "input");
// Result: "courses-search-input"

// Create a set of test IDs for a component
const formTestIds = createTestIds("contact-form", [
  "name-input",
  "email-input",
  "submit-button",
]);
// Result: { nameInput: "contact-form-name-input", emailInput: "contact-form-email-input", submitButton: "contact-form-submit-button" }
```

## Best Practices

### Do's

- ✅ **Use pre-defined test IDs** from `src/lib/test-ids.ts` when available
- ✅ **Add test IDs to interactive elements** (buttons, inputs, links)
- ✅ **Add test IDs to key containers** (modals, forms, panels)
- ✅ **Keep test IDs stable** - don't include dynamic values
- ✅ **Be descriptive** - test IDs should indicate what element they identify
- ✅ **Use consistent naming** - follow the kebab-case pattern

### Don'ts

- ❌ **Don't include dynamic data** (user IDs, timestamps, indices)
- ❌ **Don't use implementation details** (CSS classes, internal state)
- ❌ **Don't duplicate test IDs** - each should be unique
- ❌ **Don't add test IDs to every element** - focus on testable interactions
- ❌ **Don't use test IDs for styling** - they're for testing only

### When to Add Test IDs

Add test IDs to elements that:
1. Users interact with (buttons, inputs, links)
2. Display important information that tests verify
3. Represent key page states (loading, empty, error)
4. Are targeted by E2E tests

## Using Test IDs in E2E Tests

### Playwright Examples

```typescript
// Using page object pattern
class LoginPage {
  private readonly microsoftButton: Locator;

  constructor(page: Page) {
    this.microsoftButton = page.getByTestId("login-microsoft-button");
  }

  async clickMicrosoftLogin() {
    await this.microsoftButton.click();
  }
}

// Direct usage
await page.getByTestId("courses-search-input").fill("Introduction");
await page.getByTestId("rating-submit-button").click();
await expect(page.getByTestId("rating-modal")).toBeVisible();
```

### Testing Library Examples

```typescript
import { screen } from "@testing-library/react";

const searchInput = screen.getByTestId("courses-search-input");
const submitButton = screen.getByTestId("rating-submit-button");
```

## Adding New Test IDs

When adding new test IDs:

1. **Check if a pre-defined ID exists** in `src/lib/test-ids.ts`
2. **Add to the centralized object** if it's a commonly used element
3. **Use helpers** for one-off or dynamic scenarios
4. **Follow the naming convention** consistently
5. **Update this documentation** if adding a new category

### Extending the Test IDs Object

```typescript
// In src/lib/test-ids.ts
export const testIds = {
  // ... existing categories

  // Add a new category
  newFeature: {
    container: "new-feature-container",
    submitButton: "new-feature-submit-button",
    cancelButton: "new-feature-cancel-button",
  },
} as const;
```

## References

- [Playwright Best Practices - Locators](https://playwright.dev/docs/best-practices#use-locators)
- [Testing Library - ByTestId](https://testing-library.com/docs/queries/bytestid)
- [Kent C. Dodds - Making your UI tests resilient to change](https://kentcdodds.com/blog/making-your-ui-tests-resilient-to-change)
