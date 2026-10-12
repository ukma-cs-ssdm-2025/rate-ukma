/**
 * The two NaUKMA student products. They keep their own domains and share
 * one design code, one Microsoft sign-in and the header's switcher;
 * ukma-schedule keeps the same list (apps/web/src/lib/products.ts).
 */
export const PRODUCTS = [
	{
		id: "rate",
		name: "Rate UKMA",
		blurb: "Відгуки про дисципліни й твій ІНП",
		href: "https://rateukma.com",
	},
	{
		id: "schedule",
		name: "Розклад НаУКМА",
		blurb: "Групи на сітці й пари в календарі",
		href: "https://ukmaschedule.com",
	},
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];
