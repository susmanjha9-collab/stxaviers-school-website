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
    password TEXT,
    role TEXT DEFAULT 'admin'
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

  // --- Seed Admin Users ---
  const defaultPassword = 'XavierAdmin@2026';
  const admins = [
    'susmanjha9@gmail.com',
    'stxaviersjagatpur@gmail.com'
  ];

  admins.forEach(email => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (!row) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(defaultPassword, salt);
        db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], (err) => {
          if (err) console.error('Error creating admin user:', err);
          else console.log('Admin user seeded:', email);
        });
      }
    });
  });

  // Seed initial content blocks if empty
  db.get('SELECT count(*) as count FROM content', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO content (key, value) VALUES (?, ?)');

      // === SCHOOL IDENTITY ===
      stmt.run('school_name', "St. Xavier's High School");
      stmt.run('school_sub', 'Jagatpur · Cuttack · CBSE Affiliated');
      stmt.run('school_estd', '2017');
      stmt.run('school_affiliation', 'CBSE Affiliated');
      stmt.run('school_classes', 'Nursery to Class VIII');

      // === HERO SECTION ===
      stmt.run('hero_tagline', '"Empowering Minds, Enriching Lives"');
      stmt.run('hero_desc', 'A premier CBSE-affiliated institution committed to academic excellence, character building, and holistic development — shaping the leaders and innovators of tomorrow since 2017.');
      stmt.run('hero_badge', '✦ Admissions Open · 2026-27');
      stmt.run('hero_location', 'Gopabandhu Nagar, Jagatpur · Cuttack, Odisha');

      // === STATS ===
      stmt.run('stat_years', '8');
      stmt.run('stat_students', '200');
      stmt.run('stat_faculty', '30');
      stmt.run('stat_passrate', '100%');

      // === CONTACT INFO ===
      stmt.run('contact_phone', '+91 90406 10680');
      stmt.run('contact_phone2', '');
      stmt.run('contact_email', 'susmanjha9@gmail.com');
      stmt.run('contact_email2', 'stxaviersjagatpur@gmail.com');
      stmt.run('contact_address', 'Gopabandhu Nagar, Jagatpur, Cuttack');
      stmt.run('contact_state', 'Odisha – 754021');
      stmt.run('contact_map_embed', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3742.5!2d85.85!3d20.47!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjDCsDI4JzA5LjIiTiA4NcKwNTEnMDYuMCJF!5e0!3m2!1sen!2sin!4v1610000000000!5m2!1sen!2sin');
      stmt.run('contact_maps_link', 'https://maps.google.com/?q=St+Xavier%27s+High+School+Gopabandhu+Nagar+Jagatpur+Cuttack+Odisha+754021');
      stmt.run('contact_office_hours', '8:00 AM – 4:00 PM, Monday to Saturday');

      // === ABOUT ===
      stmt.run('about_story', "Founded in 2017 with a bold vision of delivering world-class education in Cuttack, St. Xavier's High School, Jagatpur has been shaping young minds with distinction. We blend rich traditional values with modern, innovative teaching methodologies to create a vibrant learning atmosphere where every student discovers their true potential and is prepared to face tomorrow's world with confidence.");
      stmt.run('about_desc', "St. Xavier's High School is a premier CBSE-affiliated institution committed to academic excellence, character building, and holistic development. With modern infrastructure, dedicated faculty, and a student-centred approach, we nurture every child to achieve their fullest potential.");
      stmt.run('about_mission', 'To provide quality education that fosters intellectual, emotional, and social growth in a safe, supportive environment that celebrates every child.');
      stmt.run('about_vision', 'To shape responsible global citizens who are confident, compassionate, and committed to lifelong learning in a rapidly changing world.');
      stmt.run('about_values', 'Integrity, Respect, Excellence, Compassion and Community — the pillars on which every Xavier\'s student proudly stands.');
      stmt.run('about_promise', 'Every child deserves the best — we promise personalised attention, holistic growth, and unwavering support for all our students.');
      stmt.run('principal_quote', '"Education is not just about acquiring knowledge, but also about developing wisdom and integrity. At St. Xavier\'s, we strive to create an environment where students feel inspired, valued, and prepared for the challenges of tomorrow."');
      stmt.run('principal_name', 'Principal, St. Xavier\'s High School, Jagatpur');

      // === TIMINGS ===
      stmt.run('timing_morning_classes', 'Mont-I to Class III · Mon–Sat');
      stmt.run('timing_morning_time', '7:00 AM – 10:30 AM');
      stmt.run('timing_day_classes', 'Class IV to Class VIII · Mon–Sat');
      stmt.run('timing_day_time', '10:45 AM – 2:30 PM');
      stmt.run('timing_office_time', '8:00 AM – 4:00 PM');

      // === ADMISSION ===
      stmt.run('admission_year', '2026-27');
      stmt.run('admission_cta_text', '🎓 Admissions Open 2026-27');

      // === ANNOUNCEMENT TICKER ===
      stmt.run('ticker_text', 'Admissions Open for 2026-27 Session – Apply Now | Annual Sports Meet – December 2025 – A Grand Success! | Olympiad Registrations Now Open – Register Today | New Smart Classrooms Inaugurated for All Students | Result 2026 Now Published – Check the Results Section | Parent-Teacher Meeting Scheduled – Dates in Student Diary');

      stmt.finalize();
      console.log('Seeded all initial text contents');
    }
  });

});

module.exports = db;
