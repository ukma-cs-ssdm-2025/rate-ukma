import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { LogOut, X } from "lucide-react";

import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { NavigationItem, ThemeOption } from "./navigationData";
import { themeOptions } from "./navigationData";
import { Logo } from "../Logo";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ToggleGroup, ToggleGroupItem } from "../ui/ToggleGroup";

const TRANSITION_DURATION_MS = 300;

interface MobileMenuProps {
	isOpen: boolean;
	isVisible: boolean;
	onClose: () => void;
	navigationItems: NavigationItem[];
	isAuthenticated: boolean;
	user: AuthUser | null;
	logout: () => Promise<void>;
	theme: ThemeOption;
	setTheme: (value: ThemeOption) => void;
}

function Backdrop({
	isOpen,
	onClose,
}: Readonly<Pick<MobileMenuProps, "isOpen" | "onClose">>) {
	return (
		<button
			type="button"
			className={cn(
				"absolute inset-0 bg-background/80 backdrop-blur transition-opacity",
				isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
			)}
			style={{ transitionDuration: `${TRANSITION_DURATION_MS}ms` }}
			onClick={onClose}
		/>
	);
}

function DrawerFrame({
	isOpen,
	children,
}: Readonly<Pick<MobileMenuProps, "isOpen"> & { children: ReactNode }>) {
	return (
		<aside
			className={cn(
				"relative z-10 ml-auto flex h-full w-full max-w-xs flex-col gap-6 overflow-hidden rounded-l-[32px] bg-popover/95 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur-sm transition-transform",
				isOpen
					? "translate-x-0 opacity-100 pointer-events-auto"
					: "translate-x-full opacity-0 pointer-events-none",
			)}
			style={{ transitionDuration: `${TRANSITION_DURATION_MS}ms` }}
			aria-label="Мобільна навігація"
		>
			{children}
		</aside>
	);
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
					className="w-full justify-start rounded-xl px-0 py-3 text-base font-medium transition hover:bg-accent/10 focus-visible:bg-accent/10"
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
			<ToggleGroup
				type="single"
				value={theme}
				onValueChange={(value) => {
					if (value) {
						setTheme(value as ThemeOption);
					}
				}}
				className="gap-1"
			>
				{themeOptions.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						size="sm"
						aria-label={option.label}
					>
						{option.icon({ className: "h-4 w-4" })}
						<span className="sr-only">{option.label}</span>
					</ToggleGroupItem>
				))}
			</ToggleGroup>
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
				<div className="hidden sm:flex">
					<Avatar className="h-12 w-12">
						<AvatarImage
							src="/avatars/01.png"
							alt={user.email ?? "user avatar"}
						/>
						<AvatarFallback>
							{user.firstName?.[0] ?? user.email?.[0] ?? "К"}
						</AvatarFallback>
					</Avatar>
				</div>
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
	isVisible,
	onClose,
	navigationItems,
	isAuthenticated,
	user,
	logout,
	theme,
	setTheme,
}: Readonly<MobileMenuProps>) {
	const handleLogout = () => {
		logout();
		onClose();
	};

	return (
		<>
			{isVisible && (
				<div
					className="fixed inset-0 z-50 flex md:hidden"
					role="dialog"
					aria-modal="true"
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							onClose();
						}
					}}
				>
					<Backdrop isOpen={isOpen} onClose={onClose} />
					<DrawerFrame isOpen={isOpen}>
						<div className="flex items-center justify-between">
							<Logo size="sm" />
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 rounded-full p-0"
								onClick={onClose}
								aria-label="Закрити меню"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>

						<NavigationLinks
							navigationItems={navigationItems}
							onClose={onClose}
						/>

						<div className="mt-auto">
							<ThemeSwitcher theme={theme} setTheme={setTheme} />
							{isAuthenticated && (
								<AccountSummary user={user} onLogout={handleLogout} />
							)}
						</div>
					</DrawerFrame>
				</div>
			)}
		</>
	);
}
