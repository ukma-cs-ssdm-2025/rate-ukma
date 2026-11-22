import type {
	SyncFieldRow,
	SyncSelectionFilter,
	SyncSummaryGroups,
} from "@/lib/api/generated";
import type { ConfirmRequest } from "./syncConfirm";
import { countWith, formatCount } from "./syncFormat";
import { fieldLabel, MOVING_FIELDS } from "./syncFields";
import { linkParts, partsTotal, removedParts } from "./syncGroups";
import type { Part } from "./syncGroups";
import { CHANGES, DISCIPLINES, PAIRS, RECORDS, SEMESTERS } from "./syncWords";

export const SELECTION_LIMIT = 200;

export function linksRequest(groups: SyncSummaryGroups): ConfirmRequest {
	const parts = linkParts(groups);
	const total = partsTotal(parts);
	return {
		group: "links",
		title: `Підтвердити ${countWith(total, RECORDS)}?`,
		parts,
		ticks: [
			"На сайті нічого не зміниться: назви, сторінки й оцінки залишаються.",
			"Наступні оновлення з САЗ знатимуть, що це ті самі записи, і не питатимуть знову.",
		],
		confirmLabel: `Підтвердити ${formatCount(total)}`,
		verb: "підтверджено",
		consequence: "На сайті нічого не змінилось.",
		approve: {
			selection: { filter: { group: "link" } },
			group: "link",
			kind: null,
		},
		reject: null,
		field: null,
	};
}

export function removedRequest(groups: SyncSummaryGroups): ConfirmRequest {
	const parts = removedParts(groups);
	const total = partsTotal(parts);
	return {
		group: "removed",
		title: `Позначити ${countWith(total, RECORDS)} переглянутими?`,
		parts,
		ticks: [
			"Сайт нічого не видаляє: сторінки й оцінки залишаються.",
			"Ці записи більше не чекатимуть рішення.",
		],
		confirmLabel: `Позначити ${formatCount(total)}`,
		verb: "позначено",
		consequence: "Сайт нічого не видалив.",
		approve: {
			selection: { filter: { group: "removed" } },
			group: "removed",
			kind: null,
		},
		reject: null,
		field: null,
	};
}

export const NEW_KINDS = {
	courses: "new_course",
	offerings: "new_offering",
} as const;

export function newRequest(
	segment: keyof typeof NEW_KINDS,
	filter: SyncSelectionFilter,
	total: number,
	skipped: readonly number[],
): ConfirmRequest {
	const forms = segment === "offerings" ? SEMESTERS : DISCIPLINES;
	const added = Math.max(0, total - skipped.length);
	const kept = [...skipped];
	return {
		group: "new",
		title: `Додати на сайт ${countWith(added, forms)}?`,
		parts: [
			{
				label:
					segment === "offerings"
						? "Семестри, що з'являться на сайті"
						: "Дисципліни, що з'являться на сайті",
				forms,
				count: added,
			},
			...(kept.length > 0
				? [
						{
							label: "Пропущені: повернуться, якщо САЗ не зміниться",
							forms: RECORDS,
							count: kept.length,
						},
					]
				: []),
		],
		ticks: [
			"Студенти побачать їх у каталозі й зможуть оцінювати.",
			"Разом із ними з'являться кафедри й дисципліни, без яких їх не додати.",
		],
		confirmLabel: `Додати ${formatCount(added)}`,
		verb: "додано",
		consequence: "Студенти бачать їх у каталозі.",
		approve:
			added > 0
				? {
						selection: { filter: { ...filter, exclude_ids: [...kept] } },
						group: "new",
						kind: NEW_KINDS[segment],
					}
				: null,
		reject: kept.length > 0 ? { change_ids: [...kept] } : null,
		field: null,
	};
}

const changeFilter = (field: string, blanks: boolean): SyncSelectionFilter => ({
	group: "change",
	changed_field: field,
	blanks,
});

const WHOLE_SEMESTER =
	"Семестр оновлюється цілком: разом із цим полем зміняться й інші поля, які САЗ змінив у цих семестрах.";

const fieldPart = (label: string, count: number): Part => ({
	label: `Семестри, де змінилось поле «${label.toLowerCase()}»`,
	forms: SEMESTERS,
	count,
});

export function fieldRequest(row: SyncFieldRow): ConfirmRequest {
	const label = fieldLabel(row.field);
	return {
		group: "changes",
		title: `Оновити «${label.toLowerCase()}» у ${countWith(row.count, SEMESTERS)}?`,
		parts: [fieldPart(label, row.count)],
		ticks: [
			"Студенти побачать нові значення на сторінці дисципліни.",
			WHOLE_SEMESTER,
			MOVING_FIELDS.has(row.field)
				? "Семестр переїде в інший рік чи сезон; оцінки залишаються з ним."
				: "Оцінки залишаються там, де були.",
		],
		confirmLabel: `Підтвердити ${formatCount(row.count)}`,
		verb: "оновлено",
		consequence: "Студенти бачать нові значення.",
		approve: {
			selection: { filter: changeFilter(row.field, false) },
			group: "change",
			kind: null,
		},
		reject: null,
		field: { name: row.field, skip: false },
	};
}

