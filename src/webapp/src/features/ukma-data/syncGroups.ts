import type {
	SyncApprovalDetail,
	SyncChangeGroupEnum,
	SyncSummaryGroups,
} from "@/lib/api/generated";
import {
	countWith,
	formatCount,
	formatDayTime,
	formatTime,
} from "./syncFormat";
import type { PluralForms } from "./syncFormat";
import { fieldLabel } from "./syncFields";
import { approvalCounts, sameDay } from "./syncReview";
import {
	DISCIPLINES,
	joinParts,
	NEW_DISCIPLINES,
	NEW_SEMESTERS,
	ORGS,
	PAIRS,
	RECORDS,
	SEMESTERS,
	semestersIn,
} from "./syncWords";

export const GROUP_KEYS = [
	"links",
	"new",
	"changes",
	"merges",
	"placements",
	"removed",
	"other",
] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];

export const SYNC_VIEWS = [
	"overview",
	"links",
	"new",
	"fields",
	"merge",
	"pairs",
	"place",
	"other",
] as const;

export type SyncView = (typeof SYNC_VIEWS)[number];

export type Chip = "safe" | "appears" | "changes" | "manual" | "ratings";

export const CHIP_LABELS = {
	safe: "Нічого не змінить на сайті",
	appears: "З'явиться на сайті",
	changes: "Зміниться на сайті",
	manual: "Треба вибрати вручну",
	ratings: "Може перенести оцінки",
} satisfies Record<Chip, string>;

export interface Part {
	label: string;
	forms: PluralForms;
	count: number;
}

export interface GroupLine {
	key: GroupKey;
	title: string;
	effect: string;
	chip: Chip;
	count: number;
	action: { label: string; view: SyncView | null };
	link: { label: string; view: SyncView } | null;
	parts: Part[];
}

export interface DoneLine {
	key: GroupKey;
	title: string;
	detail: string;
	runId: number;
}

const FACULTIES = {
	one: "новий факультет",
	few: "нові факультети",
	many: "нових факультетів",
} satisfies PluralForms;

const DEPARTMENTS = {
	one: "нова кафедра",
	few: "нові кафедри",
	many: "нових кафедр",
} satisfies PluralForms;

const nonZero = (parts: readonly Part[]): Part[] =>
	parts.filter((part) => part.count > 0);

const phrase = (parts: readonly Part[]): string =>
	joinParts(nonZero(parts).map((part) => countWith(part.count, part.forms)));

export function linkParts(groups: SyncSummaryGroups): Part[] {
	const { links } = groups;
	return nonZero([
		{ label: "Дисципліни", forms: DISCIPLINES, count: links.courses },
		{
			label: "Семестри цих дисциплін",
			forms: SEMESTERS,
			count: links.offerings,
		},
		{
			label: "Факультети й кафедри",
			forms: ORGS,
			count: links.faculties + links.departments,
		},
	]);
}

function linksLine(groups: SyncSummaryGroups): GroupLine {
	const total = groups.links.total;
	return {
		key: "links",
		title: `${phrase(linkParts(groups))} — ті самі, що в САЗ`,
		effect:
			"Підтвердження лише запам'ятовує, що це одне й те саме. На сайті нічого не зміниться, оцінки залишаються на місці.",
		chip: "safe",
		count: total,
		action: { label: `Підтвердити всі ${formatCount(total)}`, view: null },
		link: { label: "Переглянути список", view: "links" },
		parts: linkParts(groups),
	};
}

function newLine(groups: SyncSummaryGroups): GroupLine {
	const { new: rows } = groups;
	const main = nonZero([
		{ label: "Дисципліни", forms: NEW_DISCIPLINES, count: rows.courses },
		{ label: "Семестри", forms: NEW_SEMESTERS, count: rows.offerings },
	]);
	const orgs = nonZero([
		{ label: "Факультети", forms: FACULTIES, count: rows.faculties },
		{ label: "Кафедри", forms: DEPARTMENTS, count: rows.departments },
	]);
	const headline = main.length > 0 ? main : orgs;
	const verb = rows.total === 1 ? "з'явиться" : "з'являться";
	const extra =
		main.length > 0 && orgs.length > 0
			? ` Разом із ними — ${phrase(orgs)}.`
			: "";
	return {
		key: "new",
		title: `${phrase(headline)} ${verb} на сайті`,
		effect: `Студенти побачать їх у каталозі й зможуть оцінювати.${extra}`,
		chip: "appears",
		count: rows.total,
		action: { label: "Переглянути", view: "new" },
		link: null,
		parts: [...main, ...orgs],
	};
}

