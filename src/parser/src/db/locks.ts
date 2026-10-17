/** Postgres advisory lock keys. Keys are shared by everything that connects
 *  to the database, so each one is declared here and nowhere else. */

/** Held by the crawl for its whole run: two crawls would reset each other's
 *  claimed pages. */
export const CRAWL_LOCK = 1;

/** Held by an offering write until it commits: two writers would plan the same
 *  inserts. */
export const WRITE_LOCK = 2;
