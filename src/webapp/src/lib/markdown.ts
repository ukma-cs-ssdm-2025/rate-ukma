/**
 * Reduces markdown to plain text for previews (clamped cards, meta tags),
 * where rendering block elements is not possible. Best-effort: it handles
 * the syntax admins realistically use in posts, not the full spec.
 */
export function stripMarkdown(source: string): string {
	return (
		source
			// fenced code blocks -> their content
			.replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
			// images -> alt text, links -> label
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
			// heading / blockquote / list markers at line start
			.replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
			.replace(/^[ \t]*>[ \t]?/gm, "")
			.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, "")
			// horizontal rules
			.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "")
			// emphasis, strikethrough, inline code
			.replace(/(\*\*|__)(.*?)\1/g, "$2")
			.replace(/(\*|_)(.*?)\1/g, "$2")
			.replace(/~~(.*?)~~/g, "$1")
			.replace(/`([^`]*)`/g, "$1")
			// collapse the blank lines left behind
			.replace(/\n{3,}/g, "\n\n")
			.trim()
	);
}

/**
 * Truncates text to a maximum character count while respecting word boundaries.
 * Optionally adds ellipsis to indicate truncation.
 */
export function truncateText(
	text: string,
	maxLength: number = 300,
	options: { addEllipsis?: boolean } = {},
): { truncated: string; isTruncated: boolean } {
	const plainText = stripMarkdown(text);

	if (plainText.length <= maxLength) {
		return { truncated: plainText, isTruncated: false };
	}

	let truncated = plainText.substring(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");

	if (lastSpace > maxLength * 0.7) {
		truncated = truncated.substring(0, lastSpace);
	}

	const result = truncated.trim();
	const ellipsis = options.addEllipsis ? "…" : "";

	return {
		truncated: result + ellipsis,
		isTruncated: true,
	};
}
