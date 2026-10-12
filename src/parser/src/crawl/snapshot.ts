import { createHash } from "node:crypto";

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

export const snapshotOf = (body: string): Snapshot => {
	const content = CSRF_TOKENS.reduce(
		(page, token) => page.replace(token, "$1"),
		body,
	);

	return { content, hash: createHash("sha256").update(content).digest("hex") };
};
