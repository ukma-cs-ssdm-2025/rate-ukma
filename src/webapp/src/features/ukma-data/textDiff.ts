export type DiffPart = Readonly<{
	text: string;
	kind: "same" | "removed" | "added";
}>;

const tokens = (value: string): string[] => value.match(/\s+|[^\s]+/g) ?? [];

export interface WordDiff {
	before: DiffPart[];
	after: DiffPart[];
}

export function wordDiff(before: string, after: string): WordDiff {
	const a = tokens(before);
	const b = tokens(after);
	const lengths = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0),
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lengths[i][j] =
				a[i] === b[j]
					? lengths[i + 1][j + 1] + 1
					: Math.max(lengths[i + 1][j], lengths[i][j + 1]);
		}
	}
	const left: DiffPart[] = [];
	const right: DiffPart[] = [];
	const push = (parts: DiffPart[], text: string, kind: DiffPart["kind"]) => {
		const last = parts.at(-1);
		if (last?.kind === kind) {
			parts[parts.length - 1] = { text: last.text + text, kind };
		} else {
			parts.push({ text, kind });
		}
	};
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			push(left, a[i], "same");
			push(right, b[j], "same");
			i++;
			j++;
		} else if (
			j < b.length &&
			(i === a.length || lengths[i][j + 1] >= lengths[i + 1][j])
		) {
			push(right, b[j], "added");
			j++;
		} else {
			push(left, a[i], "removed");
			i++;
		}
	}
	return { before: left, after: right };
}
