import { Helmet } from "react-helmet-async";

import {
	APP_NAME,
	DEFAULT_PAGE_DESCRIPTION,
	DEFAULT_PAGE_TITLE,
} from "./site-metadata";

export function formatPageTitle(title: string) {
	return `${title} | ${APP_NAME}`;
}

export function buildCourseOgDescription(course: {
	description?: string | null;
	department_name?: string | null;
	ratings_count?: number | null;
	avg_difficulty?: number | null;
	avg_usefulness?: number | null;
}): string {
	if (course.description) {
		return course.description;
	}
	const parts: string[] = [];
	if (course.department_name) {
		parts.push(course.department_name);
	}
	if (course.ratings_count != null) {
		parts.push(`${course.ratings_count} відгуків`);
	}
	if (course.avg_difficulty != null) {
		parts.push(`складність ${course.avg_difficulty.toFixed(1)}/10`);
	}
	if (course.avg_usefulness != null) {
		parts.push(`корисність ${course.avg_usefulness.toFixed(1)}/10`);
	}
	return parts.length > 0 ? parts.join(" · ") : DEFAULT_PAGE_DESCRIPTION;
}

export function AppMetadataDefaults() {
	return (
		<Helmet defaultTitle={DEFAULT_PAGE_TITLE}>
			<meta name="description" content={DEFAULT_PAGE_DESCRIPTION} />
		</Helmet>
	);
}
