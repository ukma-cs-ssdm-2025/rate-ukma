import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";

export const Route = createFileRoute("/login")({
	component: LoginLayoutWrapper,
});

function LoginLayoutWrapper() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
			<div className="absolute top-4 right-4 z-10">
				<ModeToggle />
			</div>

			<div className="absolute top-8 left-0 right-0 flex justify-center">
				<Logo
					size="md"
					asLink={false}
					textClassName="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
				/>
			</div>

			<div className="absolute top-[40%] left-0 right-0 flex justify-center px-6 -translate-y-1/2">
				<div className="w-full max-w-lg bg-background/60 backdrop-blur-xl rounded-2xl p-8 border border-border/30 shadow-xl text-center space-y-8">
					<Outlet />

					<div className="pt-2 border-t border-border/20">
						<p className="text-sm text-muted-foreground">
							Доступ дозволено тільки для користувачів з коорпоративною поштою{" "}
							<span className="font-medium text-foreground">ukma.edu.ua</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
