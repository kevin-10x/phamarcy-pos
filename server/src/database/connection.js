import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../pharmacy.db');

let sqlDb = null;
let _initPromise = null;

function prepare(sql) {
  return {
    run(...params) {
      try {
        const stmt = sqlDb.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        stmt.step();
        stmt.free();
        const lr = sqlDb.exec('SELECT last_insert_rowid()');
        const lastInsertRowid = lr[0]?.values[0]?.[0] || 0;
        const changes = sqlDb.getRowsModified();
        save();
        return { changes, lastInsertRowid };
      } catch (e) {
        console.error('SQL Run Error:', e.message);
        throw e;
      }
    },
    get(...params) {
      try {
        const stmt = sqlDb.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          return row;
        }
        stmt.free();
        return undefined;
      } catch (e) {
        console.error('SQL Get Error:', e.message);
        return undefined;
      }
    },
    all(...params) {
      const results = [];
      try {
        const stmt = sqlDb.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          results.push(row);
        }
        stmt.free();
      } catch (e) {
        console.error('SQL All Error:', e.message);
      }
      return results;
    }
  };
}

function exec(sql) {
  try {
    sqlDb.run(sql);
    save();
  } catch (e) {
    console.error('SQL Exec Error:', e.message);
    throw e;
  }
}

function save() {
  if (!sqlDb) return;
  try {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('Save Error:', e.message);
  }
}

function initDb() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(buffer);
    } else {
      sqlDb = new SQL.Database();
    }
    sqlDb.run('PRAGMA foreign_keys = ON');
    return wrappedDb;
  })();

  return _initPromise;
}

const wrappedDb = {
  prepare,
  exec,
  initConnection: initDb,
  save,
  get _sqlDb() { return sqlDb; }
};

export default wrappedDb;
