import type { ParsedOffering } from "../saz/coursePage.ts";

/** An invented parsed offering of one fall term and one programme. */
export const offering = (
	sazCode: string,
	overrides: Partial<ParsedOffering> = {},
): ParsedOffering => ({
	sazCode,
	title: "Вступ до вигаданих систем",
	credits: 3,
	hours: 90,
	studyYear: 1,
	format: "2015",
	status: "held",
	isPractical: false,
	faculty: "Факультет вигаданих наук",
	department: "Кафедра вигаданих систем",
	level: "bachelor",
	academicYear: 2031,
	sazTeachers: null,
	annotation: null,
	programmes: [{ name: "Вигадана інженерія", kind: "compulsory" }],
	terms: [
		{
			season: "FALL",
			semesters: [1],
			credits: 3,
			hoursPerWeek: 2,
			lectureHours: 14,
			seminarHours: 14,
			practiceHours: null,
			control: "pass_fail",
		},
	],
	maxStudents: null,
	maxGroups: null,
	computedMaxStudents: null,
	groupSizeMin: 15,
	groupSizeMax: 30,
	enrolledActive: null,
	...overrides,
});
