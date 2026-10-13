import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/trade-memory.functions-D5t2cLuk.js
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
		const pg = new PGlite({ parsers: {
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
		const migrations = /* #__PURE__ */ Object.assign({});
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
var tableInitialized = false;
async function ensureTable(sql) {
	if (tableInitialized) return;
	await sql`
    CREATE TABLE IF NOT EXISTS winning_trades (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      chain TEXT NOT NULL,
      venue TEXT NOT NULL,
      entry_price NUMERIC NOT NULL,
      exit_price NUMERIC NOT NULL,
      qty NUMERIC NOT NULL,
      pnl NUMERIC NOT NULL,
      roi_pct NUMERIC NOT NULL,
      volatility NUMERIC NOT NULL,
      atr NUMERIC NOT NULL,
      score NUMERIC NOT NULL,
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      mode TEXT NOT NULL DEFAULT 'demo',
      reason TEXT NOT NULL,
      closed_at BIGINT NOT NULL
    );
  `;
	await sql`CREATE INDEX IF NOT EXISTS idx_winning_trades_symbol ON winning_trades(symbol);`;
	await sql`CREATE INDEX IF NOT EXISTS idx_winning_trades_pnl ON winning_trades(pnl);`;
	await sql`CREATE INDEX IF NOT EXISTS idx_winning_trades_closed_at ON winning_trades(closed_at DESC);`;
	tableInitialized = true;
}
var saveWinningTrade_createServerFn_handler = createServerRpc({
	id: "031a57b1681ed27142c8bb51c37b8aabd349975df451a6d9576849dc879c1664",
	name: "saveWinningTrade",
	filename: "src/lib/trade-memory.functions.ts"
}, (opts) => saveWinningTrade.__executeServer(opts));
var saveWinningTrade = createServerFn({ method: "POST" }).validator((input) => ({
	id: String(input.id || `tr-${Date.now()}`),
	symbol: String(input.symbol || "UNKNOWN").slice(0, 32),
	chain: String(input.chain || "solana").slice(0, 32),
	venue: String(input.venue || "Raydium CLMM").slice(0, 32),
	entryPrice: Number(input.entryPrice) || 0,
	exitPrice: Number(input.exitPrice) || 0,
	qty: Number(input.qty) || 0,
	pnl: Number(input.pnl) || 0,
	volatility: Number(input.volatility) || .02,
	atr: Number(input.atr) || 0,
	score: Number(input.score) || 75,
	features: Array.isArray(input.features) ? input.features.map(Number) : [],
	mode: String(input.mode || "demo"),
	reason: String(input.reason || "TARGET"),
	closedAt: Number(input.closedAt) || Date.now()
})).handler(saveWinningTrade_createServerFn_handler, async ({ data }) => {
	try {
		const sql = await getSql();
		await ensureTable(sql);
		const roiPct = data.entryPrice > 0 ? (data.exitPrice - data.entryPrice) / data.entryPrice * 100 : 0;
		await sql`
        INSERT INTO winning_trades (
          id, symbol, chain, venue, entry_price, exit_price, qty,
          pnl, roi_pct, volatility, atr, score, features, mode, reason, closed_at
        ) VALUES (
          ${data.id}, ${data.symbol}, ${data.chain}, ${data.venue},
          ${data.entryPrice}, ${data.exitPrice}, ${data.qty},
          ${data.pnl}, ${roiPct}, ${data.volatility}, ${data.atr},
          ${data.score}, ${JSON.stringify(data.features)}, ${data.mode},
          ${data.reason}, ${data.closedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
		return {
			ok: true,
			id: data.id
		};
	} catch (err) {
		console.error("[trade-memory] Failed to store winning trade:", err);
		return {
			ok: false,
			error: err instanceof Error ? err.message : "DB error"
		};
	}
});
var getWinningTradeMemories_createServerFn_handler = createServerRpc({
	id: "ae848c9fdb352500567383efa86c7719bbc7756d7c3fe72892bdf65641d33dd3",
	name: "getWinningTradeMemories",
	filename: "src/lib/trade-memory.functions.ts"
}, (opts) => getWinningTradeMemories.__executeServer(opts));
var getWinningTradeMemories = createServerFn({ method: "POST" }).validator((input) => ({ limit: Math.max(1, Math.min(100, Number(input?.limit || 20))) })).handler(getWinningTradeMemories_createServerFn_handler, async ({ data }) => {
	try {
		const sql = await getSql();
		await ensureTable(sql);
		const rows = await sql`
        SELECT * FROM winning_trades
        ORDER BY closed_at DESC
        LIMIT ${data.limit}
      `;
		const countResult = await sql`
        SELECT COUNT(*) as count FROM winning_trades
      `;
		const totalStored = Number(countResult[0]?.count ?? 0);
		return {
			memories: rows.map((r) => ({
				id: String(r.id),
				symbol: String(r.symbol),
				chain: String(r.chain),
				venue: String(r.venue),
				entryPrice: Number(r.entry_price),
				exitPrice: Number(r.exit_price),
				qty: Number(r.qty),
				pnl: Number(r.pnl),
				roiPct: Number(r.roi_pct),
				volatility: Number(r.volatility),
				atr: Number(r.atr),
				score: Number(r.score),
				features: typeof r.features === "string" ? JSON.parse(r.features) : r.features ?? [],
				mode: String(r.mode),
				reason: String(r.reason),
				closedAt: Number(r.closed_at)
			})),
			totalStored
		};
	} catch (err) {
		console.error("[trade-memory] Failed to load winning memories:", err);
		return {
			memories: [],
			totalStored: 0
		};
	}
});
var getTradeAnalytics_createServerFn_handler = createServerRpc({
	id: "1a8da7c17aa40737e3886e1b418b8a9974c57f30513801c36db0d4a4859c0471",
	name: "getTradeAnalytics",
	filename: "src/lib/trade-memory.functions.ts"
}, (opts) => getTradeAnalytics.__executeServer(opts));
var getTradeAnalytics = createServerFn({ method: "POST" }).handler(getTradeAnalytics_createServerFn_handler, async () => {
	try {
		const sql = await getSql();
		await ensureTable(sql);
		const summary = await sql`
        SELECT
          COUNT(*) as total_wins,
          COALESCE(SUM(pnl), 0) as total_profit,
          COALESCE(AVG(pnl), 0) as avg_win,
          COALESCE(MAX(roi_pct), 0) as highest_roi
        FROM winning_trades
        WHERE pnl > 0
      `;
		const topSyms = await sql`
        SELECT
          symbol,
          COUNT(*) as count,
          SUM(pnl) as total_pnl
        FROM winning_trades
        GROUP BY symbol
        ORDER BY total_pnl DESC
        LIMIT 5
      `;
		const row = summary[0];
		return {
			totalWins: Number(row?.total_wins ?? 0),
			totalProfit: Number(row?.total_profit ?? 0),
			avgWin: Number(row?.avg_win ?? 0),
			highestRoi: Number(row?.highest_roi ?? 0),
			topSymbols: topSyms.map((s) => ({
				symbol: String(s.symbol),
				count: Number(s.count),
				totalPnl: Number(s.total_pnl)
			}))
		};
	} catch (err) {
		console.error("[trade-memory] Analytics query failed:", err);
		return {
			totalWins: 0,
			totalProfit: 0,
			avgWin: 0,
			highestRoi: 0,
			topSymbols: []
		};
	}
});
//#endregion
export { getTradeAnalytics_createServerFn_handler, getWinningTradeMemories_createServerFn_handler, saveWinningTrade_createServerFn_handler };