function changesLine(groups: SyncSummaryGroups): GroupLine {
	const { changes } = groups;
	const title =
		changes.offerings === changes.total
			? `У ${semestersIn(changes.total)} змінились дані в САЗ`
			: `${countWith(changes.total, RECORDS)} мають нові дані в САЗ`;
	const top = changes.by_field[0];
	const lead =
		top === undefined
			? ""
			: `Найчастіше — ${fieldLabel(top.field).toLowerCase()} (${formatCount(top.count)}). `;
	return {
		key: "changes",
		title,
		effect: `${lead}Студенти побачать нові значення на сторінці дисципліни; оцінки це не зачіпає.`,
		chip: "changes",
		count: changes.total,
		action: { label: "Переглянути", view: "fields" },
		link: null,
		parts: [{ label: "Семестри", forms: SEMESTERS, count: changes.total }],
	};
}

function mergesLine(groups: SyncSummaryGroups): GroupLine {
	const { merges } = groups;
	const rated =
		merges.rated > 0
			? ` ${countWith(merges.rated, PAIRS)} ${merges.rated === 1 ? "має" : "мають"} оцінки (${formatCount(merges.ratings)}) — їх вирішуєте по одній.`
			: "";
	const unrated =
		merges.unrated > 0
			? ` ${merges.rated > 0 ? "Решта" : "Усі"} ${formatCount(merges.unrated)} без оцінок — одним списком.`
			: "";
	return {
		key: "merges",
		title: `${countWith(merges.total, PAIRS)} дисциплін ${merges.total === 1 ? "схожа" : "схожі"} на дублікати`,
		effect: `Однакова назва, дві сторінки на сайті, одна дисципліна в САЗ.${rated}${unrated}`,
		chip: merges.rated > 0 ? "ratings" : "manual",
		count: merges.total,
		action:
			merges.rated > 0
				? { label: "Вирішувати по одній", view: "merge" }
				: { label: "Переглянути список", view: "pairs" },
		link:
			merges.rated > 0 && merges.unrated > 0
				? {
						label: `Пари без оцінок (${formatCount(merges.unrated)})`,
						view: "pairs",
					}
				: null,
		parts: [{ label: "Пари", forms: PAIRS, count: merges.total }],
	};
}

function placementsLine(groups: SyncSummaryGroups): GroupLine {
	const { total } = groups.placements;
	return {
		key: "placements",
		title: `${countWith(total, SEMESTERS)} треба прикріпити до однієї з дисциплін`,
		effect:
			"На сайті кілька дисциплін з такою назвою, і САЗ не каже, яка з них. Оберіть потрібну для кожного семестру.",
		chip: "manual",
		count: total,
		action: { label: "Вирішувати по одній", view: "place" },
		link: null,
		parts: [{ label: "Семестри", forms: SEMESTERS, count: total }],
	};
}

export function removedParts(groups: SyncSummaryGroups): Part[] {
	return [
		{
			label: "Записи, яких більше немає в САЗ",
			forms: RECORDS,
			count: groups.removed.total,
		},
	];
}

function removedLine(groups: SyncSummaryGroups): GroupLine {
	const { total } = groups.removed;
	return {
		key: "removed",
		title: `${countWith(total, RECORDS)} більше немає в САЗ`,
		effect:
			"Сайт нічого не видаляє: сторінки й оцінки залишаються. Підтвердження лише позначає їх переглянутими.",
		chip: "safe",
		count: total,
		action: { label: "Позначити переглянутими", view: null },
		link: null,
		parts: removedParts(groups),
	};
}

export function otherParts(groups: SyncSummaryGroups): Part[] {
	return [{ label: "Інші зміни", forms: RECORDS, count: groups.other.total }];
}

