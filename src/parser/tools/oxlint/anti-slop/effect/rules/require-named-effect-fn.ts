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

export const requireNamedEffectFnRule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				'Name every `Effect.fn` span, and write a named function that only returns `Effect.gen` as `Effect.fn("name")`.',
		},
		messages: {
			unnamedFn:
				'Pass the span name first: `Effect.fn("name")(function* () { ... })`.',
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
				if (!isEffectMember(node.callee, "fn")) return;

				const [first] = node.arguments;

				if (
					!isNode(first) ||
					first.type !== "Literal" ||
					typeof first["value"] !== "string"
				) {
					context.report({ node, messageId: "unnamedFn" });
				}
			},
			ArrowFunctionExpression: checkFunction,
			FunctionExpression: checkFunction,
			FunctionDeclaration: checkFunction,
		};
	},
});
