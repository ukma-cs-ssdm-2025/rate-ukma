import { createHash } from "node:crypto";
import { Schema } from "effect";

/** Yii renders a fresh CSRF token into every page; without it a page that did
 *  not change hashes the same on every request. */
const CSRF_TOKENS = [
	/(<meta name="csrf-token" content=")[^"]*/gu,
	/(<input type="hidden" name="_csrf" value=")[^"]*/gu,
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
		CSRF_TOKENS.reduce((page, token) => page.replace(token, "$1"), body),
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
