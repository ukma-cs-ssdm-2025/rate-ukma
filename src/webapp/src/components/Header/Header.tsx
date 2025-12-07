import { useEffect, useState } from "react";

import { Menu } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { HeaderNav } from "./HeaderNav";
import { MobileMenu } from "./MobileMenu";
import { navigationItems } from "./navigationData";
import { UserMenu } from "./UserMenu";
import { Logo } from "../Logo";
import { ModeToggle } from "../ModeToggle";
import { Button } from "../ui/Button";

export default function Header() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const { status, user, logout } = useAuth();
	const { theme, setTheme } = useTheme();
	const isAuthenticated = status === "authenticated";

	useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsMobileMenuOpen(false);
			}
		};

		if (isMobileMenuOpen) {
			document.body.style.overflow = "hidden";
			document.addEventListener("keydown", handleEscape);
		} else {
			document.body.style.overflow = "";
		}

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isMobileMenuOpen]);

	const closeMobileMenu = () => setIsMobileMenuOpen(false);
	const openMobileMenu = () => setIsMobileMenuOpen(true);

	return (
		<>
			<header
				className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
				data-testid={testIds.header.root}
			>
				<div className="container mx-auto px-6 max-w-7xl flex h-16 items-center justify-between">
					<Logo />

					<div className="flex items-center justify-center flex-1">
						<HeaderNav
							items={navigationItems}
							className="hidden md:flex"
							data-testid={testIds.header.nav}
						/>
					</div>

					<div className="flex items-center md:space-x-3">
						<div className="hidden md:block">
							<ModeToggle />
						</div>

						<div className="md:hidden">
							<Button
								variant="ghost"
								className="h-9 w-9 rounded-full p-0"
								aria-label="Відкрити меню"
								onClick={openMobileMenu}
								data-testid={testIds.header.mobileMenuButton}
							>
								<Menu className="h-5 w-5" />
							</Button>
						</div>

						{isAuthenticated && (
							<div className="hidden md:block">
								<UserMenu user={user} logout={logout} />
							</div>
						)}
					</div>
				</div>
			</header>

			<MobileMenu
				isOpen={isMobileMenuOpen}
				onClose={closeMobileMenu}
				navigationItems={navigationItems}
				isAuthenticated={isAuthenticated}
				user={user}
				logout={logout}
				theme={theme}
				setTheme={setTheme}
			/>
		</>
	);
}
