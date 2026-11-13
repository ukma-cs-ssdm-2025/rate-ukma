import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { LogOut, X } from "lucide-react";

import { Drawer } from "@/components/ui/Drawer";
import {
	MobileNotificationPanel,
	MobileNotificationRow,
} from "@/features/notifications/components/MobileNotificationPanel";
import type { AuthUser } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import type { NavigationItem, ThemeOption } from "./navigationData";
import { themeOptions } from "./navigationData";
import { Logo } from "../Logo";
import { Button } from "../ui/Button";

interface MobileMenuProps {
	isOpen: boolean;
	onClose: () => void;
	navigationItems: NavigationItem[];
	isAuthenticated: boolean;
	user: AuthUser | null;
	logout: () => Promise<void>;
	theme: ThemeOption;
	setTheme: (value: ThemeOption) => void;
}

function NavigationLinks({
	navigationItems,
	onClose,
}: Readonly<Pick<MobileMenuProps, "navigationItems" | "onClose">>) {
	return (
		<nav className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
			{navigationItems.map((item) => (
				<Button
					key={item.href}
					variant="ghost"
					size="lg"
					asChild
					className="w-full justify-start rounded-xl px-0 py-3 text-base font-medium text-popover-foreground transition hover:bg-accent/10 focus-visible:bg-accent/10"
				>
					<Link to={item.href} onClick={onClose}>
						{item.label}
					</Link>
				</Button>
			))}
		</nav>
	);
}

function ThemeSwitcher({
	theme,
	setTheme,
}: Readonly<Pick<MobileMenuProps, "theme" | "setTheme">>) {
	return (
		<div className="mb-3 flex items-center justify-between">
			<span className="text-sm text-muted-foreground">Тема</span>
			<div
				className="flex items-center gap-1"
				role="group"
				aria-label="Обрати тему"
			>
				{themeOptions.map((option) => {
					const Icon = option.icon;
					const isActive = theme === option.value;
					return (
						<Button
							key={option.value}
							variant={isActive ? "secondary" : "ghost"}
							size="icon"
							onClick={() => setTheme(option.value)}
							className="h-9 w-9"
							aria-pressed={isActive}
							title={option.label}
							data-testid={`${testIds.header.themeToggle}-mobile-${option.value}`}
						>
							<Icon className="h-[1.2rem] w-[1.2rem]" />
							<span className="sr-only">{option.label}</span>
						</Button>
					);
				})}
			</div>
		</div>
	);
}

function AccountSummary({
	user,
	onLogout,
}: Readonly<{
	user: AuthUser | null;
	onLogout: () => void;
}>) {
	if (!user) {
		return null;
	}

	return (
		<div className="w-full border-t border-border/50 pt-4">
			<div className="flex items-center gap-3">
				<div className="flex flex-col text-sm">
					<p className="font-semibold leading-none">
						{user.firstName || user.lastName
							? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
							: (user.email ?? "Користувач")}
					</p>
					{user.email && (
						<span className="text-xs text-muted-foreground">{user.email}</span>
					)}
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="ml-auto h-10 w-10 rounded-full p-0 text-destructive"
					onClick={onLogout}
					aria-label="Вийти"
				>
					<LogOut className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

export function MobileMenu({
	isOpen,
	onClose,
	navigationItems,
	isAuthenticated,
	user,
	logout,
	theme,
	setTheme,
}: Readonly<MobileMenuProps>) {
	const [showNotifications, setShowNotifications] = useState(false);

	const handleLogout = () => {
		logout();
		onClose();
	};

	const handleClose = () => {
		setShowNotifications(false);
		onClose();
	};

	return (
		<Drawer
			open={isOpen}
			onOpenChange={(value) => {
				if (!value) {
					handleClose();
				}
			}}
			ariaLabel="Мобільне меню"
			closeButtonLabel="Закрити меню"
			data-testid={testIds.header.mobileMenu}
		>
			{showNotifications ? (
				<MobileNotificationPanel
					onBack={() => setShowNotifications(false)}
					onNavigate={handleClose}
				/>
			) : (
				<>
					<div className="flex items-center justify-between">
						<Logo />
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 rounded-full p-0"
							onClick={handleClose}
							aria-label="Закрити меню"
							data-testid={testIds.header.mobileMenuCloseButton}
						>
							<X className="h-5 w-5" />
						</Button>
					</div>

					<NavigationLinks
						navigationItems={navigationItems}
						onClose={handleClose}
					/>

					<div className="mt-auto">
						<ThemeSwitcher theme={theme} setTheme={setTheme} />
						{isAuthenticated && (
							<>
								<MobileNotificationRow
									onOpen={() => setShowNotifications(true)}
								/>
								<AccountSummary user={user} onLogout={handleLogout} />
							</>
						)}
					</div>
				</>
			)}
		</Drawer>
	);
}
