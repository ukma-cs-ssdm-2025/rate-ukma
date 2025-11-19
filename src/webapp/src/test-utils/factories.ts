import { faker } from "@faker-js/faker";

import type {
	CourseList,
	CourseTypeOption,
	DepartmentOption,
	FacultyOption,
	FilterOptions,
	InstructorOption,
	SemesterTermOption,
	SemesterYearOption,
	SpecialityOption,
} from "@/lib/api/generated";

/**
 * Factory for creating mock course data
 * Uses faker for realistic test data generation
 */
export function createMockCourse(overrides?: Partial<CourseList>): CourseList {
	const facultyNames = [
		"Факультет інформатики",
		"Факультет економічних наук",
		"Факультет гуманітарних наук",
		"Факультет правничих наук",
		"Факультет природничих наук",
	];

	return {
		id: faker.string.uuid(),
		title: faker.lorem.words(3),
		status: faker.helpers.arrayElement([
			"PLANNED",
			"ACTIVE",
			"FINISHED",
		] as const),
		faculty_name: faker.helpers.arrayElement(facultyNames),
		avg_difficulty: faker.number.float({ min: 1, max: 5, fractionDigits: 2 }),
		avg_usefulness: faker.number.float({
			min: 1,
			max: 5,
			fractionDigits: 2,
		}),
		ratings_count: faker.number.int({ min: 0, max: 150 }),
		...overrides,
	};
}

/**
 * Factory for creating multiple mock courses
 */
export function createMockCourses(count: number): CourseList[] {
	return Array.from({ length: count }, () => createMockCourse());
}

/**
 * Factory for creating mock faculty option
 */
export function createMockFaculty(
	overrides?: Partial<FacultyOption>,
): FacultyOption {
	return {
		id: faker.string.uuid(),
		name: faker.lorem.words(3),
		...overrides,
	};
}

/**
 * Factory for creating mock department option
 */
export function createMockDepartment(
	overrides?: Partial<DepartmentOption>,
): DepartmentOption {
	return {
		id: faker.string.uuid(),
		name: faker.lorem.words(3),
		faculty_id: faker.string.uuid(),
		faculty_name: faker.lorem.words(2),
		...overrides,
	};
}

/**
 * Factory for creating mock instructor option
 */
export function createMockInstructor(
	overrides?: Partial<InstructorOption>,
): InstructorOption {
	return {
		id: faker.string.uuid(),
		name: faker.person.fullName(),
		...overrides,
	};
}

/**
 * Factory for creating mock semester term option
 */
export function createMockSemesterTerm(
	overrides?: Partial<SemesterTermOption>,
): SemesterTermOption {
	return {
		value: faker.helpers.arrayElement(["FALL", "SPRING"]),
		label: faker.helpers.arrayElement(["Осінь", "Весна"]),
		...overrides,
	};
}

/**
 * Factory for creating mock semester year option
 */
export function createMockSemesterYear(
	overrides?: Partial<SemesterYearOption>,
): SemesterYearOption {
	const year = faker.number.int({ min: 2020, max: 2025 }).toString();
	return {
		value: year,
		label: year,
		...overrides,
	};
}

/**
 * Factory for creating mock course type option
 */
export function createMockCourseType(
	overrides?: Partial<CourseTypeOption>,
): CourseTypeOption {
	return {
		value: faker.helpers.arrayElement(["MANDATORY", "ELECTIVE", "FREE_CHOICE"]),
		label: faker.helpers.arrayElement([
			"Обов'язковий",
			"Вибірковий",
			"Вільного вибору",
		]),
		...overrides,
	};
}

/**
 * Factory for creating mock speciality option
 */
export function createMockSpeciality(
	overrides?: Partial<SpecialityOption>,
): SpecialityOption {
	return {
		id: faker.string.uuid(),
		name: faker.lorem.words(2),
		faculty_id: faker.string.uuid(),
		faculty_name: faker.lorem.words(2),
		...overrides,
	};
}

/**
 * Factory for creating complete filter options
 */
export function createMockFilterOptions(
	overrides?: Partial<FilterOptions>,
): FilterOptions {
	return {
		faculties: [
			createMockFaculty({
				id: "faculty-1",
				name: "Факультет інформатики",
			}),
			createMockFaculty({
				id: "faculty-2",
				name: "Факультет економічних наук",
			}),
		],
		departments: [
			createMockDepartment({
				id: "dept-1",
				name: "Кафедра мультимедійних систем",
				faculty_id: "faculty-1",
				faculty_name: "Факультет інформатики",
			}),
			createMockDepartment({
				id: "dept-2",
				name: "Кафедра фінансів",
				faculty_id: "faculty-2",
				faculty_name: "Факультет економічних наук",
			}),
		],
		instructors: [
			createMockInstructor({ id: "instructor-1", name: "Іван Іванович" }),
			createMockInstructor({ id: "instructor-2", name: "Марія Петрівна" }),
		],
		semester_terms: [
			createMockSemesterTerm({ value: "FALL", label: "Осінь" }),
			createMockSemesterTerm({ value: "SPRING", label: "Весна" }),
		],
		semester_years: [
			createMockSemesterYear({ value: "2024", label: "2024" }),
			createMockSemesterYear({ value: "2025", label: "2025" }),
		],
		course_types: [
			createMockCourseType({ value: "MANDATORY", label: "Обов'язковий" }),
			createMockCourseType({ value: "ELECTIVE", label: "Вибірковий" }),
		],
		specialities: [
			createMockSpeciality({
				id: "spec-1",
				name: "Інженерія програмного забезпечення",
				faculty_id: "faculty-1",
				faculty_name: "Факультет інформатики",
			}),
			createMockSpeciality({
				id: "spec-2",
				name: "Економіка",
				faculty_id: "faculty-2",
				faculty_name: "Факультет економічних наук",
			}),
		],
		...overrides,
	};
}
