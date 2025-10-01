# User Stories

## US-001: Login with Corporate Email

**As a** student  
**I want** to log in with my corporate email  
**so that** the system can verify that I am a Kyiv-Mohyla Academy student.

**Acceptance Criteria:**  

- **Given:** I am not logged in  
  **When:** I try to access any protected page  
  **Then:** I am redirected to the platform’s login page (with "Login with Outlook" option)  

- **Given:** I am on the login page  
  **When:** I click "Login with Outlook" and enter a valid corporate email and password  
  **Then:** I am authenticated and redirected to the home page  

- **Given:** I am on the login page  
  **When:** I click "Login with Outlook" but enter an invalid email or incorrect password  
  **Then:** I see an error message indicating invalid email or password  

- **Given:** I am on the login page  
  **When:** I click "Login with Outlook" and enter a valid Outlook email and password, but the email is not part of the corporate university domain  
  **Then:** I am redirected back to the login page and I see a notification that only emails from the corporate university domain can access the site  

- **Given:** I am successfully logged in  
  **When:** I access any protected page  
  **Then:** I can access it without logging in again until my session expires

**INVEST:**

- **I (Independent):** Independent of other stories.  
- **N (Negotiable):** Exact login provider (Outlook) can be swapped if needed.  
- **V (Valuable):** Ensures only real students access the system.  
- **E (Estimable):** Scope is clear (integration with Outlook, domain validation).  
- **S (Small):** Limited only to login functionality.  
- **T (Testable):** Acceptance criteria define specific scenarios.

---

## US-002: Course Browsing

**As a** student  
**I want** to see a list of all available courses  
**so that** I can choose the ones I'm interested in or need to study.

**Acceptance Criteria:**  

- **Given:** The student is authenticated  
  **When:** They open the "Courses" page  
  **Then:** They see a complete list of all available courses with names and instructors  

- **Given:** There are many courses in the list  
  **When:** The student scrolls down  
  **Then:** Additional courses are loaded automatically or through a "Load More" button  

- **Given:** The list of courses is visible  
  **When:** The student clicks on a specific course  
  **Then:** They are navigated to a page with detailed information about that course  

- **Given:** There are no courses available  
  **When:** The student opens the "Courses" page  
  **Then:** A message saying "No courses available" is displayed  

**INVEST:**

- **I:** Independent of login, rating and other stories.  
- **N:** UI specifics (pagination vs infinite scroll) can be adjusted.  
- **V:** Core functionality to help students discover courses.  
- **E:** Easy to estimate; course listing is standard functionality.  
- **S:** Well-defined limited scope - web page with fetched data and empty state handling.  
- **T:** Each acceptance criterion is testable.

---

## US-003: Course Search

**As a** student  
**I want** to be able to search for a course by name  
**so that** I can quickly find the right course.

**Acceptance Criteria:**  

- **Given:** The student is on the courses list page  
  **When:** They type a course name or part of a name into the search bar  
  **Then:** Only the matching courses are displayed in the list  

- **Given:** The student has entered a search query  
  **When:** They clear the search input  
  **Then:** The full list of all courses is displayed again  

- **Given:** The student types in a partial name  
  **When:** There are courses with similar names  
  **Then:** The system displays courses that partially match the query  

- **Given:** The student enters a search query  
  **When:** No courses match the query  
  **Then:** A message saying "No courses found" is displayed  

**INVEST:**

- **I:** Independent of browsing, filtering, rating and other course features.  
- **N:** Search method (exact vs partial match) is flexible.  
- **V:** Saves time for students searching specific courses.  
- **E:** Clear scope, straightforward text search.  
- **S:** Defined only for search functionality.  
- **T:** Fully testable via search results and edge cases.

---

## US-004: Course Filtering

**As a** student  
**I want** to apply multiple filters (e.g., average rating and instructor)  
**so that** I can quickly and effectively analyze courses.

**Acceptance Criteria:**  

- **Given:** The student is on the courses page  
  **When:** They select a filter by average rating  
  **Then:** The list updates to show only courses matching that rating criteria  

- **Given:** The student has already applied one filter  
  **When:** They apply an additional filter by instructor  
  **Then:** The list updates to display only courses that match both filters  

- **Given:** Multiple filters are applied  
  **When:** The student clicks the "Clear Filters" button  
  **Then:** All filters are removed, and the full course list is displayed again  

- **Given:** One or more filters are applied  
  **When:** No courses match the filter criteria  
  **Then:** A message saying "No courses match your filters" is displayed  

**INVEST:**

- **I:** Independent of search, browsing, rating and other course features.  
- **N:** Filter criteria can evolve (faculty, semester, etc.).  
- **V:** Helps refine course choices effectively.  
- **E:** Clear functional boundaries.  
- **S:** Well-defined limited scope within filtering UI and logic.  
- **T:** Defined acceptance criteria for testing.

