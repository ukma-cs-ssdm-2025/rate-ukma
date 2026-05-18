import { LogOut } from "lucide-react";

import type { AuthUser } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { UserAvatar } from "../UserAvatar";
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

	const displayName =
		[user.firstName, user.lastName].filter(Boolean).join(" ") ||
		user.email ||
		"Користувач";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="relative h-9 w-9 rounded-full"
					data-testid={testIds.header.userMenuTrigger}
				>
					<UserAvatar
						name={displayName}
						avatarUrl={user.avatarUrl}
						className="h-9 w-9"
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-56"
				align="end"
				forceMount
				data-testid={testIds.header.userMenu}
			>
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
					data-testid={testIds.header.logoutButton}
				>
					<LogOut className="mr-2 h-4 w-4" /> Вийти
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
