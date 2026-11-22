import { Console, Effect, Runtime, Schema } from "effect";

/** A command that refused or found nothing: its one line is already printed
 *  to stderr, so the runtime only sets the exit code and logs nothing. */
export class CommandFailed extends Schema.TaggedError<CommandFailed>()(
	"CommandFailed",
	{ line: Schema.String },
) {
	readonly [Runtime.errorReported] = false;

	override get message() {
		return this.line;
	}
}

/** Prints `line` to stderr and fails the command with a non-zero exit. */
export const fail = (line: string) =>
	Console.error(line).pipe(
		Effect.andThen(Effect.fail(new CommandFailed({ line }))),
	);

const UNITS = [
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
] as const;

/** `3 days ago`, `1 hour ago`, `just now`: the largest whole unit. */
export const ago = (then: Date, now: number): string => {
	const elapsed = now - then.getTime();

	for (const [unit, size] of UNITS) {
		const count = Math.floor(elapsed / size);

		if (count >= 1) return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
	}

	return "just now";
};

/** The note under every dry run. */
export const DRY_RUN = "Dry run: nothing written. Add --yes to apply.";
