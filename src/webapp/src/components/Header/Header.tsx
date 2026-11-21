import { useEffect, useState } from "react";

import { Menu } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { testIds } from "@/lib/test-ids";
import { HeaderNav } from "./HeaderNav";
import { useHeaderNotifications } from "./HeaderNotificationsProvider";
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
	const notifications = useHeaderNotifications();
	const isAuthenticated = status === "authenticated";

	useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}

		if (!isMobileMenuOpen) {
			return;
		}

		const unlockScroll = lockBodyScroll();

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsMobileMenuOpen(false);
			}
		};

		document.addEventListener("keydown", handleEscape);

		return () => {
			unlockScroll();
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isMobileMenuOpen]);

	const closeMobileMenu = () => setIsMobileMenuOpen(false);
	const openMobileMenu = () => setIsMobileMenuOpen(true);

	return (
		<>
			<header
				className="sticky top-0 z-40 border-b border-border/40 bg-background"
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

					<div className="flex items-center gap-4">
						<div className="hidden md:block">
							<ModeToggle />
						</div>

						{isAuthenticated && notifications && (
							<div className="hidden md:block">
								<notifications.Bell />
							</div>
						)}

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
