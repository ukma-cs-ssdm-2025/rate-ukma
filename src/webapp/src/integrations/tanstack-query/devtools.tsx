import { lazy, Suspense } from "react";

const ReactQueryDevtoolsPanel = import.meta.env.PROD
	? () => null
	: lazy(() =>
			import("@tanstack/react-query-devtools").then((m) => ({
				default: m.ReactQueryDevtoolsPanel,
			})),
		);

export default {
	name: "Tanstack Query",
	render: (
		<Suspense>
			<ReactQueryDevtoolsPanel />
		</Suspense>
	),
};
