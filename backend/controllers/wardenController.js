// backend/controllers/wardenController.js
const db = require('../config/db');

// GET /api/warden/dashboard
exports.dashboard = async (req, res) => {
  try {
    const [[{ total_students }]] = await db.query(`SELECT COUNT(*) AS total_students FROM users WHERE role='student'`);
    const [[{ pending_leaves }]] = await db.query(`SELECT COUNT(*) AS pending_leaves FROM leave_requests WHERE status='pending'`);
    const [[{ approved_today }]] = await db.query(`SELECT COUNT(*) AS approved_today FROM leave_requests WHERE status='approved' AND DATE(reviewed_at)=CURDATE()`);
    const [[{ total_announcements }]] = await db.query(`SELECT COUNT(*) AS total_announcements FROM announcements`);
    res.json({ total_students, pending_leaves, approved_today, total_announcements });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/warden/leave-requests
exports.getLeaveRequests = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT lr.*, u.name AS student_name, u.email,
             sp.roll_no, sp.department, h.name AS hostel_name, r.room_number
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN student_profiles sp ON lr.student_id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      LEFT JOIN rooms r   ON sp.room_id = r.id
      ORDER BY lr.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/warden/leave-requests/:id/approve
exports.approveLeave = async (req, res) => {
  const { remarks } = req.body;
  const wid = req.session.user.id;
  try {
    await db.query(
      `UPDATE leave_requests SET status='approved', approved_by=?, remarks=?, reviewed_at=NOW() WHERE id=?`,
      [wid, remarks || '', req.params.id]
    );
    res.json({ message: 'Leave approved.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/warden/leave-requests/:id/reject
exports.rejectLeave = async (req, res) => {
  const { remarks } = req.body;
  const wid = req.session.user.id;
  try {
    await db.query(
      `UPDATE leave_requests SET status='rejected', approved_by=?, remarks=?, reviewed_at=NOW() WHERE id=?`,
      [wid, remarks || '', req.params.id]
    );
    res.json({ message: 'Leave rejected.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/warden/announcements
exports.getAnnouncements = async (req, res) => {
  const wid = req.session.user.id;
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS posted_by_name FROM announcements a
       JOIN users u ON a.posted_by = u.id
       ORDER BY a.created_at DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/warden/announcements
exports.postAnnouncement = async (req, res) => {
  const { title, content } = req.body;
  const wid = req.session.user.id;
  if (!title || !content)
    return res.status(400).json({ message: 'Title and content required.' });
  try {
    await db.query('INSERT INTO announcements (title, content, posted_by) VALUES (?,?,?)', [title, content, wid]);
    res.json({ message: 'Announcement posted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/warden/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE id=?', [req.params.id]);
    res.json({ message: 'Announcement deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};