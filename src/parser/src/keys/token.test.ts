import { assert, describe, it } from "@effect/vitest";
import { Option, Redacted } from "effect";
import { missingScopes } from "./scopes.ts";
import {
	formatToken,
	hashSecret,
	newSecret,
	parseToken,
	secretMatches,
} from "./token.ts";

const KEY_ID = "key_01JABCDEFGHJKMNPQRSTVWXYZ0";

describe("token", () => {
	it("parses the id and secret it formatted", () => {
		const secret = newSecret();

		assert.deepStrictEqual(
			parseToken(formatToken(KEY_ID, secret)),
			Option.some({ keyId: KEY_ID, secret }),
		);
	});

	it("rejects a token of another shape", () => {
		const secret = newSecret();

		for (const token of [
			"",
			`${KEY_ID}.${secret}`,
			`ukd_${KEY_ID}`,
			`ukd_${KEY_ID}.${secret}x`,
			`ukd_key_short.${secret}`,
		]) {
			assert.isTrue(Option.isNone(parseToken(Redacted.make(token))), token);
		}
	});

	it("keeps the token out of its printed form", () => {
		const token = formatToken(KEY_ID, newSecret());

		assert.notInclude(String(token), "ukd_");
		assert.notInclude(JSON.stringify({ token }), "ukd_");
	});

	it("matches only the secret that was hashed", () => {
		const secret = newSecret();
		const stored = hashSecret(secret);

		assert.notStrictEqual(stored, secret);
		assert.isTrue(secretMatches(secret, stored));
		assert.isFalse(secretMatches(newSecret(), stored));
		assert.isFalse(secretMatches(secret, ""));
	});
});

describe("missingScopes", () => {
	it("gives no student data with catalog scopes", () => {
		assert.deepStrictEqual(
			missingScopes(["catalog:read", "runs:read"], ["students:read"]),
			["students:read"],
		);
		assert.deepStrictEqual(
			missingScopes(["catalog:read"], ["catalog:read"]),
			[],
		);
		assert.deepStrictEqual(missingScopes([], []), []);
	});
});
