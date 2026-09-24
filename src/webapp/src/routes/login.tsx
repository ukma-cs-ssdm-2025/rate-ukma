import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AuthShell } from "@/components/AuthShell";

export const Route = createFileRoute("/login")({
	component: LoginLayoutWrapper,
});

function LoginLayoutWrapper() {
	return (
		<AuthShell>
			<Outlet />
		</AuthShell>
	);
}
