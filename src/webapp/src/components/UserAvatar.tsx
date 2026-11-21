import type { ComponentProps } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
	"bg-avatar-blue text-avatar-blue-foreground",
	"bg-avatar-emerald text-avatar-emerald-foreground",
	"bg-avatar-amber text-avatar-amber-foreground",
	"bg-avatar-rose text-avatar-rose-foreground",
	"bg-avatar-violet text-avatar-violet-foreground",
	"bg-avatar-cyan text-avatar-cyan-foreground",
	"bg-avatar-orange text-avatar-orange-foreground",
	"bg-avatar-indigo text-avatar-indigo-foreground",
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
	if (isAnonymous) {
		return "?";
	}
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
		<Avatar className={className} {...rest}>
			{showImage && <AvatarImage src={avatarUrl ?? undefined} alt={name} />}
			<AvatarFallback className={cn(getAvatarColor(name))}>
				{getInitials(name, isAnonymous)}
			</AvatarFallback>
		</Avatar>
	);
}
