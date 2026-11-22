import type {
	ActionEnum,
	OutcomeEnum,
	SyncChangeGroupEnum as Group,
	SyncChangeStateEnum as State,
	SyncPolicyModeEnum as Mode,
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
} satisfies Record<State, string>;

export const RUN_STATUS_LABELS = {
	running: "Виконується",
	succeeded: "Успішно",
	failed: "Помилка",
} satisfies Record<RunStatus, string>;

export const MODE_LABELS = {
	needs_approval: "З підтвердженням",
	auto: "Автоматично",
} satisfies Record<Mode, string>;

export const ACTION_LABELS = {
	apply: "Застосування",
	reject: "Відхилення",
	preview: "Перегляд",
} satisfies Record<ActionEnum, string>;

export const OUTCOME_LABELS = {
	started: "Триває",
	applied: "Виконано",
	refused: "Відмовлено",
	failed: "Помилка",
} satisfies Record<OutcomeEnum, string>;

export const ANSWER_LABELS = {
	merge: "обʼєднати",
	keep_apart: "залишити окремо",
	keep: "залишити",
	place: "розмістити",
	move: "перенести",
} satisfies Record<keyof SyncSummaryAnswers, string>;

export const NEVER_AUTO_REASON =
	"Питання й зміни, що переносять оцінки, завжди потребують підтвердження";

export const AUTO_COPY =
	"Застосовується щоночі без вас, крім змін, що зачіпають оцінки чи плани";

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
	new_course: "Новий курс",
	link_course: "Звʼязок курсу",
	change_course: "Зміна курсу",
	new_offering: "Новий курс у семестрі",
	link_offering: "Звʼязок курсу в семестрі",
	change_offering: "Зміна курсу в семестрі",
	teacher_created: "Новий викладач",
	teacher_link_added: "Доданий викладач",
	teacher_link_removed: "Прибраний викладач",
	relink_course: "Перепривʼязка курсу",
	place_offering: "Курс у семестрі без курсу",
	move_offering: "Перенесення курсу в семестрі",
	merge_courses: "Обʼєднання курсів",
	removed_course: "Курс зник з САЗ",
	removed_offering: "Курс у семестрі зник з САЗ",
} satisfies Record<SyncKind, string>;

export const KIND_TAB_LABELS = {
	new_faculty: "Факультети",
	link_faculty: "Факультети",
	change_faculty: "Факультети",
	new_department: "Кафедри",
	link_department: "Кафедри",
	change_department: "Кафедри",
	new_course: "Курси",
	link_course: "Курси",
	change_course: "Курси",
	new_offering: "Курси в семестрі",
	link_offering: "Курси в семестрі",
	change_offering: "Курси в семестрі",
	teacher_created: "Нові викладачі",
	teacher_link_added: "Додані викладачі",
	teacher_link_removed: "Прибрані викладачі",
	relink_course: "Перепривʼязки",
	place_offering: "Курси в семестрі без курсу",
	move_offering: "Перенесення",
	merge_courses: "Обʼєднання",
	removed_course: "Курси",
	removed_offering: "Курси в семестрі",
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
	["max_students", "Макс. студентів"],
	["max_groups", "Максимум груп"],
	["group_size_min", "Мінімум у групі"],
	["group_size_max", "Максимум у групі"],
	["terms", "Терміни"],
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
	["practice_count", "Практик"],
	["practice_type", "Тип практик"],
	["candidates", "Кандидати"],
	["course_id", "Курс"],
	["course_ukma_id", "Курс (дані САЗ)"],
	["merge_source", "Джерело обʼєднання"],
	["courses", "Курси"],
	["from_course", "З курсу"],
	["to_course_id", "На курс"],
	["to_course_ukma_id", "На курс (дані САЗ)"],
	["teacher_email", "Пошта викладача"],
	["role", "Роль"],
	["instructor_id", "Викладач"],
	["links", "Звʼязки"],
	["removed_at", "Зникли з САЗ"],
]);
