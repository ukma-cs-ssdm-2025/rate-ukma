import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

export const queryKeys = {
	config: ["config"] as const,
	semesters: ["semesters"] as const,
	semester: (name: string | undefined) =>
		["semester", name ?? "_current"] as const,
	/** The signed-in student's slice of a semester. */
	timetable: (name: string | undefined) =>
		["timetable", name ?? "_current"] as const,
	/** The prefix, for invalidating every semester's copy at once. */
	me: ["me"] as const,
	meFor: (semester: string | undefined) =>
		["me", semester ?? "_current"] as const,
	changes: (semester: string | undefined) =>
		["changes", semester ?? "_current"] as const,
	versions: (name: string) => ["versions", name] as const,
	versionRows: (id: number) => ["version-rows", id] as const,
};
