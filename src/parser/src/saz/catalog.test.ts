import { assert, describe, it } from "@effect/vitest";
import { catalogPath, parseCatalogPage } from "./catalog.ts";

const card = (code: string) => `<div class="panel panel-default">
	<div class="panel-body">Код: ${code}</div>
	<a class="btn btn-block btn-default" href="/course/${code}">Детальніше</a>
</div>`;

const catalogPage = (
	codes: ReadonlyArray<string>,
	pager: string,
) => `<html><body>
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
	it("reads the listed codes and the last page", () => {
		assert.deepStrictEqual(
			parseCatalogPage(catalogPage(["100001", "100002", "100001"], PAGER)),
			{ codes: ["100001", "100002"], lastPage: 12 },
		);
	});

	it("treats a list without a pager as one page", () => {
		assert.deepStrictEqual(parseCatalogPage(catalogPage(["100003"], "")), {
			codes: ["100003"],
			lastPage: 1,
		});
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
