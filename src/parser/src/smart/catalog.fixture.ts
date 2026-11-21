import type { SmartLists } from "./catalog.ts";

/** Invented smart.ukma lists in the shape the API replies with: two teachers,
 *  three disciplines, links keyed by discipline, teacher and role. Nothing
 *  here is real. */
export const smartLists = (overrides: Partial<SmartLists> = {}): SmartLists => {
	const lists = {
		departments: {
			items: [{ id: 901, nameUa: "Кафедра вигаданих систем", nameEn: "x" }],
			total: 1,
		},
		teachers: {
			items: [
				{
					id: 7001,
					lastName: "Вигаданенко",
					firstName: "Марта",
					middleName: "Олегівна",
					email: " M.Vyhadanenko@Example.edu ",
					departmentId: 901,
					departmentName: "Кафедра вигаданих систем",
					hasPhoto: false,
				},
				{
					id: 7002,
					lastName: "Зразковий",
					firstName: "Тарас",
					middleName: "",
					email: null,
					departmentId: null,
				},
			],
			total: 2,
		},
		disciplines: {
			items: [
				discipline(5001, "Уявні алгоритми", 1, 2025, "BACHELOR"),
				discipline(5002, "Вигадана статистика", 6, 2024, "MASTER"),
				discipline(5003, "Практика уявна", 3, 2026, "PHD"),
			],
			total: 3,
		},
		links: {
			items: [
				link(5001, 7002, "PRACTICE_TEACHER"),
				link(5001, 7001, "LECTURER"),
				link(5002, 7999, "LECTURER_AND_PRACTICE_TEACHER"),
				link(5999, 7001, "LECTURER"),
			],
			total: 4,
		},
	};

	return {
		departments: JSON.stringify(lists.departments),
		teachers: JSON.stringify(lists.teachers),
		disciplines: JSON.stringify(lists.disciplines),
		links: JSON.stringify(lists.links),
		...overrides,
	};
};

export function link(disciplineId: number, teacherId: number, role: string) {
	return {
		id: { disciplineId, teacherId, teacherRole: role },
		teacher: { id: teacherId },
		employmentStatus: "FULL_TIME",
	};
}

function discipline(
	id: number,
	titleUa: string,
	semesterOfTeaching: number,
	entrance: number,
	programLevel: string,
) {
	return {
		id,
		titleUa,
		titleEn: "x",
		departmentId: 901,
		ectsLoans: 4,
		semesterOfTeaching,
		controlType: "EXAM",
		curriculums: [
			{
				curriculum: {
					id: 1,
					educationProgram: { id: 1, titleUa: "x", programLevel },
					yearOfEntrance: {
						id: 1,
						start: entrance,
						end: entrance + 1,
						current: false,
					},
				},
				obligationsType: "MANDATORY",
			},
		],
		teachers: [],
	};
}
