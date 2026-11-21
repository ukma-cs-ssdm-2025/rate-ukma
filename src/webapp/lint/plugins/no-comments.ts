const DISABLE = /^\s*(oxlint|eslint)-disable-next-line\s+\S.*\s--\s+\S/;
const TS_DIRECTIVE = /^\s*@ts-(expect-error|ignore)\s+\S/;
const REFERENCE = /^\/\s*<reference /;
const TEST_MARKER =
	/^\s*(Arrange|Act|Assert)(\s*&\s*(Arrange|Act|Assert))*\s*$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$|(^|\/)tests\//;

const NOT_ALLOWED =
	"Say it in code: a name, a type or a test. A decision belongs in an ADR, a known hack in an issue. Only `oxlint-disable-next-line <rule> -- <why>`, `@ts-expect-error <why>`, `/// <reference>` and, in tests, `// Arrange`, `// Act`, `// Assert` (or `// Arrange & Act`) stay.";

export function commentProblem(
	text: string,
	filename: string,
): string | undefined {
	if (DISABLE.test(text) || TS_DIRECTIVE.test(text) || REFERENCE.test(text)) {
		return undefined;
	}
	if (TEST_FILE.test(filename) && TEST_MARKER.test(text)) {
		return undefined;
	}
	return NOT_ALLOWED;
}

type Comment = { value: string; loc: object };
type Context = {
	filename: string;
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
							const message = commentProblem(comment.value, context.filename);
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
