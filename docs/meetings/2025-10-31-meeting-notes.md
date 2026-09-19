## General Points

1. **Kate and Milana** will split the remaining SonarQube issues between themselves.  
   - If additional support is needed, particularly for CI-related tasks or complex frontend issues, these can be reassigned to **Andrii** or **Anastasiia**.

2. **SonarCloud Project Overview:**
   - **Maintainability Rating (A–E):** A  
   - **Technical Debt:**
     - **14,376 lines of code**
     - **23 hours total**
     - **1.6 hours of technical debt per 1,000 lines of code**
   - **Duplicated Lines:** 0.4%  
   - **Reliability Rating (A–E):** E  

3. **Andrii:** Investigate why the backend audit occasionally fails randomly.

4. **Nastia:** Finalize the changelog process:
   - Create a release with every version bump.
   - Mark releases as *pre-release* until they are deployed to the live environment.
   - **To-do:** Confirm with Serge whether using GitHub Releases (which we already have and planned to improve) is acceptable.


## Roles

| Role                | Responsibility                                      | Assignee    |
| ------------------- | --------------------------------------------------- | ------------ |
| **Code Analyst**    | Perform analysis in SonarCloud and record metrics   | Katya        |
| **Refactoring Lead**| Coordinate refactoring efforts and code quality     | Milana       |
| **QA Engineer**     | Run tests and record regression results             | Andrii       |
| **Release Manager** | Update CHANGELOG and semantic versioning            | Anastasiia   |


## Tasks

1. **Milana:**  
   - Complete deduplication.  
   - **Andrii** will create a task for E2E flow testing.  
   - **Acceptance Criteria:**  
     - Ready for live deployment.  
     - JSON prepared for ingestion (post-deduplication).  
     - SonarQube issues resolved.

2. **Nastia:**  
   - Finalize release creation.  
   - Continue with E2E testing.  
   - Develop **course analytics**:
     - On the frontend, group courses if the list is too large.
     - Return all courses by default and apply the same filters as used in the table.
     - Include faculty names with each course.
     - Returned data should include:
       - Difficulty  
       - Usefulness  
       - Number of ratings  
       - Course name  
       - Faculty name  
       - Course ID  

3. **Kate:**  
   - Create an endpoint to return **authorized student courses**:
     - Used in the “My Grades” section.
     - Also used when a student opens a course details page.
     - Consider including progress tracking (TBD).
   - Add **Feed Page** idea to the backlog (status: TBD).
   - Continue resolving SonarQube issues.

4. **Andrii:**  
   - Finalize **course details** implementation.  
   - Implement **basic rating functionality**.  
   - Fix Katya’s reported frontend bug.  
   - Remove **hardcoded page references**.