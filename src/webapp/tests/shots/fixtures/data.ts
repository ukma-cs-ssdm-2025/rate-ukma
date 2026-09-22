import type {
	CourseAnalytics,
	CourseDetail,
	CourseList,
	CourseOfferingListResponse,
	FeedItem,
	FilterOptions,
	RatingsWithUserList,
	Session,
	StudentRatingsDetailed,
} from "../../../src/lib/api/generated";

// Every value here is invented: no real students, teachers or reviews.

const NOW = Date.parse("2026-09-16T09:00:00Z");
const hoursAgo = (hours: number) =>
	new Date(NOW - hours * 3_600_000).toISOString();

const FACULTIES = [
	{ id: "f-info", name: "Факультет інформатики" },
	{ id: "f-econ", name: "Факультет економічних наук" },
	{ id: "f-hum", name: "Факультет гуманітарних наук" },
] as const;

const COURSE_SEEDS = [
	["c-algo", "Алгоритми та структури даних", 0, 4.6, 4.8, 38],
	["c-db", "Бази даних", 0, 3.4, 4.5, 27],
	["c-ml", "Машинне навчання", 0, 4.2, 4.7, 31],
	["c-discrete", "Дискретна математика", 0, 4.8, 4.1, 44],
	["c-arch", "Архітектура обчислювальних систем", 0, 4.4, 3.6, 19],
	["c-micro", "Мікроекономіка", 1, 3.1, 4.0, 22],
	["c-invest", "Інвестиційний аналіз", 1, 3.6, 4.3, 15],
	["c-hist", "Історія світової цивілізації", 2, 2.4, 3.9, 25],
	["c-phil", "Вступ до філософії", 2, 2.9, 4.4, 17],
	["c-lit", "Сучасна українська література", 2, 2.1, 4.6, 12],
] as const;

export const COURSES = COURSE_SEEDS.map(
	([id, title, faculty, difficulty, usefulness, count]) => ({
		id,
		title,
		description: `Курс «${title}» для студентів бакалаврату.`,
		status: "ACTIVE" as const,
		education_level: "BACHELOR" as const,
		department: `${FACULTIES[faculty].id}-dep`,
		department_name: "Кафедра демонстраційних дисциплін",
		faculty: FACULTIES[faculty].id,
		faculty_name: FACULTIES[faculty].name,
		faculty_custom_abbreviation: null,
		avg_difficulty: difficulty,
		avg_usefulness: usefulness,
		ratings_count: count,
		specialities: [
			{
				speciality_id: `${FACULTIES[faculty].id}-spec`,
				speciality_title: "Демонстраційна спеціальність",
				faculty_name: FACULTIES[faculty].name,
				faculty_id: FACULTIES[faculty].id,
				type_kind: "COMPULSORY" as const,
			},
		],
	}),
) satisfies CourseList[];

export const COURSE = COURSES[0];

export const COURSE_DETAIL = COURSE satisfies CourseDetail;

export const ANALYTICS = COURSES.map((course) => ({
	id: course.id,
	name: course.title,
	avg_difficulty: course.avg_difficulty,
	avg_usefulness: course.avg_usefulness,
	ratings_count: course.ratings_count,
	faculty_name: course.faculty_name,
})) satisfies CourseAnalytics[];

export const FILTER_OPTIONS = {
	instructors: [{ id: "i-1", name: "Олена Демченко", department: null }],
	faculties: FACULTIES.map((faculty) => ({
		id: faculty.id,
		name: faculty.name,
		custom_abbreviation: null,
		departments: [
			{ id: `${faculty.id}-dep`, name: "Кафедра демонстраційних дисциплін" },
		],
		specialities: [
			{ id: `${faculty.id}-spec`, name: "Демонстраційна спеціальність" },
		],
	})),
	semester_terms: [
		{ value: "FALL", label: "Fall" },
		{ value: "SPRING", label: "Spring" },
	],
	semester_years: [{ value: "2025–2026", label: "2025–2026" }],
	course_types: [
		{ value: "COMPULSORY", label: "Compulsory" },
		{ value: "ELECTIVE", label: "Elective" },
	],
} satisfies FilterOptions;

export const SESSION = {
	is_authenticated: true,
	user: {
		id: 1,
		email: "student@example.invalid",
		first_name: "Тарас",
		last_name: "Демо",
		patronymic: "",
		avatar_url: null,
	},
	expires_at: "2099-01-01T00:00:00Z",
	is_student: true,
} satisfies Session;

const REVIEW_COMMENTS = [
	"Багато практики, але саме вона вчить думати. Домашні завдання варто починати заздалегідь.",
	"Лекції насичені, конспект рятує перед екзаменом.",
	"Цікаві кейси з реального життя, семінари проходять жваво.",
	"Складно, але після курсу значно впевненіше пишу код.",
	"Матеріал корисний, хоча організацію можна покращити.",
];