export function clearRequest(row: SyncFieldRow): ConfirmRequest {
	const label = fieldLabel(row.field);
	return {
		group: "changes",
		title: `Очистити «${label.toLowerCase()}» у ${countWith(row.count, SEMESTERS)}?`,
		parts: [fieldPart(label, row.count)],
		ticks: [
			"На сайті поле стане порожнім: студенти не бачитимуть значення.",
			WHOLE_SEMESTER,
			"Оцінки залишаються там, де були.",
		],
		confirmLabel: `Очистити ${formatCount(row.count)}`,
		verb: "очищено",
		consequence: "Поле на сайті тепер порожнє.",
		approve: {
			selection: { filter: changeFilter(row.field, true) },
			group: "change",
			kind: null,
		},
		reject: null,
		field: { name: row.field, skip: false },
	};
}

export function keepRequest(row: SyncFieldRow): ConfirmRequest {
	const label = fieldLabel(row.field);
	return {
		group: "changes",
		title: `Залишити «${label.toLowerCase()}» як є у ${countWith(row.count, SEMESTERS)}?`,
		parts: [fieldPart(label, row.count)],
		ticks: [
			"Сайт збереже нинішні значення цих семестрів.",
			"Інші оновлення в цих семестрах теж буде пропущено. Вони повернуться з наступною перевіркою, якщо САЗ і далі відрізнятиметься.",
		],
		confirmLabel: `Залишити ${formatCount(row.count)} як є`,
		verb: "залишено як є",
		consequence: "Сайт зберіг нинішні значення.",
		approve: null,
		reject: { filter: changeFilter(row.field, true) },
		field: { name: row.field, skip: true },
	};
}

export function otherRequest(total: number): ConfirmRequest {
	return {
		group: "other",
		title: `Застосувати ${countWith(total, CHANGES)}?`,
		parts: [{ label: "Інші зміни", forms: CHANGES, count: total }],
		ticks: [
			"Сайт оновиться так, як описано в списку.",
			"Оцінки залишаються там, де були.",
		],
		confirmLabel: `Застосувати ${formatCount(total)}`,
		verb: "застосовано",
		consequence: "Сайт оновлено.",
		approve: {
			selection: { filter: { group: "other" } },
			group: null,
			kind: null,
		},
		reject: null,
		field: null,
	};
}

export function otherSkipRequest(total: number): ConfirmRequest {
	return {
		group: "other",
		title: `Пропустити ${countWith(total, CHANGES)}?`,
		parts: [{ label: "Інші зміни", forms: CHANGES, count: total }],
		ticks: [
			"Сайт нічого не змінить.",
			"Ці зміни повернуться з наступною перевіркою, якщо САЗ і далі відрізнятиметься.",
		],
		confirmLabel: `Пропустити ${formatCount(total)}`,
		verb: "пропущено",
		consequence: "Сайт нічого не змінив.",
		approve: null,
		reject: { filter: { group: "other" } },
		field: null,
	};
}

export function mergeDecisionsRequest(
	merged: readonly number[],
	apart: readonly number[],
): ConfirmRequest {
	const ids = [...merged, ...apart];
	return {
		group: "merges",
		title: `Застосувати рішення щодо ${countWith(ids.length, PAIRS)}?`,
		parts: [
			{ label: "Об'єднати", forms: PAIRS, count: merged.length },
			{ label: "Залишити окремо", forms: PAIRS, count: apart.length },
		],
		ticks: [
			"Семестри й оцінки другої сторінки перейдуть на ту, що залишається.",
			"Сторінка, що зникне, лишиться копією в історії.",
		],
		confirmLabel: `Застосувати ${formatCount(ids.length)}`,
		verb: "застосовано",
		consequence: "Об'єднані сторінки тепер одна сторінка.",
		approve: {
			selection: { change_ids: ids },
			group: "mapping",
			kind: "merge_courses",
		},
		reject: null,
		field: null,
	};
}

export function pairsRequest(merged: number, apart: number): ConfirmRequest {
	return {
		group: "merges",
		title: `Застосувати рішення щодо ${countWith(merged + apart, PAIRS)} без оцінок?`,
		parts: [
			{ label: "Об'єднати", forms: PAIRS, count: merged },
			{ label: "Залишити окремо", forms: PAIRS, count: apart },
		],
		ticks: [
			"Оцінок тут немає: об'єднання лише прибирає зайву сторінку.",
			"Сторінка, що зникне, лишиться копією в історії.",
		],
		confirmLabel: `Застосувати ${formatCount(merged + apart)}`,
		verb: "застосовано",
		consequence: "Зайві сторінки прибрано.",
		approve: {
			selection: {
				filter: { group: "mapping", kind: "merge_courses", rated: false },
			},
			group: "mapping",
			kind: "merge_courses",
		},
		reject: null,
		field: null,
	};
}

export function placeDecisionsRequest(
	placed: readonly number[],
	none: readonly number[],
): ConfirmRequest {
	return {
		group: "placements",
		title: `Застосувати рішення щодо ${countWith(placed.length + none.length, SEMESTERS)}?`,
		parts: [
			{
				label: "Прикріпити до обраної дисципліни",
				forms: SEMESTERS,
				count: placed.length,
			},
			{ label: "Жодна не підходить", forms: SEMESTERS, count: none.length },
		],
		ticks: [
			"Семестри з'являться на сторінках обраних дисциплін.",
			"Ті, для яких жодна не підходить, повернуться, якщо в САЗ щось зміниться.",
		],
		confirmLabel: `Застосувати ${formatCount(placed.length + none.length)}`,
		verb: "застосовано",
		consequence: "Семестри на сторінках обраних дисциплін.",
		approve:
			placed.length > 0
				? {
						selection: { change_ids: [...placed] },
						group: "mapping",
						kind: "place_offering",
					}
				: null,
		reject: none.length > 0 ? { change_ids: [...none] } : null,
		field: null,
	};
}
