const NAMED_ENTITIES = new Map([
	["amp", "&"],
	["lt", "<"],
	["gt", ">"],
	["quot", '"'],
	["apos", "'"],
	["nbsp", " "],
]);

/** An entity past the last code point stays as written; `fromCodePoint`
 *  would throw and stop the whole parse step. */
const codePointOf = (code: number, entity: string): string =>
	code <= 0x10ffff ? String.fromCodePoint(code) : entity;

export const unescapeHtml = (text: string): string =>
	text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, name: string) => {
		if (/^#x/iu.test(name)) {
			return codePointOf(Number.parseInt(name.slice(2), 16), entity);
		}

		if (name.startsWith("#")) return codePointOf(Number(name.slice(1)), entity);

		return NAMED_ENTITIES.get(name) ?? entity;
	});

/** The text of an HTML fragment: comments and tags dropped, entities decoded,
 *  whitespace collapsed. */
export const textOf = (fragment: string): string =>
	unescapeHtml(fragment.replace(/<!--.*?-->/gsu, "").replace(/<[^>]*>/gu, " "))
		.replace(/\s+/gu, " ")
		.trim();
