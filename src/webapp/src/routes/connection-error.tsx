import { createFileRoute } from "@tanstack/react-router";

import { ConnectionErrorPage } from "@/features/connection-error/components/ConnectionErrorPage";
import type { ConnectionErrorSearch } from "@/features/connection-error/components/ConnectionErrorPage";
import { parseBounceCount } from "@/lib/api/networkError";

export const Route = createFileRoute("/connection-error")({
	component: ConnectionErrorRoute,
	validateSearch: (search: Record<string, string>): ConnectionErrorSearch => {
		const validated: ConnectionErrorSearch = {
			bounces: parseBounceCount(search.bounces),
		};
		const reason = search.reason;
		if (reason === "offline" || reason === "server" || reason === "unknown") {
			validated.reason = reason;
			validated.from = search.from;
		}
		return validated;
	},
});

function ConnectionErrorRoute() {
	const search = Route.useSearch();
	return <ConnectionErrorPage {...search} />;
}
