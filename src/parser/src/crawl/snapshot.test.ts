import { assert, describe, it } from "@effect/vitest";
import { snapshotOf } from "./snapshot.ts";

interface Variant {
	readonly token?: string;
	readonly stamp?: string;
	readonly account?: string;
	readonly ownProgramme?: boolean;
	readonly year?: string;
	readonly title?: string;
}

const CARD = (
	title: string,
	ownProgramme: boolean,
) => `<div class="page-header">
<h1>${title} <small>100001</small></h1>
</div>
<div id="w0"><table class="table">
<tr><th>Код</th><td>100001</td></tr>
<tr${ownProgramme ? ' class="success"' : ""}><td>Програмна інженерія</td><td><span class="label label-success">Обов'язкова</span></td></tr>
</table></div>`;

const coursePage = ({
	token = "token-a",
	stamp = "1791652024",
	account = "Тестовенко Ірина Петрівна",
	ownProgramme = false,
	year = "2031",
	title = "Вступ до тестування",
}: Variant = {}) => `<html><head>
<meta name="csrf-token" content="${token}">
<link href="/assets/92e1c474/css/app.css?v=${stamp}" rel="stylesheet">
</head><body>
<nav id="widget-navbar" class="navbar"><ul>
<li><a href="/curriculum/${year}">${year}</a></li>
<li><a href="/profile"><span class="glyphicon glyphicon-user"></span> ${account}</a></li>
</ul></nav>
<form method="post"><input type="hidden" name="_csrf" value="${token}"></form>
${CARD(title, ownProgramme)}
<footer class="footer"><p>© НаУКМА ${year}</p></footer>
<script src="/assets/92e1c474/js/app.js?v=${stamp}"></script>
</body></html>`;

describe("snapshotOf", () => {
	it("hashes two fetches of an unchanged page the same", () => {
		assert.strictEqual(
			snapshotOf(coursePage({ token: "token-a" })).hash,
			snapshotOf(coursePage({ token: "token-b" })).hash,
		);
	});

	it("hashes pages that differ only in the asset stamp the same", () => {
		assert.strictEqual(
			snapshotOf(coursePage({ stamp: "1791652024" })).hash,
			snapshotOf(coursePage({ stamp: "1792153689" })).hash,
		);
	});

	it("hashes the page the same under another account or year", () => {
		assert.strictEqual(
			snapshotOf(coursePage()).hash,
			snapshotOf(
				coursePage({
					account: "Зразкова Олена Іванівна",
					ownProgramme: true,
					year: "2032",
				}),
			).hash,
		);
	});

	it("hashes a changed page differently", () => {
		assert.notStrictEqual(
			snapshotOf(coursePage()).hash,
			snapshotOf(coursePage({ title: "Тестування, частина 2" })).hash,
		);
	});

	it("stores the card as read, without the account, tokens or stamps", () => {
		const { content } = snapshotOf(coursePage());

		assert.include(content, CARD("Вступ до тестування", false));
		assert.notInclude(content, "Тестовенко");
		assert.notInclude(content, "token-a");
		assert.notInclude(content, "?v=");
		assert.include(content, '<meta name="csrf-token" content="">');
		assert.include(content, '<script src="/assets/92e1c474/js/app.js">');
	});

	it("drops NUL bytes, which Postgres text cannot hold", () => {
		assert.strictEqual(
			snapshotOf('[{"name":"a\0b"}]').content,
			'[{"name":"ab"}]',
		);
	});
});
