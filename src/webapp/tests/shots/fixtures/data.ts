import type {
	CommentList,
	CourseAnalytics,
	CourseDetail,
	CourseList,
	CourseOffering,
	CourseOfferingListResponse,
	FeedItem,
	FilterOptions,
	NotificationGroup,
	RatingsWithUserList,
	Session,
	StudentRatingsDetailed,
	StudentRatingsLight,
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

// Real САЗ descriptions run several paragraphs, so the detail page gets a long one.
export const COURSE_DETAIL = {
	...COURSE,
	description:
		"Курс знайомить з базовими структурами даних (масиви, списки, стеки, черги, хеш-таблиці, дерева, графи) та алгоритмами роботи з ними. Студенти вчаться оцінювати складність алгоритмів, обирати структуру даних під задачу та доводити коректність розв'язків.\n\nПрактична частина складається з щотижневих лабораторних робіт мовою C++ або Java та двох контрольних робіт. Для успішного проходження курсу потрібні знання дискретної математики та основ програмування. Підсумкова оцінка складається з лабораторних (40%), контрольних (20%) та іспиту (40%).",
} satisfies CourseDetail;

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
		{ value: "SUMMER", label: "Summer" },
	],
	semester_years: [
		{ value: "2025–2026", label: "2025–2026" },
		{ value: "2024–2025", label: "2024–2025" },
	],
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
			course_offering: "offering-2026-SPRING",
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

const offeringSpeciality = (title: string) => ({
	speciality_id: `spec-${title.length}`,
	speciality_title: title,
	speciality_alias: null,
	faculty_id: FACULTIES[0].id,
	faculty_name: FACULTIES[0].name,
	type_kind: "COMPULSORY" as const,
});

const offering = (
	year: number,
	term: "SPRING" | "FALL",
	credits: string,
	weeklyHours: number,
): CourseOffering => ({
	id: `offering-${year}-${term}`,
	course_id: COURSE.id,
	course_title: COURSE.title,
	semester_id: `semester-${year}-${term.toLowerCase()}`,
	semester_year: year,
	semester_term: term === "SPRING" ? "Spring" : "Fall",
	code: `9000${year % 100}`,
	exam_type: "EXAM",
	study_year: 2,
	max_students: 90,
	max_groups: 3,
	group_size_min: 10,
	group_size_max: 30,
	// Prod never fills offering instructors (CourseInstructor is empty).
	instructors: [],
	specialities: COURSE.specialities,
	terms: [
		{
			id: `t-${year}-${term}`,
			semester_year: year,
			semester_term: term,
			credits,
			weekly_hours: weeklyHours,
			total_hours: Number(credits) * 30,
			lecture_count: Number(credits) * 6,
			practice_count: Number(credits) * 6,
		},
	],
});

// Newest first; the 2021 run carries a lighter load so its row shows it.
export const COURSE_OFFERINGS = {
	course_offerings: [
		offering(2026, "SPRING", "5.0", 4),
		offering(2025, "SPRING", "5.0", 4),
		// Prod САЗ holds one record per stream, so a year can carry several,
		// mostly split by speciality.
		{
			...offering(2025, "SPRING", "5.0", 4),
			id: "offering-2025-SPRING-b",
			code: "900125",
			specialities: [offeringSpeciality("Інженерія програмного забезпечення")],
		},
		{
			...offering(2025, "SPRING", "5.0", 4),
			id: "offering-2025-SPRING-c",
			code: "900225",
			specialities: [offeringSpeciality("Комп'ютерні науки")],
		},
		offering(2024, "SPRING", "5.0", 4),
		offering(2023, "SPRING", "5.0", 4),
		offering(2021, "SPRING", "4.0", 3),
	],
} satisfies CourseOfferingListResponse;

