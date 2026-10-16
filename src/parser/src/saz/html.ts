const NAMED_ENTITIES = new Map([
	["amp", "&"],
	["lt", "<"],
	["gt", ">"],
	["quot", '"'],
	["apos", "'"],
	["nbsp", " "],
]);

export const unescapeHtml = (text: string): string =>
	text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, name: string) => {
		if (/^#x/iu.test(name)) {
			return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
		}

		if (name.startsWith("#"))
			return String.fromCodePoint(Number(name.slice(1)));

		return NAMED_ENTITIES.get(name) ?? entity;
	});

/** The text of an HTML fragment: comments and tags dropped, entities decoded,
 *  whitespace collapsed. */
export const textOf = (fragment: string): string =>
	unescapeHtml(fragment.replace(/<!--.*?-->/gsu, "").replace(/<[^>]*>/gu, " "))
		.replace(/\s+/gu, " ")
		.trim();
