import { Schema } from "effect";

/** Every product event the SPA reports, in the order of the student's flow:
 *  arrive, get a plan from the ІНП, shape it, lock it, take it with them.
 *  The server accepts no other name into `events`, so adding one starts here. */
export const TELEMETRY_EVENTS = [
	// Arrive
	"sign_in",
	"sign_out",
	// The ІНП becomes a plan: once per student and semester
	"inp_resolved",
	// Shape the plan
	"group_chosen",
	"discipline_added",
	"discipline_hidden",
	"inp_bound",
	"stream_switched",
	// Look around: week, clashes-only, or one discipline at a time
	"week_switched",
	"view_switched",
	"solo_changed",
	"lesson_moved",
	"custom_lesson_saved",
	"custom_lesson_removed",
	"plan_reset",
	// Catch up with what the faculty changed since the last visit
	"changes_opened",
	"changes_seen",
	// Persist
	"plan_saved",
	"save_failed",
	// Settle
	"plan_locked",
	"plan_unlocked",
	// Take it along
	"calendar_opened",
	"ics_exported",
	"plan_copied",
] as const;
export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

/** Numbers worth a distribution rather than a count. They travel as events
 *  too, with the number in `props.value`. */
export const TELEMETRY_MEASURES = [
	"plan.disciplines",
	"plan.remaining",
	"inp.unpublished",
	"inp.alternatives",
] as const;
export type TelemetryMeasure = (typeof TELEMETRY_MEASURES)[number];

export const TelemetryName = Schema.Literals([
	...TELEMETRY_EVENTS,
	...TELEMETRY_MEASURES,
]);
export type TelemetryName = typeof TelemetryName.Type;
