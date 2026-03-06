// backend/controllers/adminController.js
const db = require('../config/db');

// GET /api/admin/dashboard
exports.dashboard = async (req, res) => {
  try {
    const [[{ total_students }]] = await db.query(`SELECT COUNT(*) AS total_students FROM users WHERE role='student'`);
    const [[{ pending_apps }]]   = await db.query(`SELECT COUNT(*) AS pending_apps FROM hostel_applications WHERE status='pending'`);
    const [[{ total_rooms }]]    = await db.query(`SELECT COUNT(*) AS total_rooms FROM rooms`);
    const [[{ occupied_rooms }]] = await db.query(`SELECT COUNT(*) AS occupied_rooms FROM rooms WHERE occupied > 0`);
    const [[{ pending_complaints }]] = await db.query(`SELECT COUNT(*) AS pending_complaints FROM complaints WHERE status='pending'`);
    const [[{ pending_leaves }]] = await db.query(`SELECT COUNT(*) AS pending_leaves FROM leave_requests WHERE status='pending'`);
    res.json({ total_students, pending_apps, total_rooms, occupied_rooms, pending_complaints, pending_leaves });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/applications
exports.getApplications = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ha.*, u.email,
             h.name AS hostel_name, r.room_number
      FROM hostel_applications ha
      JOIN users u ON ha.user_id = u.id
      LEFT JOIN hostels h ON ha.hostel_id = h.id
      LEFT JOIN rooms r   ON ha.room_id = r.id
      ORDER BY ha.applied_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/admin/applications/:id/approve
exports.approveApplication = async (req, res) => {
  const { id } = req.params;
  const { hostel_id, room_id } = req.body;
  if (!hostel_id || !room_id)
    return res.status(400).json({ message: 'Hostel and room are required.' });

  try {
    // Get application
    const [[app]] = await db.query('SELECT * FROM hostel_applications WHERE id = ?', [id]);
    if (!app) return res.status(404).json({ message: 'Application not found.' });

    // Check room capacity
    const [[room]] = await db.query('SELECT * FROM rooms WHERE id = ?', [room_id]);
    if (room.occupied >= room.capacity)
      return res.status(400).json({ message: 'Room is full.' });

    // Update application
    await db.query(
      `UPDATE hostel_applications SET status='approved', hostel_id=?, room_id=?, reviewed_at=NOW() WHERE id=?`,
      [hostel_id, room_id, id]
    );
    // Update room occupancy
    await db.query('UPDATE rooms SET occupied = occupied + 1 WHERE id = ?', [room_id]);
    // Upsert student profile
    await db.query(
      `INSERT INTO student_profiles (user_id, roll_no, department, year, phone, hostel_id, room_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE hostel_id=VALUES(hostel_id), room_id=VALUES(room_id)`,
      [app.user_id, app.roll_no, app.department, app.year, app.phone, hostel_id, room_id]
    );
    res.json({ message: 'Application approved and room assigned.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/admin/applications/:id/reject
exports.rejectApplication = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE hostel_applications SET status='rejected', reviewed_at=NOW() WHERE id=?`, [id]
    );
    res.json({ message: 'Application rejected.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/hostels  — for dropdowns
exports.getHostels = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hostels');
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/rooms/:hostel_id
exports.getRooms = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM rooms WHERE hostel_id = ? AND occupied < capacity', [req.params.hostel_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/students
exports.getStudents = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.name, u.email, u.created_at,
             sp.roll_no, sp.department, sp.year, sp.phone,
             h.name AS hostel_name, r.room_number
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      LEFT JOIN rooms r   ON sp.room_id = r.id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/admin/hostels — add new hostel
exports.createHostel = async (req, res) => {
  const { name, type } = req.body;
  if (!name)
    return res.status(400).json({ message: 'Hostel name is required.' });
  try {
    await db.query(
      'INSERT INTO hostels (name, type) VALUES (?, ?)',
      [name.trim(), type || 'boys']
    );
    res.json({ message: `Hostel "${name}" added successfully.` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'A hostel with this name already exists.' });
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/rooms — add new room
exports.createRoom = async (req, res) => {
  const { hostel_id, room_number, type, capacity } = req.body;
  if (!hostel_id || !room_number || !capacity)
    return res.status(400).json({ message: 'Hostel, room number and capacity are required.' });

  // Validate numeric fields
  const cap = parseInt(capacity, 10);
  const hid = parseInt(hostel_id, 10);
  if (isNaN(cap) || cap < 1 || cap > 10)
    return res.status(400).json({ message: 'Capacity must be between 1 and 10.' });
  if (isNaN(hid))
    return res.status(400).json({ message: 'Invalid hostel selected.' });

  // Whitelist room types
  const VALID_TYPES = ['single', 'double', 'triple', 'quad'];
  const roomType = (type || 'double').toLowerCase();
  if (!VALID_TYPES.includes(roomType))
    return res.status(400).json({ message: 'Invalid room type.' });

  if (room_number.length > 20)
    return res.status(400).json({ message: 'Room number too long.' });

  try {
    await db.query(
      'INSERT INTO rooms (hostel_id, room_number, type, capacity, occupied) VALUES (?, ?, ?, ?, 0)',
      [hid, room_number.trim(), roomType, cap]
    );
    res.json({ message: `Room ${room_number} added successfully.` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'A room with this number already exists in this hostel.' });
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/all-rooms — all rooms with hostel name + assigned students
exports.getAllRooms = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.*, h.name AS hostel_name,
             GROUP_CONCAT(
               CONCAT(u.name, ' (', COALESCE(sp.roll_no, 'No Roll'), ')')
               ORDER BY u.name SEPARATOR '||'
             ) AS students
      FROM rooms r
      JOIN hostels h ON r.hostel_id = h.id
      LEFT JOIN student_profiles sp ON sp.room_id = r.id
      LEFT JOIN users u ON sp.user_id = u.id
      GROUP BY r.id
      ORDER BY h.name, r.room_number
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/admin/users — create any user
exports.createUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ message: 'All fields required.' });

  // Whitelist valid roles — prevents injecting arbitrary role values
  const VALID_ROLES = ['admin', 'student', 'warden', 'accountant', 'maintenance'];
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ message: 'Invalid role specified.' });

  // Length limits
  if (name.length > 100)     return res.status(400).json({ message: 'Name too long (max 100 chars).' });
  if (email.length > 150)    return res.status(400).json({ message: 'Email too long (max 150 chars).' });
  if (password.length < 6)   return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  if (password.length > 128) return res.status(400).json({ message: 'Password too long.' });

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'Invalid email format.' });

  try {
    const hash = await require('bcryptjs').hash(password, 10);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)', [name, email, hash, role]);
    res.json({ message: 'User created successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'Email already exists.' });
    res.status(500).json({ message: err.message });
  }
};