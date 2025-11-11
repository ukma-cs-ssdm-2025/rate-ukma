import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";

interface AuthShellProps {
	children: ReactNode;
	footer?: ReactNode;
}

export function AuthShell({ children, footer }: AuthShellProps) {
	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

			<div className="absolute top-4 left-0 right-0 z-10">
				<div className="relative flex justify-center px-6">
					<Logo />

					<div className="absolute right-6 top-1/2 -translate-y-1/2">
						<ModeToggle />
					</div>
				</div>
			</div>

			<div className="absolute top-[40%] left-0 right-0 flex justify-center px-6 -translate-y-1/2">
				<div className="w-full max-w-full md:max-w-lg bg-background/60 backdrop-blur-xl rounded-none md:rounded-2xl p-6 md:p-8 md:border md:border-border/30 md:shadow-xl shadow-none text-center space-y-8">
					{children}

					{footer ? (
						<div className="pt-2 md:border-t md:border-border/20 text-sm text-muted-foreground">
							{footer}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
