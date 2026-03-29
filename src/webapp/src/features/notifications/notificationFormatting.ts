const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;

export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	const now = Date.now();
	const diffSeconds = Math.floor((now - date.getTime()) / 1000);

	if (diffSeconds < SECONDS_PER_MINUTE) {
		return "щойно";
	}
	if (diffSeconds < SECONDS_PER_HOUR) {
		const minutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
		return `${minutes} хв тому`;
	}
	if (diffSeconds < SECONDS_PER_DAY) {
		const hours = Math.floor(diffSeconds / SECONDS_PER_HOUR);
		return `${hours} год тому`;
	}
	if (diffSeconds < SECONDS_PER_WEEK) {
		const days = Math.floor(diffSeconds / SECONDS_PER_DAY);
		return `${days} д тому`;
	}

	return new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		month: "short",
	}).format(date);
}
