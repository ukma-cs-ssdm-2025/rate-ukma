const UK_PLURALS = new Intl.PluralRules("uk");
const NUMBER = new Intl.NumberFormat("uk-UA");
const TIME = new Intl.DateTimeFormat("uk-UA", {
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "Europe/Kyiv",
});
const DAY = new Intl.DateTimeFormat("uk-UA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "Europe/Kyiv",
});

export interface PluralForms {
	one: string;
	few: string;
	many: string;
}

export function pluralForm(count: number, forms: PluralForms): string {
	const rule = UK_PLURALS.select(count);
	if (rule === "one") {
		return forms.one;
	}
	if (rule === "few") {
		return forms.few;
	}
	return forms.many;
}

export const formatCount = (count: number): string => NUMBER.format(count);

export const countWith = (count: number, forms: PluralForms): string =>
	`${formatCount(count)} ${pluralForm(count, forms)}`;

export const RATINGS = {
	one: "оцінка",
	few: "оцінки",
	many: "оцінок",
} satisfies PluralForms;

export const RATINGS_ACCUSATIVE = {
	one: "оцінку",
	few: "оцінки",
	many: "оцінок",
} satisfies PluralForms;

export const PLANS = {
	one: "план",
	few: "плани",
	many: "планів",
} satisfies PluralForms;

export const CHANGES = {
	one: "зміна",
	few: "зміни",
	many: "змін",
} satisfies PluralForms;

export const CHANGES_ACCUSATIVE = {
	one: "зміну",
	few: "зміни",
	many: "змін",
} satisfies PluralForms;

export const LINKS = {
	one: "звʼязок",
	few: "звʼязки",
	many: "звʼязків",
} satisfies PluralForms;

export const RECORDS = {
	one: "запис",
	few: "записи",
	many: "записів",
} satisfies PluralForms;

export const COURSES = {
	one: "курс",
	few: "курси",
	many: "курсів",
} satisfies PluralForms;

export const formatTime = (iso: string): string => TIME.format(new Date(iso));

export const formatDayTime = (iso: string): string =>
	`${DAY.format(new Date(iso))}, ${formatTime(iso)}`;

export function formatHoursAgo(hours: number): string {
	if (hours < 1) {
		return "менше години тому";
	}
	if (hours < 48) {
		return `${hours} год тому`;
	}
	const days = Math.floor(hours / 24);
	return `${days} ${pluralForm(days, { one: "день", few: "дні", many: "днів" })} тому`;
}

export const hoursSince = (iso: string, now: number = Date.now()): number =>
	Math.max(0, Math.floor((now - Date.parse(iso)) / 3_600_000));

const DAY_MONTH = new Intl.DateTimeFormat("uk-UA", {
	day: "numeric",
	month: "long",
	timeZone: "Europe/Kyiv",
});

export const formatDayMonthTime = (iso: string): string =>
	`${DAY_MONTH.format(new Date(iso))}, ${formatTime(iso)}`;

export function freshnessText(
	updated: string | null | undefined,
	checked: string | null | undefined,
): string | null {
	const parts = [
		updated ? `Дані САЗ станом на ${formatDayMonthTime(updated)}` : null,
		checked ? `перевірено ${formatDayMonthTime(checked)}` : null,
	].filter((part) => part !== null);
	return parts.length > 0 ? parts.join(" · ") : null;
}

const FULL_DATE = new Intl.DateTimeFormat("uk-UA", {
	day: "numeric",
	month: "long",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "Europe/Kyiv",
});

export const formatFullDate = (iso: string): string =>
	FULL_DATE.format(new Date(iso));

function spanWords(minutes: number): string {
	if (minutes < 60) {
		return `${minutes} хв`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 48) {
		return `${hours} год`;
	}
	const days = Math.floor(hours / 24);
	return `${days} ${pluralForm(days, { one: "день", few: "дні", many: "днів" })}`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
	const diff = now - Date.parse(iso);
	const minutes = Math.floor(Math.abs(diff) / 60_000);
	if (minutes < 1) {
		return "щойно";
	}
	return diff < 0
		? `через ${spanWords(minutes)}`
		: `${spanWords(minutes)} тому`;
}
