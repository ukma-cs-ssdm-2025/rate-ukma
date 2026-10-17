import type { SqlClient } from "effect/sql";

/** Rows sent as one `jsonb` value. `columns` names every key of the row with
 *  its Postgres type, so the compiler keeps the two in step: a key missing
 *  from the record set would read as null. */
export const recordsetOf =
	(sql: SqlClient.SqlClient) =>
	<T extends object>(
		rows: ReadonlyArray<T>,
		columns: { readonly [K in keyof T]-?: string },
		alias = "r",
	) =>
		sql`jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS ${sql(alias)}(${sql.unsafe(
			Object.entries(columns)
				.map(([key, type]) => `"${key}" ${type}`)
				.join(", "),
		)})`;
