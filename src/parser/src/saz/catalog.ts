import { textOf } from "./html.ts";

/** Each card in the result list links its course with this button; the page
 *  also links other courses outside the list, so a bare `/course/` href is not enough. */
const COURSE_BUTTON =
	/<a class="btn btn-block btn-default" href="\/course\/(\d+)">/gu;

const LAST_PAGE = /<li class="last"><a href="[^"]*[?&;]page=(\d+)"/u;

const YEAR_FILTER = "filter[academic_year][]";

const YEAR_SELECT =
	/<select[^>]*name="filter\[academic_year\]\[\]"[^>]*>(.*?)<\/select>/su;

const YEAR_OPTION = /<option value="(\d{4})"/gu;

const OPTION = /<option value="([^"]*)"[^>]*>(.*?)<\/option>/gsu;

/** `Показані <b>3 381-3 398</b> із <b>3 398</b> записів.`; the numbers are
 *  grouped with spaces. */
const SUMMARY =
	/<div class="summary">[^<]*<b>([\d\s]+)-([\d\s]+)<\/b>[^<]*<b>([\d\s]+)<\/b>/u;

/** Without these the catalog falls back to `Бакалавр` and `рекомендовано`,
 *  which hides master's and not recommended courses. Any other filter must stay
 *  unset: selecting all of its options drops the courses that have no value for it. */
const WHOLE_YEAR: ReadonlyArray<[string, string]> = [
	["filter[level][]", "1"],
	["filter[level][]", "2"],
	["filter[selected][]", "1"],
	["filter[selected][]", "0"],
];

export const catalogPath = (year: number, page: number): string =>
	`/course/catalog?${new URLSearchParams([
		[YEAR_FILTER, String(year)],
		...WHOLE_YEAR,
		["page", String(page)],
	]).toString()}`;

export interface CatalogPage {
	readonly codes: ReadonlyArray<string>;
	readonly lastPage: number;
	/** The numbers of the summary line, missing on an empty list. */
	readonly shown?: { first: number; last: number; total: number };
}

const numberOf = (grouped: string) => Number(grouped.replace(/\s/gu, ""));

/** `lastPage` is 1 when the pager is missing, as on a one-page list. */
export const parseCatalogPage = (html: string): CatalogPage => {
	const summary = SUMMARY.exec(html);

	return {
		codes: [
			...new Set(
				Array.from(html.matchAll(COURSE_BUTTON), ([, code]) => code ?? ""),
			),
		],
		lastPage: Number(LAST_PAGE.exec(html)?.[1] ?? 1),
		...(summary && {
			shown: {
				first: numberOf(summary[1] ?? ""),
				last: numberOf(summary[2] ?? ""),
				total: numberOf(summary[3] ?? ""),
			},
		}),
	};
};

/** Why page `page` of a catalog does not add up, or `undefined` when its cards
 *  match its summary and page 1's pager covers the total. A run that trusted
 *  a page with renamed cards or a missing pager would end with courses lost. */
export const catalogProblem = (
	catalog: CatalogPage,
	page: number,
): string | undefined => {
	if (catalog.shown === undefined) return "catalog page has no summary";

	const { first, last, total } = catalog.shown;

	if (catalog.codes.length !== last - first + 1) {
		return `catalog page lists ${catalog.codes.length} courses for ${first}-${last}`;
	}

	if (
		page === 1 &&
		catalog.lastPage !== Math.ceil(total / catalog.codes.length)
	) {
		return `catalog has ${catalog.lastPage} pages for ${total} courses`;
	}

	return undefined;
};

export interface CatalogPath {
	readonly year: number;
	readonly page: number;
}

/** The year and page of a path made by `catalogPath`. */
export const parseCatalogPath = (path: string): CatalogPath => {
	const params = new URLSearchParams(path.slice(path.indexOf("?") + 1));

	return {
		year: Number(params.get(YEAR_FILTER)),
		page: Number(params.get("page")),
	};
};

/** The academic years the catalog filter offers, as their first calendar year. */
export const parseAcademicYears = (html: string): ReadonlyArray<number> =>
	Array.from(
		YEAR_SELECT.exec(html)?.[1]?.matchAll(YEAR_OPTION) ?? [],
		([, year]) => Number(year),
	);

/** The options of the catalog filter `filter[<name>][]`, by their text. */
export const parseFilterOptions = (
	html: string,
	name: string,
): ReadonlyMap<string, string> => {
	const select = new RegExp(
		`<select[^>]*name="filter\\[${name}\\]\\[\\]"[^>]*>(.*?)</select>`,
		"su",
	).exec(html)?.[1];

	return new Map(
		Array.from(select?.matchAll(OPTION) ?? [], ([, value = "", text = ""]) => [
			textOf(text),
			value,
		]),
	);
};
