import type { ComponentProps } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
	"bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
	"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	"bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	"bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
	"bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
	"bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
	"bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
	"bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
] as const;

function hashName(name: string): number {
	let hash = 0;
	for (const char of name) {
		hash = (hash << 5) - hash + (char.codePointAt(0) ?? 0);
		hash = Math.trunc(hash);
	}
	return Math.abs(hash);
}

function getAvatarColor(name: string): string {
	return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

function getInitials(name: string, isAnonymous: boolean): string {
	if (isAnonymous) return "?";
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

interface UserAvatarProps extends ComponentProps<typeof Avatar> {
	readonly name: string;
	readonly avatarUrl?: string | null;
	readonly isAnonymous?: boolean;
}

export function UserAvatar({
	name,
	avatarUrl,
	isAnonymous = false,
	className,
	...rest
}: Readonly<UserAvatarProps>) {
	const showImage = !isAnonymous && Boolean(avatarUrl);

	return (
		<span className={cn("inline-flex shrink-0 rounded-full", className)}>
			<Avatar className="size-full transform-gpu backface-hidden" {...rest}>
				{showImage && <AvatarImage src={avatarUrl ?? undefined} alt={name} />}
				<AvatarFallback className={cn(getAvatarColor(name))}>
					{getInitials(name, isAnonymous)}
				</AvatarFallback>
			</Avatar>
		</span>
	);
}
