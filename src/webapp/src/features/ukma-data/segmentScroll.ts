export interface Span {
	start: number;
	size: number;
}

export function scrollToShow(item: Span, view: Span): number {
	if (item.start < view.start) {
		return item.start;
	}
	const itemEnd = item.start + item.size;
	const viewEnd = view.start + view.size;
	return itemEnd > viewEnd ? itemEnd - view.size : view.start;
}

const STEPS = new Map([
	["ArrowRight", 1],
	["ArrowDown", 1],
	["ArrowLeft", -1],
	["ArrowUp", -1],
]);

export function arrowTarget(
	key: string,
	index: number,
	length: number,
): number | null {
	if (key === "Home") {
		return 0;
	}
	if (key === "End") {
		return length - 1;
	}
	const step = STEPS.get(key);
	return step === undefined ? null : (index + step + length) % length;
}
