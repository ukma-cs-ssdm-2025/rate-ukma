import { useCallback, useEffect, useRef, useState } from "react";

/** Edge state and viewport paging for a horizontal scroll container. */
export function useHorizontalScroll(contentLength = 0) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);

	useEffect(() => {
		const el = ref.current;
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
	}, [contentLength]);

	const scrollByPage = useCallback((direction: 1 | -1) => {
		const el = ref.current;
		if (!el) return;

		const reduceMotion =
			globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
			false;
		el.scrollBy({
			left: direction * el.clientWidth * 0.9,
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}, []);

	const scrollPrev = useCallback(() => scrollByPage(-1), [scrollByPage]);
	const scrollNext = useCallback(() => scrollByPage(1), [scrollByPage]);

	return { ref, canScrollPrev, canScrollNext, scrollPrev, scrollNext };
}
