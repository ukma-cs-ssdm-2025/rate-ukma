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
