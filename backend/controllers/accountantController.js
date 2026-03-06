// backend/controllers/accountantController.js
const db = require('../config/db');

// GET /api/accountant/dashboard
exports.dashboard = async (req, res) => {
  try {
    const [[{ total_assigned }]]  = await db.query(`SELECT COUNT(*) AS total_assigned FROM fees`);
    const [[{ total_paid }]]      = await db.query(`SELECT COUNT(*) AS total_paid FROM fees WHERE status='paid'`);
    const [[{ total_pending }]]   = await db.query(`SELECT COUNT(*) AS total_pending FROM fees WHERE status='pending'`);
    const [[{ revenue }]]         = await db.query(`SELECT IFNULL(SUM(amount),0) AS revenue FROM fees WHERE status='paid'`);
    const [[{ pending_amount }]]  = await db.query(`SELECT IFNULL(SUM(amount),0) AS pending_amount FROM fees WHERE status='pending'`);
    res.json({ total_assigned, total_paid, total_pending, revenue, pending_amount });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/accountant/students — students with hostel allocation
exports.getStudents = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.name, u.email,
             sp.roll_no, sp.department, sp.year,
             h.name AS hostel_name, r.room_number, r.type AS room_type
      FROM users u
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      LEFT JOIN rooms r   ON sp.room_id   = r.id
      WHERE u.role='student'
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/accountant/fees
exports.getFees = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT f.*, u.name AS student_name, u.email,
             sp.roll_no, h.name AS hostel_name,
             a.name AS assigned_by_name
      FROM fees f
      JOIN users u   ON f.student_id  = u.id
      JOIN users a   ON f.assigned_by = a.id
      LEFT JOIN student_profiles sp ON f.student_id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      ORDER BY f.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/accountant/overdue — all pending fees past due date
exports.getOverdue = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT f.*, u.name AS student_name, u.email,
             sp.roll_no, sp.phone,
             h.name AS hostel_name, r.room_number, r.type AS room_type,
             DATEDIFF(CURDATE(), f.due_date) AS days_overdue
      FROM fees f
      JOIN users u ON f.student_id = u.id
      LEFT JOIN student_profiles sp ON f.student_id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      LEFT JOIN rooms r   ON sp.room_id = r.id
      WHERE f.status = 'pending' AND f.due_date < CURDATE()
      ORDER BY days_overdue DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/accountant/fees/late-fine — add late fine to all overdue students
exports.assignLateFine = async (req, res) => {
  const { amount, description, due_date } = req.body;
  const aid = req.session.user.id;
  if (!amount || !due_date)
    return res.status(400).json({ message: 'Amount and due date are required.' });
  try {
    // Get distinct overdue students
    const [students] = await db.query(`
      SELECT DISTINCT f.student_id FROM fees f
      WHERE f.status = 'pending' AND f.due_date < CURDATE()
    `);
    if (!students.length)
      return res.status(404).json({ message: 'No overdue students found.' });

    const values = students.map(s => [s.student_id, amount, description || 'Late Fine', due_date, aid]);
    await db.query(
      'INSERT INTO fees (student_id, amount, description, due_date, assigned_by) VALUES ?',
      [values]
    );
    res.json({ message: `Late fine assigned to ${students.length} overdue student${students.length > 1 ? 's' : ''}.`, count: students.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/accountant/fees/bulk — assign fee to all students of a room type
exports.assignFeeBulk = async (req, res) => {
  const { room_type, amount, description, due_date } = req.body;
  const aid = req.session.user.id;
  if (!room_type || !amount || !due_date)
    return res.status(400).json({ message: 'Room type, amount and due date are required.' });

  const VALID_TYPES = ['single', 'double', 'triple', 'quad'];
  if (!VALID_TYPES.includes(room_type))
    return res.status(400).json({ message: 'Invalid room type.' });

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0 || amt > 500000)
    return res.status(400).json({ message: 'Invalid amount. Must be between 1 and 5,00,000.' });

  try {
    const [students] = await db.query(`
      SELECT u.id FROM users u
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN rooms r ON sp.room_id = r.id
      WHERE u.role = 'student' AND r.type = ?
    `, [room_type]);

    if (!students.length)
      return res.status(404).json({ message: `No students found in ${room_type} rooms.` });

    const values = students.map(s => [s.id, amt, description || `Hostel Fee (${room_type})`, due_date, aid]);
    await db.query(
      'INSERT INTO fees (student_id, amount, description, due_date, assigned_by) VALUES ?',
      [values]
    );
    res.json({ message: `Fee assigned to ${students.length} student${students.length > 1 ? 's' : ''} in ${room_type} rooms.`, count: students.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/accountant/fees
exports.assignFee = async (req, res) => {
  const { student_id, amount, description, due_date } = req.body;
  const aid = req.session.user.id;
  if (!student_id || !amount || !due_date)
    return res.status(400).json({ message: 'Student, amount, and due date are required.' });
  try {
    await db.query(
      'INSERT INTO fees (student_id, amount, description, due_date, assigned_by) VALUES (?,?,?,?,?)',
      [student_id, amount, description || 'Hostel Fee', due_date, aid]
    );
    res.json({ message: 'Fee assigned successfully.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};