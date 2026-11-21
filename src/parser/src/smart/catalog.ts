import { createHash } from "node:crypto";
import { Result, Schema } from "effect";

/** Why a stored smart.ukma list did not decode. `reason` names the list and
 *  a key at most, never a value: the lists hold names and emails. */
export class SmartListError extends Schema.TaggedError<SmartListError>()(
	"SmartListError",
	{ reason: Schema.String },
) {}

const OptionalText = Schema.optional(Schema.NullOr(Schema.String));

const OptionalId = Schema.optional(Schema.NullOr(Schema.Int));

const ListOf = <S extends Schema.Top>(item: S) =>
	Schema.fromJsonString(Schema.Struct({ items: Schema.Array(item) }));

const Department = Schema.Struct({ id: Schema.Int, nameUa: Schema.String });

const Teacher = Schema.Struct({
	id: Schema.Int,
	lastName: Schema.String,
	firstName: Schema.String,
	middleName: OptionalText,
	email: OptionalText,
	departmentId: OptionalId,
	departmentName: OptionalText,
});

const Discipline = Schema.Struct({
	id: Schema.Int,
	titleUa: Schema.String,
	departmentId: OptionalId,
	ectsLoans: Schema.Number,
	semesterOfTeaching: Schema.Int.check(
		Schema.isBetween({ minimum: 1, maximum: 12 }),
	),
	curriculums: Schema.Array(
		Schema.Struct({
			curriculum: Schema.Struct({
				yearOfEntrance: Schema.Struct({ start: Schema.Int }),
				educationProgram: Schema.optional(
					Schema.Struct({ programLevel: OptionalText }),
				),
			}),
		}),
	),
});

const TeacherRole = Schema.Literals([
	"LECTURER",
	"PRACTICE_TEACHER",
	"LECTURER_AND_PRACTICE_TEACHER",
]);

export type TeacherRole = typeof TeacherRole.Type;

/** One row of `/api/teacher/disciplines`: its `id` is the key of the link,
 *  the discipline, the teacher and the teacher's role in it. */
const Link = Schema.Struct({
	id: Schema.Struct({
		disciplineId: Schema.Int,
		teacherId: Schema.Int,
		teacherRole: TeacherRole,
	}),
});

export interface SmartLists {
	readonly departments: string;
	readonly teachers: string;
	readonly disciplines: string;
	readonly links: string;
}

export interface InstructorRow {
	readonly smartId: number;
	readonly lastName: string;
	readonly firstName: string;
	readonly middleName: string | null;
	readonly email: string | null;
	readonly smartDepartmentId: number | null;
	readonly departmentName: string | null;
	readonly rowHash: string;
}

export interface DisciplineTeacher {
	readonly smartId: number;
	readonly role: TeacherRole;
}

export interface DisciplineRow {
	readonly smartId: number;
	readonly title: string;
	readonly smartDepartmentId: number | null;
	readonly departmentName: string | null;
	readonly credits: number;
	readonly semester: number;
	readonly entranceYear: number | null;
	readonly academicYear: number | null;
	readonly season: "FALL" | "SPRING" | "SUMMER" | null;
	readonly level: "bachelor" | "master" | null;
	readonly teachers: ReadonlyArray<DisciplineTeacher>;
	readonly rowHash: string;
}

const SEASONS = ["FALL", "SPRING", "SUMMER"] as const;

/** smart.ukma counts three terms a study year: 1 to 3 is the first year's
 *  fall, spring and summer. The academic year is the curriculum's entrance
 *  year plus the study year, less one. */
export const termOf = (semester: number, entranceYear: number | null) => {
	const studyYear = Math.floor((semester - 1) / 3) + 1;

	return {
		academicYear: entranceYear === null ? null : entranceYear + studyYear - 1,
		season: SEASONS[(semester - 1) % 3] ?? null,
	};
};

const levelOf = (
	programLevel: string | null | undefined,
): DisciplineRow["level"] => {
	if (programLevel === "BACHELOR") {
		return "bachelor";
	}

	return programLevel === "MASTER" ? "master" : null;
};

const textOrNull = (value: string | null | undefined): string | null => {
	const text = value?.trim() ?? "";

	return text === "" ? null : text;
};

const hashOf = (
	row: Omit<InstructorRow, "rowHash"> | Omit<DisciplineRow, "rowHash">,
): string => createHash("sha256").update(JSON.stringify(row)).digest("hex");

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(
	schema: S,
	list: string,
	content: string,
) =>
	Schema.decodeUnknownResult(schema)(content).pipe(
		Result.mapError(() => new SmartListError({ reason: `invalid ${list}` })),
	);

/** The rows the four stored lists give. A teacher link to a discipline
 *  missing from the list is dropped; one to a missing teacher is kept, since
 *  the teacher list may lag. A discipline's level comes from its first
 *  curriculum's programme; `PHD` and `ALL` give none. */
export const smartRowsOf = (
	lists: SmartLists,
): Result.Result<
	{
		readonly instructors: ReadonlyArray<InstructorRow>;
		readonly disciplines: ReadonlyArray<DisciplineRow>;
	},
	SmartListError
> =>
	Result.gen(function* () {
		const departments = yield* decode(
			ListOf(Department),
			"departments",
			lists.departments,
		);

		const teachers = yield* decode(ListOf(Teacher), "teachers", lists.teachers);

		const disciplines = yield* decode(
			ListOf(Discipline),
			"disciplines",
			lists.disciplines,
		);

		const links = yield* decode(ListOf(Link), "links", lists.links);

		const departmentName = new Map(
			departments.items.map(({ id, nameUa }) => [id, nameUa]),
		);

		const teachersOf = new Map<number, Array<DisciplineTeacher>>();

		for (const { id } of links.items) {
			const teachers = teachersOf.get(id.disciplineId) ?? [];

			teachers.push({ smartId: id.teacherId, role: id.teacherRole });
			teachersOf.set(id.disciplineId, teachers);
		}

		const instructors = teachers.items.map((teacher) => {
			const row = {
				smartId: teacher.id,
				lastName: teacher.lastName.trim(),
				firstName: teacher.firstName.trim(),
				middleName: textOrNull(teacher.middleName),
				email: textOrNull(teacher.email)?.toLowerCase() ?? null,
				smartDepartmentId: teacher.departmentId ?? null,
				departmentName: textOrNull(teacher.departmentName),
			};

			return { ...row, rowHash: hashOf(row) };
		});

		return {
			instructors,
			disciplines: disciplines.items.map((discipline) => {
				const curriculum = discipline.curriculums[0]?.curriculum;
				const entranceYear = curriculum?.yearOfEntrance.start ?? null;

				const departmentId = discipline.departmentId ?? null;

				const row = {
					smartId: discipline.id,
					title: discipline.titleUa.trim(),
					smartDepartmentId: departmentId,
					departmentName:
						departmentId === null
							? null
							: (departmentName.get(departmentId) ?? null),
					credits: discipline.ectsLoans,
					semester: discipline.semesterOfTeaching,
					entranceYear,
					...termOf(discipline.semesterOfTeaching, entranceYear),
					level: levelOf(curriculum?.educationProgram?.programLevel),
					teachers: [...(teachersOf.get(discipline.id) ?? [])].sort(
						(a, b) => a.smartId - b.smartId || a.role.localeCompare(b.role),
					),
				};

				return { ...row, rowHash: hashOf(row) };
			}),
		};
	});
