import { faker } from "@faker-js/faker";

import type { UseFeedReturn } from "@/features/feed/hooks/useFeed";
import type {
	CourseList,
	CourseOffering,
	CourseOfferingSpeciality,
	CourseOfferingSpecialityInline,
	CourseOfferingTerm,
	CourseTypeOption,
	DepartmentOption,
	FeedCommentItem,
	FeedPromoItem,
	FeedReviewItem,
	FacultyOption,
	FilterOptions,
	InlineRatingDetailed,
	InstructorOption,
	SemesterTermOption,
	SemesterYearOption,
	SpecialityOption,
	StudentRatingsDetailed,
} from "@/lib/api/generated";

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
		description: null,
		status: faker.helpers.arrayElement([
			"PLANNED",
			"ACTIVE",
			"FINISHED",
		] as const),
		education_level: null,
		department: faker.string.uuid(),
		department_name: faker.lorem.words(3),
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

export function createMockCourses(count: number): CourseList[] {
	return Array.from({ length: count }, () => createMockCourse());
}

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

export function createMockDepartment(
	overrides?: Partial<DepartmentOption>,
): DepartmentOption {
	return {
		id: faker.string.uuid(),
		name: faker.lorem.words(3),
		...overrides,
	};
}

export function createMockInstructor(
	overrides?: Partial<InstructorOption>,
): InstructorOption {
	return {
		id: faker.string.uuid(),
		name: faker.person.fullName(),
		...overrides,
	};
}

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

export function createMockSpeciality(
	overrides?: Partial<SpecialityOption>,
): SpecialityOption {
	return {
		id: faker.string.uuid(),
		name: faker.lorem.words(2),
		...overrides,
	};
}

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

export function createMockFeedPromoItem(
	overrides?: Partial<FeedPromoItem>,
): FeedPromoItem {
	return {
		kind: "promo",
		id: faker.string.uuid(),
		occurred_at: faker.date.recent().toISOString(),
		pinned: false,
		title: faker.lorem.words(4),
		body: faker.lorem.sentence(),
		accent: "BRAND",
		label: "",
		cta_label: "",
		cta_href: "",
		image_url: null,
		...overrides,
	};
}

export function createMockFeedReviewItem(
	overrides?: Partial<FeedReviewItem>,
): FeedReviewItem {
	return {
		kind: "review",
		id: faker.string.uuid(),
		occurred_at: faker.date.recent().toISOString(),
		course_id: faker.string.uuid(),
		course_title: faker.lorem.words(3),
		difficulty: faker.number.int({ min: 1, max: 5 }),
		usefulness: faker.number.int({ min: 1, max: 5 }),
		comment: faker.lorem.sentence(),
		semester_year: 2025,
		semester_term: "FALL",
		course_avg_difficulty: faker.number.float({
			min: 1,
			max: 5,
			fractionDigits: 2,
		}),
		course_avg_usefulness: faker.number.float({
			min: 1,
			max: 5,
			fractionDigits: 2,
		}),
		...overrides,
	};
}

export function createMockFeedCommentItem(
	overrides?: Partial<FeedCommentItem>,
): FeedCommentItem {
	return {
		kind: "comment",
		id: faker.string.uuid(),
		occurred_at: faker.date.recent().toISOString(),
		rating_id: faker.string.uuid(),
		course_id: faker.string.uuid(),
		course_title: faker.lorem.words(3),
		content: faker.lorem.sentence(),
		...overrides,
	};
}

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

export function createMockSpecialityInline(
	overrides?: Partial<CourseOfferingSpecialityInline>,
): CourseOfferingSpecialityInline {
	return {
		speciality_id: faker.string.uuid(),
		speciality_title: faker.lorem.words(2),
		speciality_alias: "",
		faculty_id: faker.string.uuid(),
		faculty_name: faker.lorem.words(3),
		type_kind: "COMPULSORY",
		...overrides,
	};
}

export function createMockOfferingTerm(
	overrides?: Partial<CourseOfferingTerm>,
): CourseOfferingTerm {
	return {
		id: faker.string.uuid(),
		offering_id: faker.string.uuid(),
		semester_id: faker.string.uuid(),
		semester_year: 2026,
		semester_term: "SPRING",
		exam_type: "EXAM",
		practice_type: null,
		credits: "5.0",
		weekly_hours: 4,
		total_hours: null,
		lecture_count: null,
		practice_count: null,
		...overrides,
	};
}

export function createMockOffering(
	overrides?: Partial<CourseOffering>,
): CourseOffering {
	return {
		id: faker.string.uuid(),
		course_id: faker.string.uuid(),
		course_title: null,
		semester_id: faker.string.uuid(),
		semester_year: 2026,
		semester_term: "Spring",
		code: faker.string.numeric(6),
		exam_type: "EXAM",
		study_year: null,
		max_students: null,
		max_groups: null,
		group_size_min: null,
		group_size_max: null,
		instructors: [],
		specialities: [],
		terms: [],
		...overrides,
	};
}

export function createMockInlineRatingDetailed(
	overrides?: Partial<InlineRatingDetailed>,
): InlineRatingDetailed {
	return {
		id: faker.string.uuid(),
		difficulty: faker.number.int({ min: 1, max: 5 }),
		usefulness: faker.number.int({ min: 1, max: 5 }),
		comment: "",
		instructor: null,
		instructors: [],
		created_at: faker.date.recent().toISOString(),
		is_anonymous: false,
		...overrides,
	};
}

export function createMockStudentRating(
	overrides?: Partial<StudentRatingsDetailed>,
): StudentRatingsDetailed {
	return {
		course_id: faker.string.uuid(),
		course_title: faker.lorem.words(3),
		course_code: null,
		course_offering_id: faker.string.uuid(),
		faculty_name: null,
		semester: { year: 2025, season: "FALL" },
		rated: null,
		can_rate: true,
		...overrides,
	};
}

export function createMockOfferingSpeciality(
	overrides?: Partial<CourseOfferingSpeciality>,
): CourseOfferingSpeciality {
	return {
		speciality_id: faker.string.uuid(),
		speciality_title: faker.lorem.words(2),
		speciality_alias: null,
		faculty_id: faker.string.uuid(),
		faculty_name: faker.lorem.words(3),
		type_kind: "COMPULSORY",
		...overrides,
	};
}
