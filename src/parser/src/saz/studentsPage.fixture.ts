/** A value of a students page entry, as JSON gives it. */
export type EntryValue = string | number | boolean | null;

/** One students page entry with all 17 keys, for an invented student. */
export const studentEntry = (
	fields: Readonly<Record<string, EntryValue>> = {},
) => ({
	cdoc: 600123,
	name: "Зразок Олена Петрівна",
	email: "o.zrazok@example.edu",
	specName: "Вигадана інженерія",
	type: "mandat",
	typeLabel: "Обов`язкова",
	status: 10,
	statusLabel: "записано",
	statusDescription: "",
	isStudentActive: true,
	isForced: false,
	isEnrolled: true,
	isUnenrolled: false,
	group: 2,
	grade: 3,
	createdAt: 1_800_000_000,
	updatedAt: 0,
	...fields,
});

export const studentsPage = (
	...entries: ReadonlyArray<Readonly<Record<string, EntryValue>>>
) => JSON.stringify(entries);