function otherLine(groups: SyncSummaryGroups): GroupLine {
	const { total } = groups.other;
	return {
		key: "other",
		title: `Інші зміни: ${formatCount(total)}`,
		effect:
			"Зміни, що не належать до жодної групи вище. Перегляньте їх списком, перш ніж застосувати.",
		chip: "changes",
		count: total,
		action: { label: "Переглянути", view: "other" },
		link: null,
		parts: otherParts(groups),
	};
}

export function groupLines(groups: SyncSummaryGroups): GroupLine[] {
	return [
		linksLine(groups),
		newLine(groups),
		changesLine(groups),
		mergesLine(groups),
		placementsLine(groups),
		removedLine(groups),
		otherLine(groups),
	];
}

export function openLines(groups: SyncSummaryGroups): GroupLine[] {
	return groupLines(groups).filter((line) => line.count > 0);
}

export function approvalGroup(
	approval: Pick<SyncApprovalDetail, "group" | "kind">,
): GroupKey | null {
	const keys: Record<SyncChangeGroupEnum, GroupKey> = {
		link: "links",
		new: "new",
		change: "changes",
		mapping: "placements",
		removed: "removed",
	};
	const group = Object.entries(keys).find(([name]) => name === approval.group);
	if (group === undefined) {
		return null;
	}
	return approval.kind === "merge_courses" ? "merges" : group[1];
}

const DONE_TITLES = {
	links: (count: number) =>
		`✓ ${countWith(count, RECORDS)} позначено як ті самі, що в САЗ`,
	new: (count: number) => `✓ На сайт додано ${countWith(count, RECORDS)}`,
	changes: (count: number) => `✓ Оновлено ${countWith(count, RECORDS)}`,
	merges: () => "✓ Усі пари, схожі на дублікати, вирішено",
	placements: () => "✓ Усі семестри прикріплено",
	removed: (count: number) =>
		`✓ ${countWith(count, RECORDS)} позначено переглянутими`,
	other: (count: number) => `✓ Інші зміни: ${formatCount(count)}`,
} satisfies Record<GroupKey, (count: number) => string>;

const DONE_EFFECTS = {
	links: "На сайті нічого не змінилось.",
	new: "Студенти бачать їх у каталозі.",
	changes: "Студенти бачать нові значення.",
	merges: "Копії прибраних сторінок лишились в історії.",
	placements: "Семестри з'явились на сторінках дисциплін.",
	removed: "Сайт нічого не видалив.",
	other: "Сайт оновлено.",
} satisfies Record<GroupKey, string>;

export function whoDid(email: string | null, current: string | null): string {
	if (email === null) {
		return "Нічний запуск";
	}
	return email === current ? "Ви" : email;
}

export function doneLines(
	groups: SyncSummaryGroups,
	approvals: readonly SyncApprovalDetail[],
	current: string | null,
	now: Date = new Date(),
): DoneLine[] {
	const open = new Set(openLines(groups).map((line) => line.key));
	const latest = new Map<GroupKey, SyncApprovalDetail>();
	for (const approval of approvals) {
		const key = approvalGroup(approval);
		if (key === null || open.has(key) || approval.outcome !== "applied") {
			continue;
		}
		const known = latest.get(key);
		if (known === undefined || approval.created_at > known.created_at) {
			latest.set(key, approval);
		}
	}
	return GROUP_KEYS.flatMap((key) => {
		const approval = latest.get(key);
		if (approval === undefined) {
			return [];
		}
		const counts = approvalCounts(approval.counts);
		const when = sameDay(approval.created_at, now)
			? `сьогодні о ${formatTime(approval.created_at)}`
			: formatDayTime(approval.created_at);
		return [
			{
				key,
				title: DONE_TITLES[key](counts.applied + counts.rejected),
				detail: `${whoDid(approval.user_email, current)}, ${when}. ${DONE_EFFECTS[key]}`,
				runId: approval.run_id,
			},
		];
	});
}

export const partsTotal = (parts: readonly Part[]): number =>
	parts.reduce((sum, part) => sum + part.count, 0);

export const partsPhrase = (parts: readonly Part[]): string =>
	nonZero(parts)
		.map((part) => countWith(part.count, part.forms))
		.join(", ");

export const pendingTotal = (groups: SyncSummaryGroups): number =>
	openLines(groups).reduce((sum, line) => sum + line.count, 0);
