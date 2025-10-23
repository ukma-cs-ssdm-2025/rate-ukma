# Review Log

## Reviewing team

Punkcoders

## 3 strengths

- Lots of integration testing. This is beneficial to early bugs detection.
- SEC-001 is mentioned in test plan
- Able to be tested in CI

## 2 areas for improvement

- No link to FR/NFR/US or other docs
- Some tests don't match actual requirements (e.g., "Анонімний користувач не може створити страву" has no corresponding FR/NFR)

## Changes you made after the review

1. Added explicit references to FR/NFR numbers for each test
2. Clarified test expectations to match actual requirements
3. Added proper mapping to requirement documents
4. Updated acceptance criteria to align with documented constraints
5. Improved traceability between tests and requirements