import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";

export const Route = createFileRoute("/login")({
	component: LoginLayoutWrapper,
});

function LoginLayoutWrapper() {
	return (
		<div className="relative flex min-h-screen flex-col bg-background">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
				<Logo />
				<Outlet />
			</main>
		</div>
	);
}
