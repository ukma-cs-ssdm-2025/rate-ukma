const UK_PLURALS = new Intl.PluralRules("uk");
const NUMBER = new Intl.NumberFormat("uk-UA");

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

export const COURSES = {
	one: "дисципліна",
	few: "дисципліни",
	many: "дисциплін",
} satisfies PluralForms;

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
