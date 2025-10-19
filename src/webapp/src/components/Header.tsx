import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { ModeToggle } from "./ModeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/Avatar";
import { Button } from "./ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
} from "./ui/NavigationMenu";

export default function Header() {
	const { status, user, logout } = useAuth();
	const isAuthenticated = status === "authenticated";
	return (
		<header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto px-6 flex h-16 items-center">
				<div className="flex items-center justify-between w-full max-w-6xl mx-auto">
					<Logo size="md" />

					<div className="flex items-center justify-center flex-1">
						<NavigationMenu className="hidden md:flex">
							<NavigationMenuList className="gap-2">
								<NavigationMenuItem>
									<NavigationMenuLink
										asChild
										className="group inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
									>
										<Link to="/">Курси</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>

								<NavigationMenuItem>
									<NavigationMenuLink
										asChild
										className="group inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
									>
										<Link to="/my-ratings">Мої оцінки</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</div>

					<div className="flex items-center space-x-3">
						<ModeToggle />

						{isAuthenticated && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										className="relative h-9 w-9 rounded-full"
									>
										{/* TODO: Replace with dynamic user avatar once backend provides avatarUrl */}
										<Avatar className="h-9 w-9">
											<AvatarImage
												src="/avatars/01.png"
												alt={user?.email ?? "user avatar"}
											/>
											<AvatarFallback>
												{user?.firstName?.[0] ?? user?.email?.[0] ?? "К"}
											</AvatarFallback>
										</Avatar>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="w-56" align="end" forceMount>
									<DropdownMenuLabel className="font-normal">
										<div className="flex flex-col space-y-1">
											<p className="text-sm font-medium leading-none">
												{user?.firstName || user?.lastName
													? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
													: (user?.email ?? "Користувач")}
											</p>
											{user?.email && (
												<p className="text-xs leading-none text-muted-foreground">
													{user.email}
												</p>
											)}
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="cursor-pointer text-destructive"
										onSelect={(event) => {
											event.preventDefault();
											logout();
										}}
									>
										<LogOut className="mr-2 h-4 w-4" /> Вийти
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
