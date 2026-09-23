import { useCallback, useEffect, useRef, useState } from "react";

/** Edge state and viewport paging for a horizontal scroll container. */
export function useHorizontalScroll(contentLength = 0) {
	// A callback ref tracks the element itself: the scroller can mount
	// after the first render (e.g. behind a feature flag) without
	// contentLength changing, and the setup effect must still run.
	const elRef = useRef<HTMLDivElement | null>(null);
	const [el, setEl] = useState<HTMLDivElement | null>(null);
	const ref = useCallback((node: HTMLDivElement | null) => {
		elRef.current = node;
		setEl(node);
	}, []);
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);

	useEffect(() => {
		if (!el) return;

		const update = () => {
			setCanScrollPrev(el.scrollLeft > 0);
			setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
		};

		update();
		el.addEventListener("scroll", update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(el);

		return () => {
			el.removeEventListener("scroll", update);
			observer.disconnect();
		};
	}, [el, contentLength]);

	const scrollByPage = useCallback((direction: 1 | -1) => {
		const current = elRef.current;
		if (!current) return;

		const reduceMotion =
			globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
			false;
		current.scrollBy({
			left: direction * current.clientWidth * 0.9,
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}, []);

	const scrollPrev = useCallback(() => scrollByPage(-1), [scrollByPage]);
	const scrollNext = useCallback(() => scrollByPage(1), [scrollByPage]);

	return { ref, canScrollPrev, canScrollNext, scrollPrev, scrollNext };
}
