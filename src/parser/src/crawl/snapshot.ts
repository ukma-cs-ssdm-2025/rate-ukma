import { createHash } from "node:crypto";
import { Schema } from "effect";

/** Parts of a САЗ page that change without the course changing, each with
 *  what it becomes. Without this a page that did not change hashes differently
 *  on every request, after every САЗ deploy, or under another account. */
const NOISE: ReadonlyArray<readonly [RegExp, string]> = [
	// Yii renders a fresh CSRF token into every page.
	[/(<meta name="csrf-token" content=")[^"]*/gu, "$1"],
	[/(<input type="hidden" name="_csrf" value=")[^"]*/gu, "$1"],
	// Asset links carry a version stamp that changes on every САЗ deploy.
	[/((?:href|src)="\/[^"?]*)\?v=\d+"/gu, '$1"'],
	// The navbar holds the signed-in account's name and the list of years.
	[/(<nav id="widget-navbar"[^>]*>).*?(<\/nav>)/su, "$1$2"],
	// The footer holds the current year.
	[/(<footer class="footer">).*?(<\/footer>)/su, "$1$2"],
	// Rows of the signed-in account's own programme are highlighted.
	[/<tr class="success">/gu, "<tr>"],
	// Postgres text cannot hold NUL.
	[/\0/gu, ""],
];

export interface Snapshot {
	readonly content: string;
	readonly hash: string;
}

const snapshotOfContent = (content: string): Snapshot => ({
	content,
	hash: createHash("sha256").update(content).digest("hex"),
});

export const snapshotOf = (body: string): Snapshot =>
	snapshotOfContent(
		NOISE.reduce(
			(page, [pattern, replacement]) => page.replace(pattern, replacement),
			body,
		),
	);

const isJsonObject = Schema.is(Schema.JsonObject);

/** Rebuilds each object with its keys in order, which `JSON.stringify` keeps. */
const sortKeys = (_key: string, json: Schema.Json): Schema.Json =>
	isJsonObject(json)
		? Object.fromEntries(
				Object.keys(json)
					.sort()
					.map((key) => [key, json[key]]),
			)
		: json;

/** Stored with its keys sorted, so a reply that only reorders keys hashes
 *  the same. */
export const snapshotOfJson = (json: Schema.Json): Snapshot =>
	snapshotOfContent(JSON.stringify(json, sortKeys));
