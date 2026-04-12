const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.NODE_ENV === 'production'
  ? '/tmp/school_data.db'
  : path.join(__dirname, 'school_data.db');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database at:', dbPath);

db.serialize(() => {
  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  // Notifications Table
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    category TEXT,
    desc TEXT,
    date TEXT
  )`);

  // Gallery Table
  db.run(`CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    src TEXT,
    alt TEXT,
    cls TEXT
  )`);

  // Content Blocks Table (key-value storage for customizable text)
  db.run(`CREATE TABLE IF NOT EXISTS content (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Seed Admin User if not exists
  const defaultAdmin = 'susmanjha9@gmail.com';
  const defaultPassword = 'XavierAdmin@2026';
  
  db.get('SELECT * FROM users WHERE email = ?', [defaultAdmin], (err, row) => {
    if (!row) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(defaultPassword, salt);
      db.run('INSERT INTO users (email, password) VALUES (?, ?)', [defaultAdmin, hash], (err) => {
        if (err) console.error('Error creating admin user:', err);
        else console.log('Admin user seeded.');
      });
    }
  });
  
  // Seed initial content blocks if empty
  db.get('SELECT count(*) as count FROM content', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO content (key, value) VALUES (?, ?)');
      stmt.run('school_name', "St. Xavier's High School");
      stmt.run('school_sub', 'Jagatpur · Cuttack · CBSE Affiliated');
      stmt.run('hero_tagline', '"Empowering Minds, Enriching Lives"');
      stmt.run('contact_phone', '+91 90406 10680');
      stmt.run('contact_email', 'susmanjha9@gmail.com');
      stmt.finalize();
      console.log('Seeded initial text contents');
    }
  });

});

module.exports = db;