const reviews: FeedItem[] = COURSES.slice(0, 6).map((course, index) => ({
	kind: "review",
	id: `review-${index}`,
	occurred_at: hoursAgo(3 + index * 7),
	course_id: course.id,
	course_title: course.title,
	difficulty: Math.min(5, Math.round(course.avg_difficulty + (index % 2))),
	usefulness: Math.max(1, Math.round(course.avg_usefulness - (index % 3))),
	comment: REVIEW_COMMENTS[index % REVIEW_COMMENTS.length],
	semester_year: 2026,
	semester_term: "SPRING",
	course_avg_difficulty: course.avg_difficulty,
	course_avg_usefulness: course.avg_usefulness,
})) satisfies FeedItem[];

export const FEED_ITEMS: FeedItem[] = [
	{
		kind: "promo",
		id: "promo-hackathon",
		occurred_at: hoursAgo(30),
		pinned: true,
		title: "Студентський хакатон",
		body: "Збери команду та створи застосунок за 48 годин. Реєстрація до кінця тижня.",
		accent: "BRAND",
		label: "Подія",
		cta_label: "Зареєструватися",
		cta_href: "https://example.invalid/hackathon",
		image_url: null,
	},
	{
		kind: "promo",
		id: "promo-boardgames",
		occurred_at: hoursAgo(40),
		pinned: true,
		title: "Клуб настільних ігор",
		body: "Щочетверга граємо в стратегії та карткові ігри. Новачкам раді.",
		accent: "INFO",
		label: "Спільнота",
		cta_label: "Долучитися",
		cta_href: "https://example.invalid/boardgames",
		image_url: null,
	},
	reviews[0],
	{
		kind: "comment",
		id: "comment-1",
		occurred_at: hoursAgo(5),
		rating_id: "rating-1",
		course_id: COURSES[1].id,
		course_title: COURSES[1].title,
		content: "Погоджуюсь, лабораторні найкорисніша частина курсу.",
	},
	...reviews.slice(1, 3),
	{
		kind: "promo",
		id: "promo-maintenance",
		occurred_at: hoursAgo(20),
		pinned: false,
		title: "Технічні роботи вночі",
		body: "У ніч на суботу сайт може бути недоступний до 30 хвилин.",
		accent: "WARNING",
		label: "Увага",
		image_url: null,
	},
	...reviews.slice(3),
] satisfies FeedItem[];

const RATING_AUTHORS = ["Анонім", "Марта К.", "Анонім", "Остап Л."];

export const COURSE_RATINGS = {
	items: {
		ratings: REVIEW_COMMENTS.slice(0, 4).map((comment, index) => ({
			id: `rating-${index}`,
			student_id: `student-${index}`,
			student_name: RATING_AUTHORS[index],
			student_avatar_url: null,
			course: COURSE.id,
			course_offering: "offering-1",
			course_offering_term: "SPRING",
			course_offering_year: 2026,
			difficulty: 4 + (index % 2),
			usefulness: 5 - (index % 2),
			comment,
			instructor: null,
			instructors: [],
			is_anonymous: RATING_AUTHORS[index] === "Анонім",
			created_at: hoursAgo(24 * (index + 1)),
			upvotes: 6 - index,
			downvotes: index % 2,
			viewer_vote: null,
			comments_count: index === 0 ? 2 : 0,
			comment_authors: [],
		})),
		user_ratings: null,
	},
	filters: {
		course_id: COURSE.id,
		separate_current_user: false,
		viewer_id: "student-me",
		popularity_order: false,
	},
	page: 1,
	page_size: 10,
	total: 4,
	total_pages: 1,
	next_page: null,
	previous_page: null,
} satisfies RatingsWithUserList;

export const COURSE_OFFERINGS = {
	course_offerings: [
		{
			id: "offering-1",
			course_id: COURSE.id,
			course_title: COURSE.title,
			semester_id: "semester-2026-spring",
			semester_year: 2026,
			semester_term: "Spring",
			code: "900001",
			exam_type: "EXAM",
			study_year: 2,
			max_students: 90,
			max_groups: 3,
			group_size_min: 10,
			group_size_max: 30,
			instructors: [
				{
					id: "i-1",
					first_name: "Олена",
					patronymic: "Петрівна",
					last_name: "Демченко",
				},
			],
			specialities: COURSE.specialities,
			terms: [],
		},
	],
} satisfies CourseOfferingListResponse;

export const MY_GRADES = COURSES.slice(0, 8).map((course, index) => ({
	course_id: course.id,
	course_title: course.title,
	course_code: `90000${index}`,
	course_offering_id: `offering-${course.id}`,
	faculty_name: course.faculty_name,
	semester: {
		year: index < 4 ? 2025 : 2024,
		season: index % 2 === 0 ? "FALL" : "SPRING",
	},
	rated:
		index % 3 === 2
			? null
			: {
					id: `my-rating-${index}`,
					difficulty: 3 + (index % 3),
					usefulness: 5 - (index % 2),
					comment: REVIEW_COMMENTS[index % REVIEW_COMMENTS.length],
					instructor: null,
					instructors: [],
					created_at: hoursAgo(24 * 30 * (index + 1)),
					is_anonymous: index % 2 === 0,
				},
	can_rate: true,
})) satisfies StudentRatingsDetailed[];
