const dayMonth = new Intl.DateTimeFormat("uk-UA", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("uk-UA", {
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});

function addDays(isoMonday: string, offset: number): Date {
	const date = new Date(`${isoMonday}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + offset);
	return date;
}

/** «06.10» for the grid header. */
export function formatDayDate(isoMonday: string, offset: number): string {
	return dayMonth.format(addDays(isoMonday, offset));
}

/** «6 жовтня» for the phone agenda. */
export function formatLongDay(isoMonday: string, offset: number): string {
	return longDay.format(addDays(isoMonday, offset));
}

/** «5–9 жовтня» for the week of a Monday. */
export function formatWeekRange(isoMonday: string): string {
	const monday = addDays(isoMonday, 0);
	const friday = addDays(isoMonday, 4);
	return monday.getUTCMonth() === friday.getUTCMonth()
		? `${monday.getUTCDate()}–${longDay.format(friday)}`
		: `${longDay.format(monday)} – ${longDay.format(friday)}`;
}
