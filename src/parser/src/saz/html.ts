const NAMED_ENTITIES = new Map([
	["amp", "&"],
	["lt", "<"],
	["gt", ">"],
	["quot", '"'],
	["apos", "'"],
	["nbsp", " "],
]);

/** An entity that is not a character Postgres text can hold (0, a surrogate,
 *  past the last code point) stays as written; `fromCodePoint` would throw and
 *  `jsonb` would reject the batch. */
const codePointOf = (code: number, entity: string): string =>
	code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff
		? entity
		: String.fromCodePoint(code);

export const unescapeHtml = (text: string): string =>
	text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, name: string) => {
		if (/^#x/iu.test(name)) {
			return codePointOf(Number.parseInt(name.slice(2), 16), entity);
		}

		if (name.startsWith("#")) return codePointOf(Number(name.slice(1)), entity);

		return NAMED_ENTITIES.get(name) ?? entity;
	});

/** САЗ comments out markup it no longer shows, labels included. */
export const withoutComments = (fragment: string): string =>
	fragment.replace(/<!--.*?-->/gsu, "");

/** The text of an HTML fragment: comments and tags dropped, entities decoded,
 *  whitespace collapsed. */
export const textOf = (fragment: string): string =>
	unescapeHtml(withoutComments(fragment).replace(/<[^>]*>/gu, " "))
		.replace(/\s+/gu, " ")
		.trim();
