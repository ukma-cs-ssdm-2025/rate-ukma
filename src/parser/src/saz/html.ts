import { decodeHTMLStrict } from "entities";

/** САЗ comments out markup it no longer shows, labels included. */
export const withoutComments = (fragment: string): string =>
	fragment.replace(/<!--.*?-->/gsu, "");

/** The text of an HTML fragment: comments and tags dropped, entities decoded,
 *  whitespace collapsed. */
export const textOf = (fragment: string): string =>
	decodeHTMLStrict(withoutComments(fragment).replace(/<[^>]*>/gu, " "))
		.replace(/\s+/gu, " ")
		.trim();
