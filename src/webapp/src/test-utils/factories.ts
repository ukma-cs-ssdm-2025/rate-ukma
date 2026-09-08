import { faker } from "@faker-js/faker";

import type { FeedPromoItem, FeedReviewItem } from "@/features/feed/feedTypes";
import type { UseFeedReturn } from "@/features/feed/hooks/useFeed";
import type {
	CourseList,
	CourseListFilters,
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
		description: faker.lorem.sentence(),
		status: faker.helpers.arrayElement([
			"PLANNED",
			"ACTIVE",
			"FINISHED",
		] as const),
		education_level: faker.helpers.arrayElement([
			"BACHELOR",
			"MASTER",
		] as const),
		department: faker.string.uuid(),
		department_name: "Кафедра інформатики",
		faculty: faker.string.uuid(),
		faculty_name: faker.helpers.arrayElement(facultyNames),
		faculty_custom_abbreviation: null,
		avg_difficulty: faker.number.float({ min: 1, max: 5, fractionDigits: 2 }),
		avg_usefulness: faker.number.float({
			min: 1,
			max: 5,
			fractionDigits: 2,
		}),
		ratings_count: faker.number.int({ min: 0, max: 150 }),
		specialities: [],
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
		departments: [],
		specialities: [],
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
	const terms = [
		{ value: "FALL", label: "Осінь" },
		{ value: "SPRING", label: "Весна" },
	] as const;
	const term = faker.helpers.arrayElement(terms);
	return {
		value: term.value,
		label: term.label,
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
	const courseTypes = [
		{ value: "COMPULSORY", label: "Обов'язковий" },
		{ value: "ELECTIVE", label: "Вибірковий" },
		{ value: "PROF_ORIENTED", label: "Професійно-орієнтований" },
	] as const;
	const courseType = faker.helpers.arrayElement(courseTypes);
	return {
		value: courseType.value,
		label: courseType.label,
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
				departments: [
					createMockDepartment({
						id: "dept-1",
						name: "Кафедра мультимедійних систем",
					}),
				],
				specialities: [
					createMockSpeciality({
						id: "spec-1",
						name: "Інженерія програмного забезпечення",
					}),
				],
			}),
			createMockFaculty({
				id: "faculty-2",
				name: "Факультет економічних наук",
				departments: [
					createMockDepartment({
						id: "dept-2",
						name: "Кафедра фінансів",
					}),
				],
				specialities: [
					createMockSpeciality({
						id: "spec-2",
						name: "Економіка",
					}),
				],
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
			createMockCourseType({ value: "COMPULSORY", label: "Обов'язковий" }),
			createMockCourseType({ value: "ELECTIVE", label: "Вибірковий" }),
		],
		...overrides,
	};
}

/**
 * Empty `applied_filters` envelope: the API returns every CourseListFilters
 * key on each response, so tests stub all of them as unset.
 */
export function emptyCourseFilters(
	overrides?: Partial<CourseListFilters>,
): CourseListFilters {
	return {
		name: null,
		type_kind: null,
		instructor: null,
		faculty: null,
		department: null,
		speciality: null,
		education_level: null,
		semester_year: null,
		semester_terms: null,
		credits_max: null,
		credits_min: null,
		avg_difficulty_min: null,
		avg_difficulty_max: null,
		avg_usefulness_min: null,
		avg_usefulness_max: null,
		ratings_count_min: null,
		avg_difficulty_order: null,
		avg_usefulness_order: null,
		last_review_order: null,
		page: null,
		page_size: null,
		...overrides,
	};
}

/**
 * Factory for creating a mock promo feed item (the domain shape `useFeed`
 * returns, not the generated API shape)
 */
export function createMockFeedPromoItem(
	overrides?: Partial<FeedPromoItem>,
): FeedPromoItem {
	return {
		kind: "promo",
		id: faker.string.uuid(),
		createdAt: faker.date.recent().toISOString(),
		title: faker.lorem.words(4),
		body: faker.lorem.sentence(),
		...overrides,
	};
}

/**
 * Factory for creating a mock review feed item (the domain shape `useFeed`
 * returns, not the generated API shape)
 */
export function createMockFeedReviewItem(
	overrides?: Partial<FeedReviewItem>,
): FeedReviewItem {
	return {
		kind: "review",
		id: faker.string.uuid(),
		createdAt: faker.date.recent().toISOString(),
		courseId: faker.string.uuid(),
		courseTitle: faker.lorem.words(3),
		difficulty: faker.number.int({ min: 1, max: 5 }),
		usefulness: faker.number.int({ min: 1, max: 5 }),
		comment: faker.lorem.sentence(),
		courseAvgDifficulty: faker.number.float({
			min: 1,
			max: 5,
			fractionDigits: 2,
		}),
		courseAvgUsefulness: faker.number.float({
			min: 1,
			max: 5,
			fractionDigits: 2,
		}),
		...overrides,
	};
}

/**
 * Factory for creating a mock `useFeed` return value, for tests that mock the
 * hook out and only render its result
 */
export function createMockFeedState(
	overrides?: Partial<UseFeedReturn>,
): UseFeedReturn {
	return {
		items: [],
		hasMore: false,
		isLoading: false,
		isError: false,
		isFetchingNextPage: false,
		isRefetching: false,
		refetch: () => {},
		loaderRef: { current: null },
		...overrides,
	};
}

/** Build a typed 2-element range, e.g. for filter value tuples. */
export function createRange(min: number, max: number): [number, number] {
	return [min, max];
}
