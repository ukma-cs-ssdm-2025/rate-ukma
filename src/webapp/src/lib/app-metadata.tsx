import { Helmet } from "react-helmet-async";

export const APP_NAME = "Rate UKMA";
export const DEFAULT_PAGE_TITLE =
	"Rate UKMA - Rate. Review. Discover your best courses at NaUKMA";
export const DEFAULT_PAGE_DESCRIPTION =
	"Rate UKMA is a web platform for NaUKMA students to share course reviews and ratings. Discover your best courses with interactive analytics and anonymous feedback.";

export function formatPageTitle(title: string) {
	return `${title} | ${APP_NAME}`;
}

export function AppMetadataDefaults() {
	return (
		<Helmet defaultTitle={DEFAULT_PAGE_TITLE}>
			<meta name="description" content={DEFAULT_PAGE_DESCRIPTION} />
		</Helmet>
	);
}
