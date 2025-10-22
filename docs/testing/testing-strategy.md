# Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the Rate UKMA project, establishing standards, tools, coverage targets and quality gates to ensure software quality as the application scales.

## Testing Scope & Pyramid

We follow the testing pyramid model with emphasis on fast, reliable unit tests:

### Unit Tests (60%)

Fast feedback on individual components and functions

- **Backend**: pytest for models, views, services, utilities
- **Frontend**: Vitest for components, hooks, utilities, API clients
- **Isolation**: Mock external dependencies, use in-memory databases

### Integration Tests (30%)

Verify component interactions and data flow

- **Backend**: API endpoints with database interactions, authentication flows
- **Frontend**: Component integration, API client integration
- **Environment**: Test database, real service interactions where safe

### End-to-End Tests (10%)

Validate critical user journeys

- **Tool**: Playwright for browser automation
- **Scope**: Login, course rating, profile management
- **Environment**: Staging environment or production-like setup

## Coverage Targets

### Minimum Requirements

- **Backend**: 75% line coverage, 60% branch coverage
- **Frontend**: 70% line coverage, 50% branch coverage
- **Critical Paths**: 90% coverage for authentication, rating workflows

### Quality Gates

- **Block Merge**: Test failures, coverage below threshold
- **Warning**: Coverage decrease > 5%, new untested critical paths

## Tools & Framework Stack

### Backend Testing

- pytest
- pytest-django
- pytest-cov
- factory_boy (test fixtures)

### Frontend Testing

- Vitest
- @testing-library/react / @testing-library/dom / @testing-library/user-event
- jsdom (test environment)
- Playwright (E2E)

## Quality Assurance Process

### Development Workflow

1. **Write Tests First**: Try to write test-driven development for new features
2. **Run Locally**: Execute full test suite before committing
3. **Pre-commit Hooks**: Auto-format and run quick checks
4. **CI Pipeline**: Full test suite with coverage
5. **PR Review**: Code review includes test coverage assessment
6. **Merge**: All quality gates must pass

### Test Maintenance

- Identify and promptly fix flaky tests so they never block code delivery.
- Review and refresh test data and fixtures to keep them representative of real usage.
- Assess coverage periodically and triage any gaps.
- Conduct reviews to upgrade tooling and adjust testing strategy.

## Testing Best Practices

### Do's

- ✅ Write descriptive test names that explain what is being tested
- ✅ Test behavior, not implementation details
- ✅ Use meaningful test data with factories
- ✅ Keep tests independent and repeatable
- ✅ Mock external dependencies appropriately
- ✅ Test both happy path and edge cases

### Don'ts

- ❌ Don't test multiple behaviors in one test
- ❌ Don't depend on test execution order
- ❌ Don't use production data or services
- ❌ Don't ignore flaky tests - fix them
- ❌ Don't over-mock components under test
- ❌ Don't write brittle tests that break on minor changes
- ❌ Don't sacrifice test maintainability for coverage metrics

---

This strategy should be reviewed and updated as the project evolves and new testing challenges emerge.
