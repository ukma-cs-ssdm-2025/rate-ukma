const DIRECTIVE =
	/^\s*(oxlint-|eslint-|@ts-expect-error|@ts-ignore|prettier-ignore)|^\/\s*<reference /;

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
							if (DIRECTIVE.test(comment.value)) {
								continue;
							}
							context.report({
								loc: comment.loc,
								message:
									"Say it in code: a name, a type or a test. A decision belongs in an ADR, a known hack in an issue. Only lint and type directives stay as comments.",
							});
						}
					},
				};
			},
		},
	},
};
