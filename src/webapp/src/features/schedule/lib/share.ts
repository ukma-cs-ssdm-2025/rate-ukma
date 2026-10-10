import { CustomLessons, Overrides } from "@/features/schedule/core";
import { Schema } from "effect";

/** What POST /api/me/plan/share answers: the active read-only link token. */
export const ShareTokenResponse = Schema.Struct({ token: Schema.String });
export interface ShareTokenResponse extends Schema.Schema.Type<
	typeof ShareTokenResponse
> {}

const decodeShareTokenSync = Schema.decodeUnknownSync(ShareTokenResponse);

/** What GET /api/shared/:token publishes: the timetable and nothing private. */
export const SharedPlan = Schema.Struct({
	semesterName: Schema.String,
	plan: Schema.Struct({
		picked: Schema.Array(Schema.String),
		selection: Schema.Record(Schema.String, Schema.String),
		hidden: Schema.Array(Schema.String),
		shortNames: Schema.Boolean,
		overrides: Schema.optionalKey(Overrides),
		custom: Schema.optionalKey(CustomLessons),
	}),
	owner: Schema.String,
});
export interface SharedPlan extends Schema.Schema.Type<typeof SharedPlan> {}

const decodeSharedSync = Schema.decodeUnknownSync(SharedPlan);

/** Create the read-only link, or read the active one back. */
export const createShareLink = async (semester?: string): Promise<string> => {
	const path =
		semester === undefined
			? "/api/schedule/me/plan/share"
			: `/api/schedule/me/plan/share?${new URLSearchParams({ semester }).toString()}`;
	const response = await fetch(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: "{}",
	});
	if (!response.ok)
		throw new Error(`Не вдалося створити посилання: ${response.status}`);
	return decodeShareTokenSync(await response.json()).token;
};

/** Replace the active link with a fresh token. */
export const rotateShareLink = async (semester?: string): Promise<string> => {
	const path =
		semester === undefined
			? "/api/schedule/me/plan/share"
			: `/api/schedule/me/plan/share?${new URLSearchParams({ semester }).toString()}`;
	const response = await fetch(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: '{"rotate":true}',
	});
	if (!response.ok)
		throw new Error(`Не вдалося оновити посилання: ${response.status}`);
	return decodeShareTokenSync(await response.json()).token;
};

/** Drop the active link; viewing it 404s from then on. */
export const revokeShareLink = async (semester?: string): Promise<void> => {
	const path =
		semester === undefined
			? "/api/schedule/me/plan/share"
			: `/api/schedule/me/plan/share?${new URLSearchParams({ semester }).toString()}`;
	const response = await fetch(path, { method: "DELETE" });
	if (!response.ok)
		throw new Error(`Не вдалося скасувати доступ: ${response.status}`);
};

/** null = no such link. Any other failure throws. */
export const fetchSharedPlan = async (
	token: string,
): Promise<SharedPlan | null> => {
	const response = await fetch(
		`/api/schedule/shared/${encodeURIComponent(token)}`,
	);
	if (response.status === 404) return null;
	if (!response.ok)
		throw new Error(`Не вдалося завантажити розклад: ${response.status}`);
	return decodeSharedSync(await response.json());
};

/** The URL the student hands out: `${origin}/#/s/${token}`. */
export const shareUrlOf = (token: string): string =>
	`${window.location.origin}/#/s/${token}`;

/** The link token when the address bar opens a shared timetable. */
export const sharedTokenOf = (hash: string): string | undefined => {
	const match = /^#\/s\/([^/?#]+)$/u.exec(hash);
	return match?.[1] === undefined ? undefined : decodeURIComponent(match[1]);
};
