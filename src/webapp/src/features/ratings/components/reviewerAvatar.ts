const AVATAR_COLORS = [
	"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
	"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
	"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
	"bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
	"bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
	"bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
	"bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
	"bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
] as const;

function hashName(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash << 5) - hash + name.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

export function getInitials(name: string, isAnonymous: boolean): string {
	if (isAnonymous) return "?";
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string): string {
	return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}
