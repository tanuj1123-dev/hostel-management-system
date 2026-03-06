// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const db     = require('../config/db');

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password.' });

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid email or password.' });

    req.session.user = {
      id: user.id, name: user.name,
      email: user.email, role: user.role
    };

    res.json({ message: 'Login successful', role: user.role, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
};

// GET /api/auth/me
exports.me = (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: 'Not authenticated.' });
  res.json(req.session.user);
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  // Must be logged in
  if (!req.session.user)
    return res.status(401).json({ message: 'Not authenticated.' });

  const { old_password, new_password } = req.body;
  const uid = req.session.user.id;

  // Basic checks
  if (!old_password || !new_password)
    return res.status(400).json({ message: 'Both old and new passwords are required.' });

  if (new_password.length < 6)
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });

  if (old_password === new_password)
    return res.status(400).json({ message: 'New password must be different from old password.' });

  try {
    // Get current password from DB
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [uid]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found.' });

    // Verify old password
    const match = await bcrypt.compare(old_password, rows[0].password);
    if (!match)
      return res.status(401).json({ message: 'Old password is incorrect.' });

    // Hash new password and save
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, uid]);

    res.json({ message: 'Password changed successfully! Please login again.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};