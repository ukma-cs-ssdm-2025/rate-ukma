import { useEffect, useState } from "react";

function getMatches(query: string) {
	return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(() => getMatches(query));

	useEffect(() => {
		if (typeof window === "undefined") return undefined;

		const mediaQuery = window.matchMedia(query);
		const handleChange = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		setMatches(mediaQuery.matches);
		mediaQuery.addEventListener("change", handleChange);

		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	}, [query]);

	return matches;
}

export { useMediaQuery };
