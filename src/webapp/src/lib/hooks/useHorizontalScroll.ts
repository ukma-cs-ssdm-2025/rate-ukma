import { useCallback, useEffect, useState } from "react";

export function useHorizontalScroll(contentLength = 0) {
	const [el, setEl] = useState<HTMLDivElement | null>(null);
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);

	useEffect(() => {
		if (!el) {
			return;
		}

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

	const scrollByPage = useCallback(
		(direction: 1 | -1) => {
			if (!el) {
				return;
			}
			const reduceMotion =
				globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
				false;
			el.scrollBy({
				left: direction * el.clientWidth * 0.9,
				behavior: reduceMotion ? "auto" : "smooth",
			});
		},
		[el],
	);

	const scrollPrev = useCallback(() => scrollByPage(-1), [scrollByPage]);
	const scrollNext = useCallback(() => scrollByPage(1), [scrollByPage]);

	return { ref: setEl, canScrollPrev, canScrollNext, scrollPrev, scrollNext };
}
