import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/trade-memory.functions-BfWlhgpo.js
var _0002_trade_learning_default = "CREATE TABLE IF NOT EXISTS trade_learning_events (\n  id TEXT PRIMARY KEY,\n  symbol TEXT NOT NULL,\n  chain TEXT NOT NULL,\n  venue TEXT NOT NULL,\n  entry_price DOUBLE PRECISION NOT NULL,\n  exit_price DOUBLE PRECISION NOT NULL,\n  qty DOUBLE PRECISION NOT NULL,\n  pnl DOUBLE PRECISION NOT NULL,\n  score DOUBLE PRECISION NOT NULL,\n  change_24h DOUBLE PRECISION NOT NULL,\n  liquidity_usd DOUBLE PRECISION NOT NULL,\n  volume_24h DOUBLE PRECISION NOT NULL,\n  pair_age_hours DOUBLE PRECISION,\n  mode TEXT NOT NULL,\n  reason TEXT NOT NULL,\n  opened_at BIGINT NOT NULL,\n  closed_at BIGINT NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS trade_learning_events_closed_at_idx\n  ON trade_learning_events (closed_at DESC);\nCREATE INDEX IF NOT EXISTS trade_learning_events_symbol_idx\n  ON trade_learning_events (symbol);\n\nCREATE TABLE IF NOT EXISTS trade_learning_state (\n  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),\n  seen INTEGER NOT NULL DEFAULT 0,\n  wins INTEGER NOT NULL DEFAULT 0,\n  losses INTEGER NOT NULL DEFAULT 0,\n  realized DOUBLE PRECISION NOT NULL DEFAULT 0,\n  min_score DOUBLE PRECISION NOT NULL DEFAULT 62\n);\n\nDO $$\nBEGIN\n  IF to_regclass('public.winning_trades') IS NOT NULL THEN\n    INSERT INTO trade_learning_events (\n      id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,\n      change_24h, liquidity_usd, volume_24h, pair_age_hours, mode, reason,\n      opened_at, closed_at\n    )\n    SELECT\n      id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,\n      0, 0, 0, NULL, mode, reason, closed_at, closed_at\n    FROM public.winning_trades\n    ON CONFLICT (id) DO NOTHING;\n  END IF;\nEND $$;\n\nINSERT INTO trade_learning_state (singleton, seen, wins, losses, realized, min_score)\nSELECT\n  TRUE,\n  COUNT(*)::INTEGER,\n  COUNT(*) FILTER (WHERE pnl > 0)::INTEGER,\n  COUNT(*) FILTER (WHERE pnl < 0)::INTEGER,\n  COALESCE(SUM(pnl), 0),\n  62\nFROM trade_learning_events\nON CONFLICT (singleton) DO NOTHING;\n";
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
var databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : void 0;
/**
* Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
* sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
* the app has a working database even with nothing configured — the live preview
* included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
*/
var dbSource = databaseUrl ? "neon" : "pglite";
/**
* Init state lives on globalThis as promises: dev HMR creates new instances of
* this module, and two instances racing module-level state would open a second
* pool or run two concurrent PGLite migration passes (whose duplicate
* `_migrations` insert rejects — and would get memoized, poisoning every later
* `getSql()`). A failed init clears its slot so the next call retries.
*/
var globalRef = globalThis;
/**
* Result-type parity: Postgres sends every value as text plus a type OID — the
* JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
* int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
* JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
* production return identical, JSON-safe shapes:
*   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
*                                   `::text` if you ever need huge integers)
*   date                         -> 'YYYY-MM-DD' string
*   interval                     -> Postgres interval text
* numeric already comes back as a string on both (arbitrary precision).
*/
var OID_INT8 = 20;
var OID_DATE = 1082;
var OID_INTERVAL = 1186;
var identity = (v) => v;
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function createNeonSql() {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({ connectionString: databaseUrl });
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite("memory://", { parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = /* #__PURE__ */ Object.assign({ "/migrations/0002_trade_learning.sql": _0002_trade_learning_default });
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
var sqlPromise = null;
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (dbSource !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var globalBoot = globalThis;
if (typeof window === "undefined" && dbSource === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
	globalBoot.__pgBootstrapPromise__ = void 0;
	console.error("[db] PGLite bootstrap failed:", err);
	throw err;
});
function normalizeTrade(input) {
	if ([
		input.id,
		input.symbol,
		input.chain,
		input.venue,
		input.reason
	].some((value) => typeof value !== "string" || value.trim() === "")) throw new Error("Trade learning records require non-empty identity fields.");
	if (input.id.length > 128 || input.symbol.length > 32 || input.chain.length > 32 || input.venue.length > 64 || input.reason.length > 32) throw new Error("Trade learning record contains an overlong identity field.");
	if (input.mode !== "demo" && input.mode !== "live") throw new Error("Trade learning record mode is invalid.");
	if ([
		input.entryPrice,
		input.exitPrice,
		input.qty,
		input.pnl,
		input.score,
		input.change24h,
		input.liquidityUsd,
		input.volume24h,
		input.openedAt,
		input.closedAt
	].some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new Error("Trade learning records require finite numeric values.");
	if (input.pairAgeHours !== null && (typeof input.pairAgeHours !== "number" || !Number.isFinite(input.pairAgeHours))) throw new Error("Trade learning record pair age must be finite or null.");
	if (input.entryPrice < 0 || input.exitPrice < 0 || input.qty < 0 || input.liquidityUsd < 0 || input.volume24h < 0 || input.score < 0 || input.score > 100) throw new Error("Trade learning record contains an out-of-range value.");
	return {
		...input,
		id: input.id.trim(),
		symbol: input.symbol.trim().slice(0, 32),
		chain: input.chain.trim().slice(0, 32),
		venue: input.venue.trim().slice(0, 64),
		reason: input.reason.trim().slice(0, 32)
	};
}
function learningState(row) {
	return {
		seen: Number(row.seen),
		wins: Number(row.wins),
		losses: Number(row.losses),
		realized: Number(row.realized),
		minScore: Number(row.min_score),
		dbSource
	};
}
var saveTradeLearning_createServerFn_handler = createServerRpc({
	id: "df931aaa15b0ca2a670f99e20b9f4cf68d6405d79b2c0ac23f2004cfbe72e665",
	name: "saveTradeLearning",
	filename: "src/lib/trade-memory.functions.ts"
}, (opts) => saveTradeLearning.__executeServer(opts));
var saveTradeLearning = createServerFn({ method: "POST" }).validator(normalizeTrade).handler(saveTradeLearning_createServerFn_handler, async ({ data }) => {
	const row = (await (await getSql())`
      WITH inserted AS (
        INSERT INTO trade_learning_events (
          id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,
          change_24h, liquidity_usd, volume_24h, pair_age_hours, mode, reason,
          opened_at, closed_at
        ) VALUES (
          ${data.id}, ${data.symbol}, ${data.chain}, ${data.venue},
          ${data.entryPrice}, ${data.exitPrice}, ${data.qty}, ${data.pnl},
          ${data.score}, ${data.change24h}, ${data.liquidityUsd},
          ${data.volume24h}, ${data.pairAgeHours}, ${data.mode}, ${data.reason},
          ${data.openedAt}, ${data.closedAt}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING pnl
      ),
      updated AS (
        INSERT INTO trade_learning_state (
          singleton, seen, wins, losses, realized, min_score
        )
        SELECT
          TRUE, 1, (pnl > 0)::INTEGER, (pnl < 0)::INTEGER, pnl, 62
        FROM inserted
        ON CONFLICT (singleton) DO UPDATE SET
          seen = trade_learning_state.seen + 1,
          wins = trade_learning_state.wins + EXCLUDED.wins,
          losses = trade_learning_state.losses + EXCLUDED.losses,
          realized = trade_learning_state.realized + EXCLUDED.realized,
          min_score = CASE
            WHEN trade_learning_state.seen + 1 < 4 THEN trade_learning_state.min_score
            WHEN (trade_learning_state.wins + EXCLUDED.wins)::DOUBLE PRECISION /
              (trade_learning_state.seen + 1) < 0.4
              OR trade_learning_state.realized + EXCLUDED.realized < 0
              THEN LEAST(85, 62 + 2 * (trade_learning_state.seen + 1 - 3))
            WHEN (trade_learning_state.wins + EXCLUDED.wins)::DOUBLE PRECISION /
              (trade_learning_state.seen + 1) > 0.55
              AND trade_learning_state.realized + EXCLUDED.realized > 0
              THEN GREATEST(55, 62 - (trade_learning_state.seen + 1 - 3))
            ELSE 62
          END
        RETURNING seen, wins, losses, realized, min_score
      )
      SELECT TRUE AS inserted, seen, wins, losses, realized, min_score
      FROM updated
      UNION ALL
      SELECT FALSE AS inserted, seen, wins, losses, realized, min_score
      FROM trade_learning_state
      WHERE singleton = TRUE AND NOT EXISTS (SELECT 1 FROM inserted)
    `)[0];
	if (!row) throw new Error("Trade learning write completed without a state result.");
	return {
		inserted: row.inserted,
		state: learningState(row)
	};
});
var getTradeLearningState_createServerFn_handler = createServerRpc({
	id: "3c55afbe456a51eaeaa8677774bae3c9c711aa301f02f6f07db34b45ff15aebb",
	name: "getTradeLearningState",
	filename: "src/lib/trade-memory.functions.ts"
}, (opts) => getTradeLearningState.__executeServer(opts));
var getTradeLearningState = createServerFn({ method: "GET" }).handler(getTradeLearningState_createServerFn_handler, async () => {
	const row = (await (await getSql())`
    SELECT seen, wins, losses, realized, min_score
    FROM trade_learning_state
    WHERE singleton = TRUE
  `)[0];
	if (!row) throw new Error("Trade learning state has not been initialized by the database migration.");
	return learningState(row);
});
//#endregion
export { getTradeLearningState_createServerFn_handler, saveTradeLearning_createServerFn_handler };