export const NOTIFICATIONS = [
	{
		group_key: "RATING_UPVOTED:rating-0",
		event_type: "RATING_UPVOTED",
		latest_notification_id: "n-1",
		source_object_id: "vote-1",
		count: 1,
		latest_created_at: hoursAgo(0.3),
		is_unread: true,
		message: "Хтось вподобав ваш відгук",
		rating_id: "rating-0",
		course_id: COURSE.id,
	},
	{
		group_key: "RATING_COMMENT_CREATED:rating-0",
		event_type: "RATING_COMMENT_CREATED",
		latest_notification_id: "n-2",
		source_object_id: "comment-1",
		count: 1,
		latest_created_at: hoursAgo(3),
		is_unread: true,
		message:
			"Хтось прокоментував ваш відгук: «Згодна, лабораторні справді об'ємні, але корисні»",
		rating_id: "rating-0",
		course_id: COURSE.id,
	},
	{
		group_key: "RATING_DOWNVOTED:rating-0",
		event_type: "RATING_DOWNVOTED",
		latest_notification_id: "n-3",
		source_object_id: "vote-2",
		count: 2,
		latest_created_at: hoursAgo(26),
		is_unread: false,
		message: "2 людей не вподобали ваш відгук",
		rating_id: "rating-0",
		course_id: COURSE.id,
	},
	{
		group_key: "RATING_UPVOTED:rating-1",
		event_type: "RATING_UPVOTED",
		latest_notification_id: "n-4",
		source_object_id: "vote-3",
		count: 5,
		latest_created_at: hoursAgo(96),
		is_unread: false,
		message: "5 людей вподобали ваш відгук",
		rating_id: "rating-1",
		course_id: COURSE.id,
	},
] satisfies NotificationGroup[];

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

export const EMPTY_COMMENT_LIST = {
	items: [],
	filters: {},
	page: 1,
	page_size: 5,
	total: 0,
	total_pages: 0,
	next_page: null,
	previous_page: null,
} satisfies CommentList;

// The fixture student attends COURSE; the offering's state decides what the
// course page rate action shows (see useUserCourseRating).
export type MyCourseState = "rateable" | "not-yet" | "rated";

export const myCourses = (state: MyCourseState) =>
	[
		{
			id: COURSE.id,
			offerings: [
				{
					id: "offering-1",
					course_id: COURSE.id,
					year: 2026,
					season: "SPRING",
					can_rate: state !== "not-yet",
					rated:
						state === "rated"
							? {
									id: "my-rating-course",
									difficulty: 4,
									usefulness: 5,
									comment:
										"Складно, але після курсу значно впевненіше пишу код.",
									instructor: null,
									instructors: [],
									created_at: hoursAgo(24 * 20),
									is_anonymous: false,
								}
							: null,
				},
			],
		},
	] satisfies StudentRatingsLight[];

// Thread under the first review (rating-0): two top-level comments, the first
// with a single reply served from COMMENT_REPLIES.
export const RATING_COMMENTS = {
	items: [
		{
			id: "comment-c1",
			parent_id: null,
			rating_id: "rating-0",
			content: "Повністю згодна, лабораторні справді найцінніша частина курсу.",
			user_id: 11,
			user_name: "Марта К.",
			user_avatar_url: null,
			is_anonymous: false,
			can_manage: false,
			created_at: hoursAgo(30),
			replies_count: 1,
		},
		{
			id: "comment-c2",
			parent_id: null,
			rating_id: "rating-0",
			content:
				"А як із навантаженням наприкінці семестру? Кажуть, останні дві домашки дуже обʼємні.",
			user_id: null,
			user_name: null,
			user_avatar_url: null,
			is_anonymous: true,
			can_manage: false,
			created_at: hoursAgo(20),
			replies_count: 0,
		},
	],
	filters: {},
	page: 1,
	page_size: 5,
	total: 2,
	total_pages: 1,
	next_page: null,
	previous_page: null,
} satisfies CommentList;

export const COMMENT_REPLIES = {
	items: [
		{
			id: "comment-c1-r1",
			parent_id: "comment-c1",
			rating_id: "rating-0",
			content:
				"Так, останні дві домашки обʼємні, але їх можна здавати частинами. Раджу починати заздалегідь.",
			user_id: 12,
			user_name: "Остап Л.",
			user_avatar_url: null,
			is_anonymous: false,
			can_manage: false,
			created_at: hoursAgo(18),
			replies_count: 0,
		},
	],
	filters: {},
	page: 1,
	page_size: 5,
	total: 1,
	total_pages: 1,
	next_page: null,
	previous_page: null,
} satisfies CommentList;
