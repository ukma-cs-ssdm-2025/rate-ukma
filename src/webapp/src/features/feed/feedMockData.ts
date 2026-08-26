import type { FeedItem } from "./feedTypes";

/**
 * Placeholder feed content used while the feed API is not wired yet.
 *
 * `review` items stand in for the auto-populated stream (recent ratings);
 * `promo` items stand in for admin-configured announcements. Replace with a
 * real query once the backend endpoint exists — the components only depend on
 * the {@link FeedItem} shape, not on this array. Manual content can later bind
 * to the existing `usePromoBannerList` endpoint.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();

export const MOCK_FEED_ITEMS: readonly FeedItem[] = [
	{
		kind: "promo",
		id: "promo-1",
		createdAt: ago(30 * MINUTE),
		accent: "brand",
		label: "Оголошення",
		title: "Реєстрація на вибіркові відкрита",
		body: "Оберіть дисципліни до 20 вересня.",
		ctaLabel: "Детальніше",
		ctaHref: "#",
	},
	{
		kind: "review",
		id: "review-1",
		createdAt: ago(45 * MINUTE),
		courseId: "00000000-0000-0000-0000-000000000001",
		courseTitle: "Алгоритми та структури даних",
		studentName: "Олена Ковальчук",
		isAnonymous: false,
		difficulty: 4.2,
		usefulness: 4.8,
		comment: "Складно, але корисно. Практика допомагає.",
		semesterYear: 2025,
		semesterTerm: "FALL",
	},
	{
		kind: "review",
		id: "review-2",
		createdAt: ago(2 * HOUR),
		courseId: "00000000-0000-0000-0000-000000000002",
		courseTitle: "Вступ до машинного навчання",
		studentName: "Анонім",
		isAnonymous: true,
		difficulty: 3.6,
		usefulness: 4.5,
		comment: "Пояснює доступно, сучасні приклади.",
		semesterYear: 2025,
		semesterTerm: "FALL",
	},
	{
		kind: "promo",
		id: "promo-2",
		createdAt: ago(5 * HOUR),
		accent: "info",
		label: "Подія",
		title: "Хакатон факультету інформатики",
		body: "48 годин, 12–14 вересня. Призовий фонд.",
		ctaLabel: "Зареєструватися",
		ctaHref: "#",
	},
	{
		kind: "review",
		id: "review-3",
		createdAt: ago(8 * HOUR),
		courseId: "00000000-0000-0000-0000-000000000003",
		courseTitle: "Мікроекономіка",
		studentName: "Дмитро Савченко",
		isAnonymous: false,
		difficulty: 2.9,
		usefulness: 3.4,
		comment: "Базовий курс, оцінювання прозоре.",
		semesterYear: 2025,
		semesterTerm: "SPRING",
	},
	{
		kind: "review",
		id: "review-4",
		createdAt: ago(1 * DAY),
		courseId: "00000000-0000-0000-0000-000000000004",
		courseTitle: "Історія української культури",
		studentName: "Марія Ткаченко",
		isAnonymous: false,
		difficulty: 2.1,
		usefulness: 3.9,
		comment: null,
		semesterYear: 2025,
		semesterTerm: "SPRING",
	},
	{
		kind: "review",
		id: "review-5",
		createdAt: ago(2 * DAY),
		courseId: "00000000-0000-0000-0000-000000000005",
		courseTitle: "Функціональне програмування",
		studentName: "Анонім",
		isAnonymous: true,
		difficulty: 4.6,
		usefulness: 4.9,
		comment: "Найкращий курс на факультеті.",
		semesterYear: 2025,
		semesterTerm: "FALL",
	},
];
