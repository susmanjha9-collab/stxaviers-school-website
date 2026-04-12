const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('./database');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'st_xaviers_super_secret_key'; // In prod, use environment variable

app.use(cors());
app.use(express.json());

// Set up image uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Serve static frontend
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

/* ─── AUTH MIDDLEWARE ─── */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

/* ─── API: LOGIN ─── */
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ email: user.email, id: user.id }, SECRET_KEY, { expiresIn: '24h' });
      res.json({ token, message: 'Login successful' });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

/* ─── API: CONTENT BLOCKS ─── */
app.get('/api/content', (req, res) => {
  db.all('SELECT * FROM content', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const contentMap = {};
    rows.forEach(r => contentMap[r.key] = r.value);
    res.json(contentMap);
  });
});

app.put('/api/content', authenticateJWT, (req, res) => {
  const items = req.body; // Expects object { key: value, ... }
  const stmt = db.prepare('INSERT INTO content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  Object.keys(items).forEach(key => {
    stmt.run(key, items[key]);
  });
  stmt.finalize();
  res.json({ success: true });
});

/* ─── API: NOTIFICATIONS ─── */
app.get('/api/notifications', (req, res) => {
  db.all('SELECT * FROM notifications ORDER BY id DESC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/notifications', authenticateJWT, (req, res) => {
  const { title, category, desc, date } = req.body;
  db.run('INSERT INTO notifications (title, category, desc, date) VALUES (?, ?, ?, ?)', [title, category, desc, date], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ id: this.lastID });
  });
});

app.delete('/api/notifications/:id', authenticateJWT, (req, res) => {
  db.run('DELETE FROM notifications WHERE id = ?', [req.params.id], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

/* ─── API: GALLERY ─── */
app.get('/api/gallery', (req, res) => {
  db.all('SELECT * FROM gallery ORDER BY id DESC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/gallery', authenticateJWT, upload.single('image'), (req, res) => {
  const file = req.file;
  const { alt, cls } = req.body;
  if (!file) return res.status(400).json({ error: 'No image uploaded' });
  const src = '/uploads/' + file.filename;
  
  db.run('INSERT INTO gallery (src, alt, cls) VALUES (?, ?, ?)', [src, alt, cls || ''], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ id: this.lastID, src });
  });
});

app.delete('/api/gallery/:id', authenticateJWT, (req, res) => {
  db.get('SELECT src FROM gallery WHERE id = ?', [req.params.id], (err, row) => {
    if (row && row.src.startsWith('/uploads/')) {
      const fp = path.join(__dirname, row.src);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.run('DELETE FROM gallery WHERE id = ?', [req.params.id], (err) => {
      res.json({ success: true });
    });
  });
});

/* ─── API: ADMISSION EMAIL ─── */
app.post('/api/apply', async (req, res) => {
  const data = req.body;
  const toEmail = 'susmanjha9@gmail.com, stxaviersjagatpur@gmail.com';
  const fromEmail = 'susmanjha9@gmail.com';
  
  // Create transporter dynamically based on what user will configure later.
  // For now, we will simulate a success response but log that real SMTP config is needed.
  // We use standard placeholder config so they can just update environment variables later.
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || fromEmail,
      pass: process.env.SMTP_PASS || 'your_app_password_here'
    }
  });

  const mailOptions = {
    from: '"St. Xavier\'s Website Form" <no-reply@stxaviersjagatpur.com>',
    to: toEmail,
    subject: `Admission Application – ${data.fFirstName} ${data.fLastName} (${data.fClass}) – 2026-27`,
    text: `
=== ST. XAVIER'S HIGH SCHOOL, JAGATPUR ===
ADMISSION APPLICATION FORM – 2026-27
==========================================

--- STUDENT DETAILS ---
Name: ${data.fFirstName} ${data.fLastName}
Date of Birth: ${data.fDOB}
Gender: ${data.fGender}
Class Applying For: ${data.fClass}
Previous School: ${data.fPrevSchool || 'N/A'}
Previous Class: ${data.fPrevClass || 'N/A'}
Student Aadhar: ${data.fStudAadhar}

--- PARENT / GUARDIAN DETAILS ---
Father's Name: ${data.fFather}
Mother's Name: ${data.fMother}
Father's Occupation: ${data.fFOccup || 'N/A'}
Mother's Occupation: ${data.fMOccup || 'N/A'}
Contact (Father): ${data.fPhone}
Alternate Contact: ${data.fPhone2 || 'N/A'}
Email: ${data.fEmail}
Parent Aadhar: ${data.fParentAadhar}

--- ADDRESS ---
${data.fAddress}
${data.fCity}, ${data.fState} – ${data.fPin}

--- TRANSPORT ---
School Bus Required: ${data.fBus}
Pick-up Area: ${data.fBusArea || 'N/A'}

--- MESSAGE ---
${data.fMessage || 'None'}
    `
  };

  try {
    if (process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Application sent to school email successfully.' });
    } else {
      console.log('Skipped actual email sending because SMTP_PASS is missing.');
      console.log(mailOptions.text);
      res.json({ success: true, message: 'SMTP_PASS not configured. Form accepted but not emailed. Simulated success.' });
    }
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email. Ensure SMTP settings are correct.' });
  }
});

// Root route — serve the school website homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'StXaviers_Website.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('CMS Backend running on port ' + PORT);
});
