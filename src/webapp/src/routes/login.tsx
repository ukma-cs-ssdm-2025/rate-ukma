import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AuthShell } from "@/components/AuthShell";

export const Route = createFileRoute("/login")({
	component: LoginLayoutWrapper,
});

function LoginLayoutWrapper() {
	return (
		<AuthShell
			footer={
				<p>
					Доступ дозволено тільки для користувачів з коорпоративною поштою{" "}
					<span className="font-medium text-foreground">ukma.edu.ua</span>
				</p>
			}
		>
			<Outlet />
		</AuthShell>
	);
}
