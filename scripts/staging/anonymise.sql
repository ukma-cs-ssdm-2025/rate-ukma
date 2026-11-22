-- Removes personal data from a copy of Rate UKMA before it leaves the live host.
--
-- Run it inside the throwaway container made by copy-live-to-staging.sh, on the
-- database restored from live as rateukma_anon. It refuses to touch any other
-- database, so an accidental psql session against live cannot anonymise live.
--
-- Catalog rows, rating scores, votes, enrollments, plans and every count stay;
-- only the person behind them and the text they wrote are replaced.

-- The whole file is one DO block: one statement that runs or rolls back as a
-- unit, so no psql setting (ON_ERROR_STOP off, ON_ERROR_ROLLBACK on) can run
-- the writes after the guard has refused.
DO $anonymise$
BEGIN
    IF current_database() <> 'rateukma_anon'
       AND coalesce(current_setting('anonymise.allow_test', true), '') <> 'on' THEN
        RAISE EXCEPTION
            'refusing to anonymise database %; restore the live copy as rateukma_anon',
            current_database();
    END IF;

    -- Users: keep the account and its permissions, replace who it belongs to.
    -- Usernames go through a value that cannot collide with a real one first.
    UPDATE auth_user SET username = 'pending-anonymise-' || id;
    UPDATE auth_user
    SET username = 'user-' || id,
        email = 'user-' || id || '@example.invalid',
        first_name = '',
        last_name = '',
        password = '!';

    -- Sessions, API tokens, social logins and the audit trail describe a person's
    -- activity and are not needed on staging.
    DELETE FROM django_session;
    DELETE FROM authtoken_token;
    DELETE FROM socialaccount_socialtoken;
    DELETE FROM socialaccount_socialaccount;
    DELETE FROM socialaccount_socialapp_sites;
    DELETE FROM socialaccount_socialapp;
    DELETE FROM account_emailconfirmation;
    DELETE FROM account_emailaddress;
    DELETE FROM django_admin_log;
    DELETE FROM reversion_version;
    DELETE FROM reversion_revision;
    DELETE FROM rating_app_signin;
    DELETE FROM waffle_flag_users;

    -- Students and instructors: synthetic names and addresses, the row number keeps
    -- them distinct and satisfies the unique instructor email.
    UPDATE rating_app_student s
    SET first_name = 'Студент',
        last_name = numbered.n::text,
        patronymic = '',
        email = 'student-' || numbered.n || '@example.invalid',
        avatar = NULL
    FROM (
        SELECT id, row_number() OVER (ORDER BY id) AS n
        FROM rating_app_student
    ) AS numbered
    WHERE numbered.id = s.id;

    -- The instructor email is unique; park the old addresses first so the new ones
    -- cannot collide with a real address that looks synthetic.
    UPDATE rating_app_instructor SET email = 'pending-anonymise-' || id || '@example.invalid';
    UPDATE rating_app_instructor i
    SET first_name = 'Викладач',
        last_name = numbered.n::text,
        patronymic = '',
        email = 'teacher-' || numbered.n || '@example.invalid'
    FROM (
        SELECT id, row_number() OVER (ORDER BY id) AS n
        FROM rating_app_instructor
    ) AS numbered
    WHERE numbered.id = i.id;

    -- Free text a user wrote: the fixed placeholder, empty text stays empty.
    UPDATE rating_app_rating
    SET comment = CASE WHEN comment <> '' THEN 'Текст прихований на staging.' ELSE '' END,
        instructor = '';

    UPDATE rating_app_comment
    SET content = CASE WHEN content <> '' THEN 'Текст прихований на staging.' ELSE '' END;

    UPDATE rating_app_feedpost
    SET title = CASE WHEN title <> '' THEN 'Текст прихований на staging.' ELSE '' END,
        body = CASE WHEN body <> '' THEN 'Текст прихований на staging.' ELSE '' END;

    -- Notifications and feed events carry no text or JSON with a name; they point
    -- at the anonymised users above and stay.

    -- Sync runs, changes and approvals can carry teacher names and emails from
    -- UKMA Data (ADR-0022); staging's next run rebuilds them. Policies, their
    -- audit, mapping decisions and cursors hold no personal data and stay.
    -- Previews point at runs and staging users; they go with the runs.
    DELETE FROM rating_app_syncpreview;
    DELETE FROM rating_app_syncchange;
    DELETE FROM rating_app_syncapproval;
    DELETE FROM rating_app_syncrun;

    -- Self-check: raises, and so undoes everything above, if anything was missed.
    IF EXISTS (SELECT 1 FROM auth_user WHERE email NOT LIKE '%@example.invalid') THEN
        RAISE EXCEPTION 'auth_user still holds a real email';
    END IF;
    IF EXISTS (SELECT 1 FROM rating_app_student WHERE email NOT LIKE '%@example.invalid') THEN
        RAISE EXCEPTION 'rating_app_student still holds a real email';
    END IF;
    IF EXISTS (SELECT 1 FROM rating_app_instructor WHERE email NOT LIKE '%@example.invalid') THEN
        RAISE EXCEPTION 'rating_app_instructor still holds a real email';
    END IF;
    IF EXISTS (
        SELECT 1 FROM rating_app_rating
        WHERE comment NOT IN ('', 'Текст прихований на staging.')
    ) THEN
        RAISE EXCEPTION 'rating_app_rating still holds original comment text';
    END IF;
    IF EXISTS (
        SELECT 1 FROM rating_app_comment
        WHERE content NOT IN ('', 'Текст прихований на staging.')
    ) THEN
        RAISE EXCEPTION 'rating_app_comment still holds original text';
    END IF;
END
$anonymise$;
