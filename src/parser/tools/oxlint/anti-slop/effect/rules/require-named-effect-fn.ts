import { defineRule } from "@oxlint/plugins";

// Local to UKMA Data, not from upstream anti-slop: see UPSTREAM.md.

type Node = { readonly type: string } & Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
	typeof value === "object" && value !== null && "type" in value;

/** `Effect.<name>` as a callee. */
const isEffectMember = (node: unknown, name: string): boolean =>
	isNode(node) &&
	node.type === "MemberExpression" &&
	isNode(node.object) &&
	node.object.type === "Identifier" &&
	node.object["name"] === "Effect" &&
	isNode(node.property) &&
	node.property.type === "Identifier" &&
	node.property["name"] === name;

const isEffectGenCall = (node: unknown): boolean =>
	isNode(node) &&
	node.type === "CallExpression" &&
	isEffectMember(node["callee"], "gen");

/** The expression a function body returns when that is all it does. */
const onlyResult = (body: unknown): unknown => {
	if (!isNode(body)) return undefined;
	if (body.type !== "BlockStatement") return body;

	const statements = body["body"];

	if (!Array.isArray(statements) || statements.length !== 1) return undefined;

	const [statement] = statements;

	return isNode(statement) && statement.type === "ReturnStatement"
		? statement["argument"]
		: undefined;
};

/** A function with a name of its own: a declaration, or one assigned to a
 *  variable, property or class member. A callback passed inline, such as the
 *  one that builds a service inside a Layer, stays allowed. */
const isNamed = (node: Node): boolean => {
	if (node.type === "FunctionDeclaration") return true;

	const parent = node["parent"];

	return (
		isNode(parent) &&
		(parent.type === "VariableDeclarator" ||
			parent.type === "PropertyDefinition" ||
			(parent.type === "Property" && parent["value"] === node) ||
			parent.type === "MethodDefinition")
	);
};

/** `<Module>.<function>`: PascalCase module, camelCase function. */
const SPAN_NAME = /^[A-Z][A-Za-z]+\.[a-z][A-Za-z]+$/;

/** Files where `Effect.fnUntraced` is fine: stores, whose SQL spans cover the
 *  work, and tests with their helpers. */
const UNTRACED_FILE = /(?:Store\.ts|\.test\.ts|(?:^|\/)testing\.ts)$/;

const stringLiteral = (node: unknown): string | undefined =>
	isNode(node) && node.type === "Literal" && typeof node["value"] === "string"
		? node["value"]
		: undefined;

/** The name `const <name> = Effect.fn("…")(…)` binds, when that is the shape. */
const boundName = (fnCall: Node): string | undefined => {
	const outer = fnCall["parent"];

	if (
		!isNode(outer) ||
		outer.type !== "CallExpression" ||
		outer["callee"] !== fnCall
	) {
		return undefined;
	}

	const declarator = outer["parent"];

	if (
		!isNode(declarator) ||
		declarator.type !== "VariableDeclarator" ||
		declarator["init"] !== outer
	) {
		return undefined;
	}

	const id = declarator["id"];

	return isNode(id) && id.type === "Identifier"
		? (id["name"] as string)
		: undefined;
};

export const requireNamedEffectFnRule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				'Name every `Effect.fn` span `<Module>.<function>`, and write a named function that only returns `Effect.gen` as `Effect.fn("Module.name")`.',
		},
		messages: {
			unnamedFn:
				'Pass the span name first: `Effect.fn("name")(function* () { ... })`.',
			spanName:
				'Span name "{{name}}" must be `<Module>.<function>`: a PascalCase module, a dot, then a camelCase function, such as `Crawl.finishRun`.',
			spanMismatch:
				'Span name "{{name}}" must end in the name it is bound to: `{{expected}}`.',
			untraced:
				"`Effect.fnUntraced` is for `*Store.ts` and test files; use `Effect.fn(\"Module.name\")` here, or disable this line with a reason.",
			genWrapper:
				'This function only returns `Effect.gen`; write it as `Effect.fn("name")(function* (...) { ... })` so it gets a named span, or `Effect.fnUntraced` in a store or test helper.',
		},
	},
	createOnce(context) {
		const checkFunction = (node: Node) => {
			if (isNamed(node) && isEffectGenCall(onlyResult(node["body"]))) {
				context.report({ node, messageId: "genWrapper" });
			}
		};

		return {
			CallExpression(node) {
				if (isEffectMember(node.callee, "fnUntraced")) {
					if (!UNTRACED_FILE.test(context.filename)) {
						context.report({ node, messageId: "untraced" });
					}

					return;
				}

				if (isEffectMember(node.callee, "withSpan")) {
					const name = node.arguments
						.slice(0, 2)
						.map(stringLiteral)
						.find((value) => value !== undefined);

					if (name !== undefined && !SPAN_NAME.test(name)) {
						context.report({
							node,
							messageId: "spanName",
							data: { name },
						});
					}

					return;
				}

				if (!isEffectMember(node.callee, "fn")) return;

				const name = stringLiteral(node.arguments[0]);

				if (name === undefined) {
					context.report({ node, messageId: "unnamedFn" });

					return;
				}

				if (!SPAN_NAME.test(name)) {
					context.report({ node, messageId: "spanName", data: { name } });

					return;
				}

				const bound = boundName(node);

				if (bound !== undefined && name.split(".")[1] !== bound) {
					context.report({
						node,
						messageId: "spanMismatch",
						data: { name, expected: bound },
					});
				}
			},
			ArrowFunctionExpression: checkFunction,
			FunctionExpression: checkFunction,
			FunctionDeclaration: checkFunction,
		};
	},
});
