// backend/controllers/maintenanceController.js
const db = require('../config/db');

// GET /api/maintenance/dashboard
exports.dashboard = async (req, res) => {
  try {
    const [[{ total }]]       = await db.query(`SELECT COUNT(*) AS total FROM complaints`);
    const [[{ pending }]]     = await db.query(`SELECT COUNT(*) AS pending FROM complaints WHERE status='pending'`);
    const [[{ in_progress }]] = await db.query(`SELECT COUNT(*) AS in_progress FROM complaints WHERE status='in-progress'`);
    const [[{ resolved }]]    = await db.query(`SELECT COUNT(*) AS resolved FROM complaints WHERE status='resolved'`);
    res.json({ total, pending, in_progress, resolved });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/maintenance/complaints
exports.getComplaints = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, u.name AS student_name, u.email,
             sp.roll_no, h.name AS hostel_name, r.room_number
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      LEFT JOIN student_profiles sp ON c.student_id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      LEFT JOIN rooms r   ON sp.room_id   = r.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/maintenance/complaints/:id/schedule
exports.scheduleVisit = async (req, res) => {
  const { visit_date, visit_time } = req.body;
  if (!visit_date || !visit_time)
    return res.status(400).json({ message: 'Visit date and time required.' });
  try {
    await db.query(
      `UPDATE complaints SET visit_date=?, visit_time=?, status='in-progress' WHERE id=?`,
      [visit_date, visit_time, req.params.id]
    );
    res.json({ message: 'Visit scheduled.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/maintenance/complaints/:id/resolve
exports.resolveComplaint = async (req, res) => {
  try {
    await db.query(
      `UPDATE complaints SET status='resolved', resolved_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    res.json({ message: 'Complaint marked as resolved.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};