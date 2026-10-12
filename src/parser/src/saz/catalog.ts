/** Each card in the result list links its course with this button; the page
 *  also links other courses outside the list, so a bare `/course/` href is not enough. */
const COURSE_BUTTON =
	/<a class="btn btn-block btn-default" href="\/course\/(\d+)">/gu;

const LAST_PAGE = /<li class="last"><a href="[^"]*[?&;]page=(\d+)"/u;

export const catalogPath = (year: number, page: number): string =>
	`/course/catalog?${new URLSearchParams({
		"filter[academic_year][]": String(year),
		page: String(page),
	}).toString()}`;

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