---

## US-005: Scatter Plot of Courses

**As a** student  
**I want** to see a home page with a scatter plot of courses by difficulty and usefulness  
**so that** I can easily discover and compare courses for academic decisions.

**Acceptance Criteria:**  

- **Given:** I have submitted ratings for all courses from the last completed semester and I am logged in  
  **When:** I open the application  
  **Then:** I can access the home page  

- **Given:** I am on the home page  
  **When:** The scatter plot is displayed  
  **Then:** The x-axis represents usefulness (1–5) and the y-axis represents difficulty (1–5)  

- **Given:** I am on the home page  
  **When:** The scatter plot is displayed  
  **Then:** Each course is represented as a point in the chart  

- **Given:** I hover over a point in the scatter plot  
  **When:** The tooltip appears  
  **Then:** I see key course information (course name, professor, faculty, credits, semester, average ratings)  

- **Given:** I click a point in the scatter plot  
  **When:** Navigation occurs  
  **Then:** I am taken to the course’s full information page (detailed ratings, comments, metadata)  

- **Given:** I am on the home page with the scatter plot displayed  
  **When:** I apply filters (year, semester, faculty, course type, credits, professor, level of study)  
  **Then:** Only the courses matching the applied filters are shown in the scatter plot  

- **Given:** I am on the home page with the scatter plot displayed  
  **When:** There is no data or no courses match the filters  
  **Then:** A message saying "No data available" is displayed  

**INVEST:**

- **I:** Independent of other course visualization features.  
- **N:** Design of axes or filters is adjustable.  
- **V:** Provides quick comparative insights.  
- **E:** Estimable based on charting library usage.  
- **S:** Defined only as a single chart implementation.  
- **T:** Testable through visible plot, filters, tooltips, and navigation.

---

## US-006: Course Ratings and Reviews on Course Page

**As a** student  
**I want** to see the rating and reviews of a course on its page  
**so that** I can decide whether to enroll in it in the future.

**Acceptance Criteria:**  

- **Given:** I open a course page and the course has ratings  
  **When:** The page loads  
  **Then:** I see the average and specific scores, and the number of ratings  

- **Given:** I open a course page and the course has text reviews  
  **When:** The page loads  
  **Then:** I see the list of reviews  

- **Given:** I open a course page and the course has no ratings  
  **When:** The page loads  
  **Then:** I see a message that the course has not been rated yet  

- **Given:** Reviews are displayed  
  **When:** The page loads  
  **Then:** They appear in reverse chronological order (most recent first)  

**INVEST:**

- **I:** Does not depend on other course rating features.  
- **N:** Display format can be adjusted.  
- **V:** Directly supports student decisions.  
- **E:** Clearly defined scope.  
- **S:** Simple presentation layer with data fetching.  
- **T:** Each acceptance criterion is testable.

---

## US-007: Course Recommendations on Course Page

**As a** student  
**I want** to see course recommendations directly on a course’s page  
**so that** I can discover other courses that students with similar interests found useful.

**Acceptance Criteria:**  

- **Given:** I am logged in as a student and there are courses to recommend  
  **When:** I open any course page  
  **Then:** I see a section labeled _“Students who took this course also liked:”_ with a short list of recommended courses  

- **Given:** Recommended courses are displayed  
  **When:** I click on a recommended course  
  **Then:** I can view its detail page  

- **Given:** I am logged in and there are no recommended courses available  
  **When:** I open the course page  
  **Then:** I see a message saying "No recommendations available"  

**INVEST:**

- **I:** Independent of other course recommendation features.  
- **N:** Recommendation logic is flexible.  
- **V:** Helps students find related useful courses.  
- **E:** Estimable as it reuses existing course data.  
- **S:** Defined only for course page presentation.  
- **T:** Testable through course presence/absence.

---

## US-008: Course Recommendations on Home Page

**As a** student  
**I want** to see course recommendations on my home page based on my ratings  
**so that** I can discover other courses that I might find useful.

**Acceptance Criteria:**  

- **Given:** I am logged in as a student and there are courses to recommend  
  **When:** I open the home page  
  **Then:** I see a section labeled _“Because you liked _:”_ showing a recommended course  

- **Given:** A recommended course is displayed  
  **When:** I click on it  
  **Then:** I can view its detail page  

- **Given:** I am logged in and have not rated (highly) any courses yet  
  **When:** I open the home page  
  **Then:** I do not see any recommendations based on my ratings  

- **Given:** I am logged in and there are no recommended courses available  
  **When:** I open the home page  
  **Then:** I see a message saying "No recommendations available"  

