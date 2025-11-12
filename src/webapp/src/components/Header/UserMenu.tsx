import { LogOut } from "lucide-react";

import type { AuthUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/Avatar";
import { Button } from "../ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/DropdownMenu";

interface UserMenuProps {
	user: AuthUser | null;
	logout: () => Promise<void>;
}

export function UserMenu({ user, logout }: Readonly<UserMenuProps>) {
	if (!user) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-9 w-9 rounded-full">
					<Avatar className="h-9 w-9">
						<AvatarImage
							src="/avatars/01.png"
							alt={user.email ?? "user avatar"}
						/>
						<AvatarFallback>
							{user.firstName?.[0] ?? user.email?.[0] ?? "К"}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" forceMount>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">
							{user.firstName || user.lastName
								? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
								: (user.email ?? "Користувач")}
						</p>
						{user.email && (
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
	);
}
