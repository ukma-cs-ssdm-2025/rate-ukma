import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Option, Redacted } from "effect";

/** `ukd_<key id>.<secret>`: the id finds the row, the secret proves the
 *  holder. Only the secret's hash is stored. */
const TOKEN = /^ukd_(key_[0-9A-HJKMNP-TV-Z]{26})\.([A-Za-z0-9_-]{43})$/;

export interface ParsedToken {
	readonly keyId: string;
	readonly secret: string;
}

/** 32 random bytes in base64url, 43 characters. */
export const newSecret = (): string => randomBytes(32).toString("base64url");

export const formatToken = (keyId: string, secret: string) =>
	Redacted.make(`ukd_${keyId}.${secret}`);

export const parseToken = (
	token: Redacted.Redacted<string>,
): Option.Option<ParsedToken> => {
	const match = TOKEN.exec(Redacted.value(token));

	return match?.[1] === undefined || match[2] === undefined
		? Option.none()
		: Option.some({ keyId: match[1], secret: match[2] });
};

/** SHA-256 in hex. A fast hash is enough: the secret is 256 random bits, not
 *  a password a slow hash would protect. */
export const hashSecret = (secret: string): string =>
	createHash("sha256").update(secret).digest("hex");

export const secretMatches = (secret: string, storedHash: string): boolean => {
	const stored = Buffer.from(storedHash, "hex");
	const given = Buffer.from(hashSecret(secret), "hex");

	return stored.length === given.length && timingSafeEqual(stored, given);
};
