import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
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
	return (
		<header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto px-6 flex h-16 items-center">
				<div className="flex items-center justify-between w-full max-w-6xl mx-auto">
					<Link to="/" className="flex items-center space-x-3">
						<div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
							<Star
								className="h-5 w-5 text-primary-foreground"
								fill="currentColor"
								aria-label="Зірочка рейтингу"
							/>
						</div>
						<span className="font-bold text-lg tracking-tight">
							Rate <span className="text-primary">UKMA</span>
						</span>
					</Link>

					<div className="flex items-center justify-center flex-1">
						<NavigationMenu className="hidden md:flex">
							<NavigationMenuList className="gap-2">
								<NavigationMenuItem>
									<Link to="/">
										<NavigationMenuLink className="group inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50">
											Курси
										</NavigationMenuLink>
									</Link>
								</NavigationMenuItem>

								<NavigationMenuItem>
									<Link to="/my-ratings">
										<NavigationMenuLink className="group inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50">
											Мої оцінки
										</NavigationMenuLink>
									</Link>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</div>

					<div className="flex items-center space-x-3">
						<ModeToggle />

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="relative h-9 w-9 rounded-full"
								>
									<Avatar className="h-9 w-9">
										<AvatarImage src="/avatars/01.png" alt="@user" />
										<AvatarFallback>К</AvatarFallback>
									</Avatar>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-56" align="end" forceMount>
								<DropdownMenuLabel className="font-normal">
									<div className="flex flex-col space-y-1">
										<p className="text-sm font-medium leading-none">
											Користувач
										</p>
										<p className="text-xs leading-none text-muted-foreground">
											user@ukma.edu.ua
										</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Профіль</DropdownMenuItem>
								<DropdownMenuItem>Налаштування</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Вийти</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</header>
	);
}
