import type {
	SyncChangeGroupEnum as Group,
	SyncChangeStateEnum as State,
	SyncRunStatusEnum as RunStatus,
	SyncSourceEnum as Source,
	SyncSummaryAnswers,
} from "@/lib/api/generated";

export const PAGE_SIZE = 20;
export const LIST_PAGE_SIZE = 50;

export const SOURCE_LABELS = {
	catalog: "Каталог",
	teachers: "Викладачі",
} satisfies Record<Source, string>;

export const GROUP_LABELS = {
	link: "Звʼязки",
	new: "Нові записи",
	change: "Зміни полів",
	mapping: "Питання",
	removed: "Зникли з САЗ",
} satisfies Record<Group, string>;

export const STATE_LABELS = {
	proposed: "Чекає",
	applied: "Застосовано",
	rejected: "Відхилено",
	superseded: "Уже неактуальна",
	reverted: "Відкочено",
} satisfies Record<State, string>;

export const RUN_STATUS_LABELS = {
	running: "Виконується",
	succeeded: "Успішно",
	failed: "Помилка",
} satisfies Record<RunStatus, string>;

export const ANSWER_LABELS = {
	merge: "обʼєднати",
	keep_apart: "залишити окремо",
	keep: "залишити",
	place: "розмістити",
	move: "перенести",
	relink: "перепривʼязати",
} satisfies Record<keyof SyncSummaryAnswers, string>;

export const SYNC_KINDS = [
	"new_faculty",
	"link_faculty",
	"change_faculty",
	"new_department",
	"link_department",
	"change_department",
	"new_course",
	"link_course",
	"change_course",
	"new_offering",
	"link_offering",
	"change_offering",
	"teacher_created",
	"teacher_link_added",
	"teacher_link_removed",
	"relink_course",
	"place_offering",
	"move_offering",
	"merge_courses",
	"removed_course",
	"removed_offering",
] as const;

export type SyncKind = (typeof SYNC_KINDS)[number];

export const KIND_LABELS = {
	new_faculty: "Новий факультет",
	link_faculty: "Звʼязок факультету",
	change_faculty: "Зміна факультету",
	new_department: "Нова кафедра",
	link_department: "Звʼязок кафедри",
	change_department: "Зміна кафедри",
	new_course: "Нова дисципліна",
	link_course: "Звʼязок дисципліни",
	change_course: "Зміна дисципліни",
	new_offering: "Новий семестр дисципліни",
	link_offering: "Звʼязок семестру",
	change_offering: "Зміна семестру",
	teacher_created: "Новий викладач",
	teacher_link_added: "Доданий викладач",
	teacher_link_removed: "Прибраний викладач",
	relink_course: "Перепривʼязка дисципліни",
	place_offering: "Семестр без дисципліни",
	move_offering: "Перенесення семестру",
	merge_courses: "Обʼєднання дисциплін",
	removed_course: "Дисципліна зникла з САЗ",
	removed_offering: "Семестр зник з САЗ",
} satisfies Record<SyncKind, string>;

export const KIND_TAB_LABELS = {
	new_faculty: "Факультети",
	link_faculty: "Факультети",
	change_faculty: "Факультети",
	new_department: "Кафедри",
	link_department: "Кафедри",
	change_department: "Кафедри",
	new_course: "Дисципліни",
	link_course: "Дисципліни",
	change_course: "Дисципліни",
	new_offering: "Семестри дисциплін",
	link_offering: "Семестри дисциплін",
	change_offering: "Семестри дисциплін",
	teacher_created: "Нові викладачі",
	teacher_link_added: "Додані викладачі",
	teacher_link_removed: "Прибрані викладачі",
	relink_course: "Перепривʼязки",
	place_offering: "Семестри без дисципліни",
	move_offering: "Перенесення",
	merge_courses: "Обʼєднання",
	removed_course: "Дисципліни",
	removed_offering: "Семестри дисциплін",
} satisfies Record<SyncKind, string>;

export const SKIP_REASONS = [
	"no_term",
	"zero_credits",
	"credits_out_of_range",
	"title_too_long",
	"bad_saz_code",
	"no_department",
	"unknown_programme",
	"identity_collision",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export const SKIP_REASON_LABELS = {
	no_term: "Немає семестру",
	zero_credits: "Нуль кредитів",
	credits_out_of_range: "Кредити поза межами",
	title_too_long: "Задовга назва",
	bad_saz_code: "Некоректний код САЗ",
	no_department: "Немає кафедри",
	unknown_programme: "Невідома програма",
	identity_collision: "Дві дисципліни з однаковою назвою й кафедрою",
} satisfies Record<SkipReason, string>;

export const SUPERSEDED_REASONS = [
	"replaced",
	"stale",
	"exists",
	"identity_collision",
	"dependency_rejected",
] as const;

export type SupersededReason = (typeof SUPERSEDED_REASONS)[number];

export const SUPERSEDED_REASON_LABELS = {
	replaced: "замінено новішою зміною",
	stale: "дані в Rate UKMA уже інші",
	exists: "запис уже існує",
	identity_collision: "дві дисципліни з однаковою назвою й кафедрою",
	dependency_rejected: "відхилено зміну, від якої вона залежить",
} satisfies Record<SupersededReason, string>;

export const FAILED_RUN_REASONS = [
	"short_read",
	"stalled_read",
	"forbidden",
] as const;

export type FailedRunReason = (typeof FAILED_RUN_REASONS)[number];

export const FAILED_RUN_LABELS = {
	short_read: "UKMA Data віддала неповні дані",
	stalled_read: "UKMA Data перестала відповідати під час читання",
	forbidden: "Ключ доступу до UKMA Data не має потрібного права",
} satisfies Record<FailedRunReason, string>;

export const FIELD_LABELS = new Map<string, string>([
	["name", "Назва"],
	["title", "Назва"],
	["email", "Пошта"],
	["last_name", "Прізвище"],
	["first_name", "Імʼя"],
	["middle_name", "По батькові"],
	["saz_code", "Код САЗ"],
	["semester", "Семестр"],
	["exam_type", "Форма контролю"],
	["study_year", "Рік навчання"],
	["max_students", "Максимум студентів"],
	["max_groups", "Максимум груп"],
	["group_size_min", "Мінімум у групі"],
	["group_size_max", "Максимум у групі"],
	["terms", "Семестри"],
	["specialities", "Спеціальності"],
	["specialities_added", "Додані спеціальності"],
	["ukma_data_id", "Ідентифікатор у даних САЗ"],
	["majority_share", "Частка збігу"],
	["faculty_ukma_id", "Факультет (дані САЗ)"],
	["department_ukma_id", "Кафедра (дані САЗ)"],
	["department", "Кафедра"],
	["education_level", "Рівень освіти"],
	["status", "Стан"],
	["description", "Опис"],
	["level", "Рівень"],
	["credits", "Кредити"],
	["weekly_hours", "Годин на тиждень"],
	["lecture_count", "Лекцій"],
	["practice_count", "Практичних"],
	["practice_type", "Тип практичних"],
	["candidates", "Кандидати"],
	["course_id", "Дисципліна"],
	["course_ukma_id", "Дисципліна (дані САЗ)"],
	["merge_source", "Джерело обʼєднання"],
	["courses", "Дисципліни"],
	["from_course", "З дисципліни"],
	["to_course_id", "До дисципліни"],
	["to_course_ukma_id", "До дисципліни (дані САЗ)"],
	["teacher_email", "Пошта викладача"],
	["role", "Роль"],
	["instructor_id", "Викладач"],
	["links", "Звʼязки"],
	["removed_at", "Зникли з САЗ"],
]);
