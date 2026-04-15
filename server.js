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
const SECRET_KEY = process.env.JWT_SECRET || 'st_xaviers_super_secret_key_2026';

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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

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
      res.json({ token, message: 'Login successful', email: user.email });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

/* ─── API: CHANGE PASSWORD ─── */
app.post('/api/change-password', authenticateJWT, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Password changed successfully' });
    });
  });
});

/* ─── API: GET ALL ADMINS ─── */
app.get('/api/admins', authenticateJWT, (req, res) => {
  db.all('SELECT id, email FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* ─── API: ADD ADMIN ─── */
app.post('/api/admins', authenticateJWT, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, email });
  });
});

/* ─── API: DELETE ADMIN ─── */
app.delete('/api/admins/:id', authenticateJWT, (req, res) => {
  // Prevent deleting yourself
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

/* ─── API: RESET ADMIN PASSWORD ─── */
app.put('/api/admins/:id/reset-password', authenticateJWT, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
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
  const items = req.body;
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
  const notifDate = date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  db.run('INSERT INTO notifications (title, category, desc, date) VALUES (?, ?, ?, ?)', [title, category, desc, notifDate], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ id: this.lastID });
  });
});

app.put('/api/notifications/:id', authenticateJWT, (req, res) => {
  const { title, category, desc, date } = req.body;
  db.run('UPDATE notifications SET title=?, category=?, desc=?, date=? WHERE id=?',
    [title, category, desc, date, req.params.id], (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true });
    }
  );
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

app.put('/api/gallery/:id', authenticateJWT, (req, res) => {
  const { alt, cls } = req.body;
  db.run('UPDATE gallery SET alt=?, cls=? WHERE id=?', [alt, cls, req.params.id], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
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
      res.json({ success: true, message: 'Form submitted successfully!' });
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

// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('CMS Backend running on port ' + PORT);
});
