# Team meeting with supervisor — 2026-09-17

- Date: 2026-09-17
- Participants:
  - Maksym Korniichuk — supervisor
  - Anastasiia Aleksieienko
  - Andrii Valenia
  - Milana Horalevych
  - Anastasiia Dvoilenko
  - Note: Kateryna Bratiuk is a team member but her participation is not recorded in this transcript.

Discussion of the Rate UKMA project progress, its further development within the course, and agreement on how to complete practical assignments for an already working product.

## Course, organization, and grading

- Course progress can be tracked in the assessment journal on DistEdu.
- Tests and practical assignments have deadlines, so the team needs to check the relevant activities regularly.
- Practical assignments are graded mostly on a done / not-done basis.
- The supervisor may leave comments and recommendations for improvements, but these do not necessarily affect the current grade.
- Full-team attendance at meetings is expected. If someone cannot attend, they must notify the team in advance in the team channel and tag the supervisor.
- Anastasiia Aleksieienko warned the team in advance that she will not be able to attend the meeting next week.

## Product status

- The team continues working on the already functional Rate UKMA product — a platform for browsing and publishing student reviews of NaUKMA courses.
- The core problem the project solves:
  - information about the real experience of taking courses is usually passed between students informally;
  - existing course descriptions and credit counts do not always show the actual workload and course quality;
  - student reviews are not collected in one convenient place.
- The team already has:
  - a working product;
  - a rating and review system;
  - an interactive course map;
  - Microsoft / student-account authentication;
  - search, filtering, commenting, and review-rating mechanisms;
  - technical infrastructure and a repository with documentation.
- At the meeting, the team gave a short pitch covering the problem, target users, project history, and current product capabilities.

## Growth directions

- The team is considering three main directions for further work:
  - Study planner:
    - helps students build a set of elective courses;
    - lets them check whether they have collected the required number of credits;
    - may suggest several study-plan variants.
  - Automated data parser:
    - data updates from the internal system are currently partly manual;
    - the team wants to automate fetching and updating course and student information;
    - a correctness-check step will be kept before adding data to the system.
  - Analytics:
    - the team wants to see at which stages users stop interacting with the service;
    - planned analysis covers whether users start writing reviews, whether they finish them, and what actions they take in the system.
- Also discussed:
  - reminding students to leave a review after the end of the semester;
  - personalized messages about courses the user has already taken;
  - course recommendations based on similar ratings and preferences of other students;
  - using SAZ data, if technically and organizationally feasible.

## SAZ integration

- The team already tried to explore a SAZ integration, but there is currently no open API or access to the required data.
- The supervisor offered to connect the team with people who administered or developed the relevant systems, if needed.
- Before any integration, the following would need to be evaluated separately:
  - technical feasibility of the integration;
  - security questions;
  - handling student data;
  - the risk of expanding the project scope beyond what the course allows.
- At this stage, the team decided not to depend on SAZ access and to continue with the existing approach.

## Supervisor recommendations

- The project idea is relevant, clear, and has practical value for students.
- At the same time, the workload needs to stay realistic within the course.
- Not all proposed features need to be implemented at once. The team should set priorities and focus on the most valuable capabilities for users.
- Upcoming practical assignments will focus on clarifying the idea and analyzing users, their needs, and their problems.
- Since Rate UKMA already works, the team can complete assignments by adapting them to the existing product rather than starting from scratch.
- If a particular assignment does not fit the current state of the project, the team can discuss an alternative way of completing it with the supervisor.
- If needed, the supervisor is ready to help find developers or other specialists who can give the team additional technical feedback.
