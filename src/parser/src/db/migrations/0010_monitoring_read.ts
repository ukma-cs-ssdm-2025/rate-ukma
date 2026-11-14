import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/**
 * Lets Postgres' built-in monitoring role read the crawl tables, so a metrics exporter can report
 * crawl health. On the cluster that is CloudNativePG's cnpg_metrics_exporter, a pg_monitor member
 * that runs the queries in infra/deploy/parser/k8s/platform/database/queries.yaml.
 * page_snapshots stays unreadable to it: its content holds student lists.
 */
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`GRANT SELECT ON runs, run_pages TO pg_monitor`;
});
