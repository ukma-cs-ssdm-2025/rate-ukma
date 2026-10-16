/** Each card in the result list links its course with this button; the page
 *  also links other courses outside the list, so a bare `/course/` href is not enough. */
const COURSE_BUTTON =
	/<a class="btn btn-block btn-default" href="\/course\/(\d+)">/gu;

const LAST_PAGE = /<li class="last"><a href="[^"]*[?&;]page=(\d+)"/u;

const YEAR_FILTER = "filter[academic_year][]";

const YEAR_SELECT =
	/<select[^>]*name="filter\[academic_year\]\[\]"[^>]*>(.*?)<\/select>/su;

const YEAR_OPTION = /<option value="(\d{4})"/gu;

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
}

/** `lastPage` is 1 when the pager is missing, as on a one-page list. */
export const parseCatalogPage = (html: string): CatalogPage => ({
	codes: [
		...new Set(
			Array.from(html.matchAll(COURSE_BUTTON), ([, code]) => code ?? ""),
		),
	],
	lastPage: Number(LAST_PAGE.exec(html)?.[1] ?? 1),
});

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
