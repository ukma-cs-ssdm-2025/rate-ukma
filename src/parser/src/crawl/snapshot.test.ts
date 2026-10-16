import { assert, describe, it } from "@effect/vitest";
import { snapshotOf, snapshotOfJson } from "./snapshot.ts";

const coursePage = (token: string, title: string) => `<html><head>
<meta name="csrf-token" content="${token}">
</head><body>
<form method="post"><input type="hidden" name="_csrf" value="${token}"></form>
<h1>${title}</h1>
</body></html>`;

describe("snapshotOf", () => {
	it("hashes two fetches of an unchanged page the same", () => {
		assert.strictEqual(
			snapshotOf(coursePage("token-a", "Вступ до тестування")).hash,
			snapshotOf(coursePage("token-b", "Вступ до тестування")).hash,
		);
	});

	it("hashes a changed page differently", () => {
		assert.notStrictEqual(
			snapshotOf(coursePage("token-a", "Вступ до тестування")).hash,
			snapshotOf(coursePage("token-a", "Тестування, частина 2")).hash,
		);
	});

	it("stores the page without its CSRF tokens", () => {
		const { content } = snapshotOf(
			coursePage("token-a", "Вступ до тестування"),
		);

		assert.notInclude(content, "token-a");
		assert.include(content, '<meta name="csrf-token" content="">');
	});
});

describe("snapshotOfJson", () => {
	it("hashes the same data with its keys in another order the same", () => {
		assert.strictEqual(
			snapshotOfJson({ items: [{ id: 1, titleUa: "Приклад" }], total: 1 }).hash,
			snapshotOfJson({ total: 1, items: [{ titleUa: "Приклад", id: 1 }] }).hash,
		);
	});

	it("hashes items in another order differently", () => {
		assert.notStrictEqual(
			snapshotOfJson({ items: [{ id: 1 }, { id: 2 }] }).hash,
			snapshotOfJson({ items: [{ id: 2 }, { id: 1 }] }).hash,
		);
	});
});
