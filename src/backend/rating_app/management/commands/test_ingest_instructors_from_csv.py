import io
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError

import pytest

from rating_app.management.commands.ingest_instructors_from_csv import (
    _is_internal,
    _is_service_display,
    _is_service_upn_local,
    _parse_name,
)
from rating_app.models import Instructor
from rating_app.tests.factories import StudentFactory

CSV_HEADER = "displayName,userPrincipalName,userType\n"


def _write_csv(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "users.csv"
    path.write_text(CSV_HEADER + body, encoding="utf-8")
    return path


def test_is_internal_accepts_member_with_ukma_domain():
    assert _is_internal(
        {
            "userPrincipalName": "ivan.petrenko@ukma.edu.ua",
            "userType": "Member",
        }
    )


@pytest.mark.parametrize(
    "row",
    [
        {"userPrincipalName": "guest@gmail.com", "userType": "Member"},
        {"userPrincipalName": "ivan@ukma.edu.ua", "userType": "Guest"},
        {
            "userPrincipalName": "x_gmail.com#EXT#@ukma.edu.ua",
            "userType": "Member",
        },
    ],
)
def test_is_internal_rejects_non_ukma_or_guest(row):
    assert not _is_internal(row)


@pytest.mark.parametrize(
    "name",
    [
        "",
        "   ",
        '"Quoted Name"',  # quote char is not name-legal
        "«ClubName»",  # guillemets + single token
        "abuse-mailboxes",  # service word in second token
        "Backup Account",  # service word
        "Admin Power BI",  # service word "admin"/"power"/"bi"
        "team",  # single lowercase token
        "Meeting Room 5",  # room name with a digit
        "Scholarship Fund 2020",  # org name with a digit
    ],
)
def test_is_service_display_rejects(name):
    assert _is_service_display(name)


@pytest.mark.parametrize(
    "name",
    [
        "Ivan Petrenko",
        "Петренко Іван",
        "Петренко Іван Васильович",
        "Anna Maria Doe",
        "Петренко Дар`я Іванівна",  # grave-accent apostrophe (U+0060) in the export
        "Іваненко Мар‘яна Петрівна",  # left single quote apostrophe (U+2018)
        "Коваленко В`ячеслав Олегович",
    ],
)
def test_is_service_display_accepts_human_name(name):
    assert not _is_service_display(name)


@pytest.mark.parametrize(
    "local",
    ["abuse", "info", "support", "noreply", "shared_inbox", "my_alias"],
)
def test_is_service_upn_local_rejects(local):
    assert _is_service_upn_local(local)


@pytest.mark.parametrize("local", ["ivan.petrenko", "a.kovalenko", "john.doe"])
def test_is_service_upn_local_accepts(local):
    assert not _is_service_upn_local(local)


def test_parse_name_cyrillic_three_tokens():
    first, patronymic, last = _parse_name("Петренко Іван Васильович")
    assert first == "Іван"
    assert patronymic == "Васильович"
    assert last == "Петренко"


def test_parse_name_cyrillic_two_tokens():
    first, patronymic, last = _parse_name("Петренко Іван")
    assert first == "Іван"
    assert patronymic == ""
    assert last == "Петренко"


def test_parse_name_cyrillic_two_tokens_reordered_by_mailbox():
    first, patronymic, last = _parse_name("Оксана Дорошенко", "z.doroshenko")
    assert first == "Оксана"
    assert patronymic == ""
    assert last == "Дорошенко"


def test_parse_name_cyrillic_two_tokens_mailbox_confirms_default_order():
    first, patronymic, last = _parse_name("Петренко Іван", "i.petrenko")
    assert first == "Іван"
    assert last == "Петренко"


def test_parse_name_ignores_a_mailbox_with_no_separator():
    first, _, last = _parse_name("Вікторія Савченко", "savchenko")
    assert first == "Савченко"
    assert last == "Вікторія"


def test_parse_name_no_separator_does_not_swap_a_correct_name():
    first, _, last = _parse_name("Петренко Іван", "ivan")
    assert first == "Іван"
    assert last == "Петренко"


def test_parse_name_ignores_a_surname_first_mailbox():
    first, _, last = _parse_name("Петренко Іван", "petrenko.ivan")
    assert first == "Іван"
    assert last == "Петренко"


def test_parse_name_ignores_an_initials_only_mailbox():
    first, _, last = _parse_name("Гнатюк Катерина", "h.k")
    assert first == "Катерина"
    assert last == "Гнатюк"


def test_parse_name_ignores_a_fully_spelled_mailbox():
    first, _, last = _parse_name("Назарій Литвин", "nazarii.lytvyn")
    assert first == "Литвин"
    assert last == "Назарій"


@pytest.mark.parametrize(
    "display_name,upn_local",
    [
        ("Щербак Софія", "s.shcherbak"),  # щ spelled "sh", not "shch"
        ("Хоменко Катерина", "k.chomenko"),  # х spelled "ch"
        ("Цимбал Тарас", "t.tzymbal"),  # ц spelled "tz"
    ],
)
def test_parse_name_survives_a_nonstandard_transliteration(display_name, upn_local):
    first, _, last = _parse_name(display_name, upn_local)
    assert last == display_name.split()[0]
    assert first == display_name.split()[1]


def test_parse_name_accepts_a_two_letter_initial():
    first, _, last = _parse_name("Марія Ковальчук", "ma.kovalchuk")
    assert first == "Марія"
    assert last == "Ковальчук"


def test_parse_name_uses_the_initial_when_the_surname_segment_is_ambiguous():
    first, _, last = _parse_name("Христина Гриценко", "k.hrytsenko")
    assert first == "Христина"
    assert last == "Гриценко"


@pytest.mark.parametrize(
    "display_name,upn_local",
    [
        ("Сидоренко Софія", "s.sydorenko"),
        ("Петренко Іван", "x.unrelated"),
        ("Петренко Іван", ""),
    ],
)
def test_parse_name_keeps_default_order_when_mailbox_is_no_help(display_name, upn_local):
    first, _, last = _parse_name(display_name, upn_local)
    assert last == display_name.split()[0]
    assert first == display_name.split()[1]


def test_parse_name_three_tokens_ignores_mailbox():
    first, patronymic, last = _parse_name("Гнатюк Катерина Ігорівна", "h.kateryna")
    assert first == "Катерина"
    assert patronymic == "Ігорівна"
    assert last == "Гнатюк"


def test_parse_name_latin_two_tokens():
    first, patronymic, last = _parse_name("Ivan Petrenko")
    assert first == "Ivan"
    assert patronymic == ""
    assert last == "Petrenko"


def test_parse_name_latin_multiple_tokens_keeps_last_as_remainder():
    first, patronymic, last = _parse_name("Anna Maria Doe")
    assert first == "Anna"
    assert patronymic == ""
    assert last == "Maria Doe"


@pytest.mark.django_db
def test_dry_run_makes_no_changes(tmp_path):
    csv_path = _write_csv(
        tmp_path,
        "Петренко Іван Васильович,i.petrenko@ukma.edu.ua,Member\n",
    )

    call_command(
        "ingest_instructors_from_csv",
        str(csv_path),
        "--dry-run",
        stdout=io.StringIO(),
    )

    assert Instructor.objects.count() == 0


@pytest.mark.django_db
def test_creates_instructor_from_cyrillic_name(tmp_path):
    csv_path = _write_csv(
        tmp_path,
        "Петренко Іван Васильович,i.petrenko@ukma.edu.ua,Member\n",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    instructor = Instructor.objects.get(email="i.petrenko@ukma.edu.ua")
    assert instructor.first_name == "Іван"
    assert instructor.patronymic == "Васильович"
    assert instructor.last_name == "Петренко"


@pytest.mark.django_db
def test_creates_instructor_from_reversed_cyrillic_name(tmp_path):
    csv_path = _write_csv(
        tmp_path,
        "Оксана Дорошенко,z.doroshenko@ukma.edu.ua,Member\n",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    instructor = Instructor.objects.get(email="z.doroshenko@ukma.edu.ua")
    assert instructor.first_name == "Оксана"
    assert instructor.last_name == "Дорошенко"


@pytest.mark.django_db
def test_existing_instructor_is_left_alone(tmp_path):
    Instructor.objects.create(
        email="i.petrenko@ukma.edu.ua",
        first_name="Іван",
        last_name="Петренко",
        patronymic="Васильович",
    )
    csv_path = _write_csv(
        tmp_path,
        "Хтось Інший,i.petrenko@ukma.edu.ua,Member\n",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    instructor = Instructor.objects.get(email="i.petrenko@ukma.edu.ua")
    assert instructor.last_name == "Петренко"
    assert instructor.patronymic == "Васильович"


@pytest.mark.django_db
def test_refresh_names_rewrites_an_existing_instructor(tmp_path):
    Instructor.objects.create(
        email="i.petrenko@ukma.edu.ua", first_name="Іван", last_name="Петренко"
    )
    csv_path = _write_csv(
        tmp_path,
        "Петренко Іван Васильович,i.petrenko@ukma.edu.ua,Member\n",
    )

    call_command(
        "ingest_instructors_from_csv",
        str(csv_path),
        "--refresh-names",
        stdout=io.StringIO(),
    )

    assert Instructor.objects.get(email="i.petrenko@ukma.edu.ua").patronymic == "Васильович"


@pytest.mark.django_db
def test_ingests_utf16_encoded_csv(tmp_path):
    # M365 exports occasionally land as UTF-16; the utf-8-sig probe must fail
    # and fall back rather than mis-decoding or raising.
    csv_path = tmp_path / "users_utf16.csv"
    csv_path.write_text(
        CSV_HEADER + "Петренко Іван Васильович,i.petrenko@ukma.edu.ua,Member\n",
        encoding="utf-16",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    assert Instructor.objects.filter(email="i.petrenko@ukma.edu.ua").exists()


@pytest.mark.django_db
def test_undecodable_csv_raises_command_error(tmp_path):
    csv_path = tmp_path / "users_bad.csv"
    # Invalid as utf-8 and odd-length for utf-16 → neither encoding decodes.
    csv_path.write_bytes(b"\x80\x81\x82")

    with pytest.raises(CommandError):
        call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())


@pytest.mark.django_db
def test_keeps_rows_matching_existing_student_email(tmp_path):
    # Students share the @ukma.edu.ua domain with staff and cannot be told apart
    # in the export, so a student-domain user is intentionally ingested; the
    # ranked list surfaces actually-rated teachers first instead.
    StudentFactory.create(email="student@ukma.edu.ua")
    csv_path = _write_csv(
        tmp_path,
        "Іваненко Олена Сергіївна,student@ukma.edu.ua,Member\n"
        "Петренко Іван Васильович,i.petrenko@ukma.edu.ua,Member\n",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    emails = set(Instructor.objects.values_list("email", flat=True))
    assert emails == {"student@ukma.edu.ua", "i.petrenko@ukma.edu.ua"}


@pytest.mark.django_db
def test_filters_service_rows(tmp_path):
    csv_path = _write_csv(
        tmp_path,
        "«Shared Club»,club@ukma.edu.ua,Member\n"
        "Backup Account,backup.account@ukma.edu.ua,Member\n"
        "Іван Петренко,ivan.petrenko@ukma.edu.ua,Guest\n"
        "Іваненко Іван Васильович,i.ivanenko@ukma.edu.ua,Member\n",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    emails = set(Instructor.objects.values_list("email", flat=True))
    assert emails == {"i.ivanenko@ukma.edu.ua"}


@pytest.mark.django_db
def test_idempotent_rerun_updates_instead_of_creating(tmp_path):
    csv_path = _write_csv(
        tmp_path,
        "Петренко Іван,i.petrenko@ukma.edu.ua,Member\n",
    )

    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())
    call_command("ingest_instructors_from_csv", str(csv_path), stdout=io.StringIO())

    assert Instructor.objects.filter(email="i.petrenko@ukma.edu.ua").count() == 1


@pytest.mark.django_db
def test_missing_required_column_raises(tmp_path):
    path = tmp_path / "users.csv"
    path.write_text("displayName,userPrincipalName\nFoo,foo@ukma.edu.ua\n", encoding="utf-8")

    with pytest.raises(CommandError):
        call_command("ingest_instructors_from_csv", str(path), stdout=io.StringIO())
