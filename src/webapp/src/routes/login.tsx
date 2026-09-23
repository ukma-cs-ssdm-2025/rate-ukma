import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";

export const Route = createFileRoute("/login")({
	component: LoginLayoutWrapper,
});

function LoginLayoutWrapper() {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4">
				<span aria-hidden="true" />
				<Logo />
				<span className="flex justify-end">
					<ModeToggle />
				</span>
			</div>
			<main className="flex flex-1 items-center justify-center px-6 pb-16">
				<div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 text-center text-card-foreground shadow-sm md:p-8">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
