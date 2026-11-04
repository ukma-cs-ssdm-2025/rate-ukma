import { assert, describe, it } from "@effect/vitest";
import {
	catalogPath,
	catalogProblem,
	parseAcademicYears,
	parseCatalogPage,
	parseCatalogPath,
	parseFilterOptions,
} from "./catalog.ts";

const card = (code: string) => `<div class="panel panel-default">
	<div class="panel-body">Код: ${code}</div>
	<a class="btn btn-block btn-default" href="/course/${code}">Детальніше</a>
</div>`;

const summary = (first: string, last: string, total: string) =>
	`<div class="summary">Показані <b>${first}-${last}</b> із <b>${total}</b> записів.</div>`;

const catalogPage = (
	codes: ReadonlyArray<string>,
	pager: string,
	shown = "",
) => `<html><body>
${shown}
<aside><a href="/course/900001">Рекомендований курс</a></aside>
<div class="list-view">${codes.map(card).join("\n")}</div>
${pager}
</body></html>`;

const PAGER = `<ul class="pagination">
<li class="prev disabled"><span>&laquo;</span></li>
<li class="active"><a href="/course/catalog?filter%5Bacademic_year%5D%5B0%5D=2031&amp;page=1" data-page="0">1</a></li>
<li class="last"><a href="/course/catalog?filter%5Bacademic_year%5D%5B0%5D=2031&amp;page=12" data-page="11">&raquo;&raquo;</a></li>
</ul>`;

describe("parseCatalogPage", () => {
	it("reads the listed codes, the last page and the summary", () => {
		assert.deepStrictEqual(
			parseCatalogPage(
				catalogPage(
					["100001", "100002", "100001"],
					PAGER,
					summary("1", "2", "23"),
				),
			),
			{
				codes: ["100001", "100002"],
				lastPage: 12,
				shown: { first: 1, last: 2, total: 23 },
			},
		);
	});

	it("reads summary numbers grouped with spaces", () => {
		assert.deepStrictEqual(
			parseCatalogPage(catalogPage([], "", summary("3 381", "3 398", "3 398")))
				.shown,
			{ first: 3381, last: 3398, total: 3398 },
		);
	});

	it("treats a list without a pager as one page", () => {
		assert.strictEqual(
			parseCatalogPage(catalogPage(["100003"], "")).lastPage,
			1,
		);
	});
});

describe("catalogProblem", () => {
	const twoPerPage = (
		codes: ReadonlyArray<string>,
		pager: string,
		shown: string,
	) => parseCatalogPage(catalogPage(codes, pager, shown));

	it("accepts pages whose cards and pager match the summary", () => {
		assert.isUndefined(
			catalogProblem(
				twoPerPage(["100001", "100002"], PAGER, summary("1", "2", "23")),
				1,
			),
		);
		assert.isUndefined(
			catalogProblem(twoPerPage(["100023"], "", summary("23", "23", "23")), 12),
		);
	});

	it("rejects an empty list, which has no summary", () => {
		assert.strictEqual(
			catalogProblem(twoPerPage([], "", ""), 1),
			"catalog page has no summary",
		);
	});

	it("rejects a page with fewer cards than its summary", () => {
		assert.strictEqual(
			catalogProblem(twoPerPage(["100001"], PAGER, summary("1", "2", "23")), 1),
			"catalog page lists 1 courses for 1-2",
		);
	});

	it("rejects a first page whose pager is missing", () => {
		assert.strictEqual(
			catalogProblem(
				twoPerPage(["100001", "100002"], "", summary("1", "2", "23")),
				1,
			),
			"catalog has 1 pages for 23 courses",
		);
	});
});

describe("catalogPath", () => {
	it("asks for the academic year with every level and recommendation", () => {
		const params = new URLSearchParams(
			catalogPath(2031, 3).slice("/course/catalog?".length),
		);

		assert.deepStrictEqual(
			[
				"filter[academic_year][]",
				"filter[level][]",
				"filter[selected][]",
				"page",
			].map((name) => params.getAll(name)),
			[["2031"], ["1", "2"], ["1", "0"], ["3"]],
		);
	});
});

describe("parseCatalogPath", () => {
	it("reads back the year and page of a catalog path", () => {
		assert.deepStrictEqual(parseCatalogPath(catalogPath(2031, 3)), {
			year: 2031,
			page: 3,
		});
	});
});

describe("parseAcademicYears", () => {
	it("reads the years of the academic year filter only", () => {
		const filters = `<form>
<select name="filter[semester][]"><option value="1">1</option></select>
<select id="coursefilter-academic_year" class="form-control" name="filter[academic_year][]" multiple>
<option value="2031">2031–2032</option>
<option value="2032" selected>2032–2033</option>
</select>
</form>`;

		assert.deepStrictEqual(parseAcademicYears(filters), [2031, 2032]);
	});
});

describe("parseFilterOptions", () => {
	it("maps each option text of one filter to its value, skipping commented options", () => {
		const filters = `<form>
<select name="filter[faculty][]" multiple>
<option value="901">Факультет вигаданих наук</option>
<option value="902">Факультет уявних мистецтв</option>
</select>
<select name="filter[spec][]" multiple>
<option selected value="5001">Вигадана інженерія (Бакалавр)</option>
<!-- <option value="5009">Вигадана інженерія (Бакалавр)</option> -->
<option value="5002">Комп&#039;ютерні вигадки (Магістр)</option>
</select>
</form>`;

		assert.deepStrictEqual(
			parseFilterOptions(filters, "spec"),
			new Map([
				["Вигадана інженерія (Бакалавр)", "5001"],
				["Комп'ютерні вигадки (Магістр)", "5002"],
			]),
		);
		assert.strictEqual(parseFilterOptions(filters, "subfaculty").size, 0);
	});
});
