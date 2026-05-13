const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'app.db');

let db;

async function initDb() {
  const SQL = await initSqlJs();

  // 如果已有数据库文件则加载，否则创建新的
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS answer_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      selected_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_answer_user_question ON answer_records(user_id, question_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_answer_user_correct ON answer_records(user_id, is_correct)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      category TEXT,
      total INTEGER,
      correct INTEGER,
      finished_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 动态生成的题目
  db.run(`
    CREATE TABLE IF NOT EXISTS generated_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      category_name TEXT NOT NULL,
      difficulty INTEGER DEFAULT 3,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT,
      answer TEXT NOT NULL,
      explanation TEXT,
      source_url TEXT,
      product_name TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_genq_category ON generated_questions(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_genq_product ON generated_questions(product_name)`);

  // 用户对题目的反馈/打标
  db.run(`
    CREATE TABLE IF NOT EXISTS question_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      flag_type TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_question ON question_feedback(question_id)`);

  // 云产品对比报告缓存
  db.run(`
    CREATE TABLE IF NOT EXISTS comparison_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_key TEXT NOT NULL,
      report_json TEXT NOT NULL,
      aliyun_source_url TEXT,
      tencent_source_url TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compare_product ON comparison_reports(product_key)`);

  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb, saveDb };
