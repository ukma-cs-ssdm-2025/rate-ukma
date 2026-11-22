import {
	SyncChangeGroupEnum,
	SyncChangeStateEnum,
	SyncSourceEnum,
} from "@/lib/api/generated";
import type {
	SyncChangeGroupEnum as Group,
	SyncChangeStateEnum as State,
	SyncPolicyModeEnum as Mode,
	SyncRunStatusEnum as RunStatus,
	SyncSourceEnum as Source,
} from "@/lib/api/generated";
import { read, toValue } from "./syncDisplay";

export const PAGE_SIZE = 20;

export const SOURCE_LABELS: Record<Source, string> = {
	teachers: "Викладачі",
	catalog: "Каталог",
};

export const GROUP_LABELS: Record<Group, string> = {
	link: "Звʼязки",
	new: "Нові записи",
	change: "Зміни",
	mapping: "Зіставлення",
	removed: "Вилучення",
};

export const STATE_LABELS: Record<State, string> = {
	proposed: "Очікує",
	applied: "Застосовано",
	rejected: "Відхилено",
	superseded: "Замінено",
};

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
	running: "Виконується",
	succeeded: "Успішно",
	failed: "Помилка",
};

export const MODE_LABELS: Record<Mode, string> = {
	needs_approval: "З підтвердженням",
	auto: "Автоматично",
};

export const NEVER_AUTO_REASON =
	"Питання зіставлення та зміни, що переносять оцінки, завжди потребують підтвердження";

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
	new_offering: "Нова вибірка",
	link_offering: "Звʼязок вибірки",
	change_offering: "Зміна вибірки",
	teacher_created: "Новий викладач",
	teacher_link_added: "Доданий викладач",
	teacher_link_removed: "Прибраний викладач",
	relink_course: "Перепривʼязка курсу",
	place_offering: "Куди подіти вибірку",
	move_offering: "Перенесення вибірки",
	merge_courses: "Обʼєднання курсів",
	removed_course: "Вилучений курс",
	removed_offering: "Вилучена вибірка",
} satisfies Record<string, string>;

export type SyncKindName = keyof typeof KIND_LABELS;

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
	["study_year", "Курс"],
	["max_students", "Максимум студентів"],
	["max_groups", "Максимум груп"],
	["group_size_min", "Мінімум у групі"],
	["group_size_max", "Максимум у групі"],
	["terms", "Терміни"],
	["specialities", "Спеціальності"],
	["specialities_added", "Додані спеціальності"],
	["ukma_data_id", "UKMA Data"],
	["faculty_ukma_id", "Факультет UKMA Data"],
	["department_ukma_id", "Кафедра UKMA Data"],
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
	["course_ukma_id", "Курс UKMA Data"],
	["merge_source", "Джерело обʼєднання"],
	["courses", "Курси"],
	["from_course", "З курсу"],
	["to_course_id", "На курс"],
	["to_course_ukma_id", "На курс UKMA Data"],
	["teacher_email", "Пошта викладача"],
	["role", "Роль"],
	["instructor_id", "Викладач"],
	["links", "Звʼязки"],
	["removed_at", "Вилучено"],
]);

export const SYNC_SOURCES = Object.values(SyncSourceEnum);
export const SYNC_GROUPS = Object.values(SyncChangeGroupEnum);
export const SYNC_STATES = Object.values(SyncChangeStateEnum);
export const ALL = "all";

const isKnownKind = (kind: string): kind is keyof typeof KIND_LABELS =>
	kind in KIND_LABELS;

const isState = (state: string): state is State => state in STATE_LABELS;

const isGroup = (group: string): group is Group => group in GROUP_LABELS;

export const kindLabel = (kind: string): string =>
	isKnownKind(kind) ? KIND_LABELS[kind] : fieldLabel(kind);

export const fieldLabel = (key: string): string => FIELD_LABELS.get(key) ?? key;

export const stateLabel = (state: string): string =>
	isState(state) ? STATE_LABELS[state] : state;

const UK_PLURALS = new Intl.PluralRules("uk");
const RATING_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "оцінок",
	one: "оцінка",
	two: "оцінки",
	few: "оцінки",
	many: "оцінок",
	other: "оцінки",
};

export const ratingLabel = (count: number): string =>
	`${count} ${RATING_FORMS[UK_PLURALS.select(count)]}`;

export function formatAge(seconds: number): string {
	const days = Math.floor(seconds / 86_400);
	if (days >= 1) {
		return `${days} дн`;
	}
	const hours = Math.floor(seconds / 3600);
	return hours >= 1 ? `${hours} год` : "менше години";
}

export function runStatusVariant(
	status: RunStatus,
): "success" | "soft-destructive" | "outline" {
	if (status === "succeeded") {
		return "success";
	}
	if (status === "failed") {
		return "soft-destructive";
	}
	return "outline";
}

export function dataAgeSeconds(updatedAt: string | null): number | null {
	return updatedAt
		? Math.max(0, Math.floor((Date.now() - Date.parse(updatedAt)) / 1000))
		: null;
}

export function countsSummary(counts: unknown): string[] {
	const root = toValue(counts);
	if (typeof root !== "object" || root === null || Array.isArray(root)) {
		return [];
	}
	return Object.keys(root).flatMap((key) => {
		const value = read(root, key);
		const label = isGroup(key) ? GROUP_LABELS[key] : kindLabel(key);
		if (typeof value === "number") {
			return [`${label}: ${value}`];
		}
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return [];
		}
		return Object.keys(value).flatMap((state) => {
			const count = read(value, state);
			return typeof count === "number"
				? [`${label} · ${stateLabel(state)}: ${count}`]
				: [];
		});
	});
}