**INVEST:**  

- **I:** Independent of courses evaluation and other stories.  
- **N:** Recommendation logic is flexible.  
- **V:** Helps student exploration of new courses.  
- **E:** Clearly defined scope (homepage recommendations).  
- **S:** Single recommendation section.  
- **T:** Testable per acceptance criteria.

---

## US-009: Course Grading

**As a** student  
**I want** to grade the courses I have completed after the semester ends  
**so that** I and other students can benefit from feedback on course difficulty and usefulness.

**Acceptance Criteria:**  

- **Given:** The semester has ended and I am logged in  
  **When:** I open the grading section  
  **Then:** I see the list of courses I have completed and can select one to grade  

- **Given:** A course is selected for grading  
  **When:** I submit feedback  
  **Then:** I must provide both a difficulty rating and a usefulness rating, each on a 1–5 scale  

- **Given:** A course is selected for grading  
  **When:** I submit feedback  
  **Then:** I may optionally add an open-text comment  

- **Given:** I submit feedback  
  **When:** The feedback is stored  
  **Then:** My identity is hidden, and only ratings and comments are visible to others  

- **Given:** I have previously submitted feedback on a course  
  **When:** I return later to that course’s grading section  
  **Then:** I can edit my own feedback  

**INVEST:**  

- **I:** Independent of other stories.  
- **N:** Feedback fields can be extended.  
- **V:** Provides critical peer-based insight.  
- **E:** Clear scope (ratings + comments).  
- **S:** Defined only for students and their personal feedback.  
- **T:** Fully testable with feedback submission and editing.

---

## US-010: Student’s Total Evaluated Courses

**As a** student  
**I want** to see how many of my completed courses I have evaluated  
**so that** I can have a history of my feedback.

**Acceptance Criteria:**  

- **Given:** I am logged in as a student  
  **When:** I open my profile  
  **Then:** I see all my ratings and feedback on courses I have completed  

- **Given:** I am logged in as a student  
  **When:** I open my profile  
  **Then:** I see the total number of evaluated courses  

**INVEST:**

- **I:** Independent of grading submission and other student features.  
- **N:** Format of statistics can change.  
- **V:** Allows personal tracking of contributions.  
- **E:** Easy to estimate; simple aggregation.  
- **S:** Defined only for students and their personal statistics.  
- **T:** Acceptance criteria define clear tests.

---

## US-011: Student’s Evaluated Courses per Semester

**As a** student  
**I want** to see how many of my completed courses I have rated in the current semester  
**so that** I know how many are left to evaluate.

**Acceptance Criteria:**  

- **Given:** I am logged in as a student  
  **When:** I open my ratings page  
  **Then:** I see the number of courses I have rated in the current semester (absolute value and %)  

- **Given:** I am logged in as a student  
  **When:** I open my ratings page  
  **Then:** I see a progress bar showing my evaluation completion rate for the semester  

- **Given:** I am logged in as a student  
  **When:** I open my ratings page  
  **Then:** I can filter courses by whether they are rated or not  

- **Given:** I am logged in as a student  
  **When:** I open my ratings page  
  **Then:** I see a recommendation reminding me to evaluate courses that are not yet rated  

- **Given:** I rate one of the courses  
  **When:** The rating is submitted  
  **Then:** The progress is updated and changes are applied to personal statistics  

**INVEST:**  

- **I:** Independent of all courses statistics.  
- **N:** Display method can be flexible.  
- **V:** Helps student track semester obligations.  
- **E:** Straightforward to estimate.  
- **S:** Defined per semester only.  
- **T:** Testable via completion metrics.

---

## US-012: Course Evaluation Statistics for Admin

**As an** administrator  
**I want** to see the number of course evaluations on the platform  
**so that** I can analyze user activity.

**Acceptance Criteria:**  

- **Given:** I am logged in as an administrator and there are ratings in the system  
  **When:** I open the course evaluation statistics page  
  **Then:** I see the number of ratings for each course  

- **Given:** I am logged in as an administrator  
  **When:** I select a specific course  
  **Then:** I see the number of ratings over time  

- **Given:** I am logged in as an administrator  
  **When:** I open the statistics page  
  **Then:** I can filter results by semester, academic year, course name, and other entity fields  

- **Given:** I am logged in as an administrator and there are no ratings in the system  
  **When:** I open the course evaluation statistics page  
  **Then:** A message saying "No ratings available" is displayed  

**INVEST:**  

- **I:** Does not depend on other stories.  
- **N:** Specific charts or metrics can be adjusted.  
- **V:** Provides insight into engagement for administrators.  
- **E:** Scope is measurable.  
- **S:** Defined only for admins and regarding statistics.  
- **T:** Fully testable with statistics output.
