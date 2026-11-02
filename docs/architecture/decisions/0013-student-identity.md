# ADR-0013: A Student Is Matched by Programme Record and First Name, Not by Email

## Status

Proposed

## Date

2026-11-02

## Context

The UKMA Data [schema](../../parser-service/schema.md) made `students.email` unique and found a person by email, else by `cdoc`, never by name. Rate UKMA's Django ingest did the same: it matched a student by email alone.

**Forces:**

- **САЗ reuses emails.** A UKMA email is the first-name initial and a transliteration of the surname, and САЗ gives the address to a newer student after the older owner has left. In Rate UKMA's data on 2026-10-31, 32 emails belonged to more than one person: 23 with different first names, 9 where only the surname differs ([D14](../../parser-service/edge-cases.md#d14-one-email-two-people)).
- **A wrong merge is visible and personal.** The old ingest merged both people into one student, with the enrollments of both. 5 accounts sat on such students: a student who signed in saw another person's courses and could rate them.
- **Names drift.** A person can change surname, and САЗ writes the apostrophe in several ways (D6, D7), so a full-name match splits one person.
- **`cdoc` is stable but not a person.** It is one programme record (D1); a bachelor's and a later master's of one person have two `cdoc` values and one email.
- **Rate UKMA already fixed its side.** PR #819 matches a student by email and normalised first name, links an account only when the student's first name is a word of the account's name, and at sign-in takes the newest programme start among the matches.

## Decision

We will treat a programme record (`cdoc`) as the unit and never find a person by email alone.

1. A list entry finds its programme record by `cdoc`; the record keeps the student it has.
2. A new record joins the student with the same email and normalised first name (lower case, no spaces, `` ` ``, `ʼ` and `’` as `'`), else it starts a new student. A new record without an email always starts a new student, because nothing identifies its person (D3). `students` has no unique key on email or first name: the rule picks a student, and a split (3) can leave two students with the same pair.
3. When the email and first name match but the surname differs, the record joins that student, the safe answer for a surname change, and a `student_match` review case lets staff split it into a second person. A split moves the record to a new student, and rule 1 keeps it there on later runs.
4. Rate UKMA's sync maps service students to its own students by service id and must keep the split of PR #819: it never merges two service students because they share an email.

## Consequences

* ✅ Two people on one email stay apart in the service and in Rate UKMA, with their own enrollments and accounts.
* ✅ A surname change keeps one person.
* ⚠️ Two people with one email and one first name merge until staff split them; the review case makes them visible.
* ⚠️ A new review case kind and two decision kinds (`split_student`, `keep_student`) for the staff section.
* ❌ A typo in a first name splits one person into two; staff can merge them only through a decision.

## Considered Alternatives

1. **Email alone, as before.**
   - Rejection Reason: merges the 23 pairs with different first names, as the old ingest did.
2. **Email and full name.**
   - Pros: also keeps apart the 9 pairs with one first name.
   - Cons: a surname change or a spelling variant splits one person, and their records lose each other.
   - Rejection Reason: splits real people more often than the first name does, with no staff signal.
3. **`cdoc` only, one student per programme record.**
   - Pros: no matching at all.
   - Cons: a bachelor's and a master's of one person become two students, so a reader cannot follow a person across programmes or link one account.
   - Rejection Reason: Rate UKMA needs one person per account.
