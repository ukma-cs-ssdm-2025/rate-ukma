const DISABLE = /^\s*(oxlint|eslint)-disable-next-line\s+\S.*\s--\s+\S/;
const TS_DIRECTIVE = /^\s*@ts-(expect-error|ignore)\s+\S/;
const REFERENCE = /^\/\s*<reference /;

const NOT_ALLOWED =
	"Say it in code: a name, a type or a test. A decision belongs in an ADR, a known hack in an issue. Only `oxlint-disable-next-line <rule> -- <why>`, `@ts-expect-error <why>` and `/// <reference>` stay.";

export function commentProblem(text: string): string | undefined {
	if (DISABLE.test(text) || TS_DIRECTIVE.test(text) || REFERENCE.test(text)) {
		return undefined;
	}
	return NOT_ALLOWED;
}

type Comment = { value: string; loc: object };
type Context = {
	sourceCode: { getAllComments(): Comment[] };
	report(descriptor: { loc: object; message: string }): void;
};

export default {
	meta: { name: "rate-ukma" },
	rules: {
		"no-comments": {
			create(context: Context) {
				return {
					Program() {
						for (const comment of context.sourceCode.getAllComments()) {
							const message = commentProblem(comment.value);
							if (message !== undefined) {
								context.report({ loc: comment.loc, message });
							}
						}
					},
				};
			},
		},
	},
};
