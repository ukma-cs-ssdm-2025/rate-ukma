const DIRECTIVE =
	/^\s*(oxlint-|eslint-|@ts-expect-error|@ts-ignore|prettier-ignore)|^\/\s*<reference /;
const DISABLE_WITH_REASON = /^\s*(oxlint|eslint)-disable\S*\s+\S.*\s--\s+\S/;
const TS_DIRECTIVE_WITH_REASON = /^\s*@ts-(expect-error|ignore)\s+\S/;

type Comment = { value: string; loc: object };
type Context = {
	sourceCode: { getAllComments(): Comment[] };
	report(descriptor: { loc: object; message: string }): void;
};

function missingReason(text: string): boolean {
	if (/^\s*(oxlint|eslint)-disable/.test(text)) {
		return !DISABLE_WITH_REASON.test(text);
	}
	if (/^\s*@ts-(expect-error|ignore)/.test(text)) {
		return !TS_DIRECTIVE_WITH_REASON.test(text);
	}
	return false;
}

export default {
	meta: { name: "rate-ukma" },
	rules: {
		"no-comments": {
			create(context: Context) {
				return {
					Program() {
						for (const comment of context.sourceCode.getAllComments()) {
							if (!DIRECTIVE.test(comment.value)) {
								context.report({
									loc: comment.loc,
									message:
										"Say it in code: a name, a type or a test. A decision belongs in an ADR, a known hack in an issue. Only lint and type directives stay as comments.",
								});
							} else if (missingReason(comment.value)) {
								context.report({
									loc: comment.loc,
									message:
										"Give the directive its reason: `oxlint-disable-next-line <rule> -- <why>` or `@ts-expect-error <why>`.",
								});
							}
						}
					},
				};
			},
		},
	},
};
