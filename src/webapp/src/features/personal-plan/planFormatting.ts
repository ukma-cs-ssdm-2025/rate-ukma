import { formatDecimalValue } from "@/features/courses/courseFormatting";
import type { PlanCourseKind, PlanTerm } from "./planTypes";

export const PLAN_KIND_ORDER: readonly PlanCourseKind[] = [
	"COMPULSORY",
	"PROF_ORIENTED",
	"ELECTIVE",
];

interface KindStyle {
	/** Heading over a group of courses of this kind. */
	groupLabel: string;
	/** Fits a compact control such as a filter. */
	shortLabel: string;
	/** One course of this kind, lower-cased inside a sentence. */
	label: string;
	text: string;
	dot: string;
}

export const PLAN_KIND_STYLES: Record<PlanCourseKind, KindStyle> = {
	COMPULSORY: {
		groupLabel: "Нормативні",
		shortLabel: "Нормативні",
		label: "нормативна",
		text: "text-muted-foreground",
		dot: "bg-muted-foreground",
	},
	PROF_ORIENTED: {
		groupLabel: "Професійно-орієнтовані",
		shortLabel: "Проф.-орієнтовані",
		label: "професійно-орієнтована",
		text: "text-primary",
		dot: "bg-primary",
	},
	ELECTIVE: {
		groupLabel: "Вільного вибору",
		shortLabel: "Вільного вибору",
		label: "вільного вибору",
		text: "text-course-elective",
		dot: "bg-course-elective",
	},
};

const SEMESTER_TITLES: Record<PlanTerm, string> = {
	FALL: "Осінній семестр",
	SPRING: "Весняний семестр",
	SUMMER: "Літній семестр",
};

export function getSemesterTitle(term: PlanTerm): string {
	return SEMESTER_TITLES[term];
}

export function formatPlanCredits(credits: number | null): string {
	return formatDecimalValue(credits);
}

const UK_PLURAL = new Intl.PluralRules("uk");
const REVIEW_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "відгуків",
	one: "відгук",
	two: "відгуки",
	few: "відгуки",
	many: "відгуків",
	other: "відгуку",
};

export function formatReviewsCount(count: number): string {
	return `${count} ${REVIEW_FORMS[UK_PLURAL.select(count)]}`;
}
