# CI/CD Workflows Testing

## Overview

To keep the deployments history clean and stable, we have opted for using a mirror repository approach for testing workflow changes.

## Testing Strategy

### 1. Repository Mirroring for Testing

**Setup the tester repository:**

```bash
# Mirror the main repository to a dedicated testing repository
# This a private repository of our CI maintainer, where all the team members are collaborators

git push --mirror https://github.com/stasiaaleks/rate-ukma-ci-tester.git
```

**Why this approach:**

- **Real-world testing**: Unlike local simulation tools, this method tests workflows in the actual GitHub Actions environment
- **Full deployment testing**: Since our workflows perform real deployments, testing in isolation ensures production safety
- **Environment accuracy**: Tests run with the same secrets, permissions, and infrastructure as production
- **Risk isolation**: Any issues during testing only affect the tester repository and its associated environments

### 2. Testing Workflow

1. **Initial Setup**: Mirror the main repository to `rate-ukma-ci-tester`
2. **Make Changes**: Implement workflow modifications in the tester repository
3. **Test CI**: Trigger workflows and verify they work correctly
4. **Verify Deployments**: Confirm that staging/production deployments in the tester repo work as expected
5. **Iterate**: Make additional changes as needed based on test results
6. **Apply to Main**: Once satisfied, apply the tested changes to the main repository
7. **Clean Up**: Remove the tester repository when no longer needed

## Considered Alternatives

### Act (GitHub Actions Local Runner)

**Pros:**

- Fast iteration cycles (no waiting for GitHub Actions)
- Cost-effective (no GitHub Actions minutes consumed)
- Local debugging capabilities

**Cons:**

- Cannot test real deployments or external service integrations
- Limited secret/variable simulation
- May not catch environment-specific issues
- Doesn't validate GitHub-specific features perfectly
