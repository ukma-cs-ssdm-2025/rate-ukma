/** Postgres advisory lock keys. Keys are shared by everything that connects
 *  to the database, so each one is declared here and nowhere else. */

/** Held by the crawl for its whole run: two crawls would reset each other's
 *  claimed pages. */
export const CRAWL_LOCK = 1;

/** The writers' turn (`ChangeLog.withTurn`), held by every write of numbered
 *  rows until it commits: numbers then commit in order, and two writers never
 *  plan the same inserts. The `require_turn` trigger checks for it. */
export const TURN_LOCK = 2;
