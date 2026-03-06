// backend/controllers/studentController.js
const db = require('../config/db');

// Razorpay — initialized lazily only when payment is needed
// Run: npm install razorpay  before using payment features
let razorpay = null;
function getRazorpay() {
  if (!razorpay) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id    : process.env.RAZORPAY_KEY_ID     || 'rzp_test_XXXXXXXXXXXXXXXX',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'XXXXXXXXXXXXXXXXXXXXXXXX',
    });
  }
  return razorpay;
}

// GET /api/student/dashboard
exports.dashboard = async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[profile]] = await db.query(`
      SELECT u.name, u.email, sp.roll_no, sp.department, sp.year, sp.phone,
             h.name AS hostel_name, r.room_number, r.type AS room_type
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN hostels h ON sp.hostel_id = h.id
      LEFT JOIN rooms r   ON sp.room_id = r.id
      WHERE u.id = ?`, [uid]);

    const [[{ pending_fees }]] = await db.query(
      `SELECT COUNT(*) AS pending_fees FROM fees WHERE student_id=? AND status='pending'`, [uid]);
    const [[{ open_complaints }]] = await db.query(
      `SELECT COUNT(*) AS open_complaints FROM complaints WHERE student_id=? AND status != 'resolved'`, [uid]);
    const [[{ pending_leaves }]] = await db.query(
      `SELECT COUNT(*) AS pending_leaves FROM leave_requests WHERE student_id=? AND status='pending'`, [uid]);
    const [[{ app_status }]] = await db.query(
      `SELECT status AS app_status FROM hostel_applications WHERE user_id=? ORDER BY applied_at DESC LIMIT 1`, [uid])
      .catch(() => [[{ app_status: null }]]);

    res.json({ profile, pending_fees, open_complaints, pending_leaves, app_status: app_status || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/student/apply-hostel
exports.applyHostel = async (req, res) => {
  const uid = req.session.user.id;
  const { full_name, roll_no, department, year, phone, reason } = req.body;
  if (!full_name || !roll_no || !department || !year || !phone)
    return res.status(400).json({ message: 'All fields are required.' });
  try {
    // Check for existing pending/approved application
    const [[existing]] = await db.query(
      `SELECT id, status FROM hostel_applications WHERE user_id=? AND status IN ('pending','approved')`, [uid]);
    if (existing)
      return res.status(409).json({ message: `You already have a ${existing.status} application.` });

    await db.query(
      `INSERT INTO hostel_applications (user_id, full_name, roll_no, department, year, phone, reason)
       VALUES (?,?,?,?,?,?,?)`,
      [uid, full_name, roll_no, department, year, phone, reason]
    );
    res.json({ message: 'Application submitted successfully.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/student/application-status
exports.applicationStatus = async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.query(
      `SELECT ha.*, h.name AS hostel_name, r.room_number
       FROM hostel_applications ha
       LEFT JOIN hostels h ON ha.hostel_id = h.id
       LEFT JOIN rooms r   ON ha.room_id = r.id
       WHERE ha.user_id = ? ORDER BY ha.applied_at DESC`, [uid]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/student/fees
exports.getFees = async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.query(
      `SELECT f.id, f.student_id, f.amount, f.description, f.due_date,
              f.status, f.paid_at, f.created_at,
              IFNULL(f.razorpay_payment_id, NULL) AS razorpay_payment_id,
              u.name AS assigned_by_name
       FROM fees f JOIN users u ON f.assigned_by = u.id
       WHERE f.student_id = ? ORDER BY f.created_at DESC`, [uid]);
    res.json(rows);
  } catch (err) {
    // Fallback if razorpay_payment_id column doesn't exist yet
    const [rows] = await db.query(
      `SELECT f.id, f.student_id, f.amount, f.description, f.due_date,
              f.status, f.paid_at, f.created_at, NULL AS razorpay_payment_id,
              u.name AS assigned_by_name
       FROM fees f JOIN users u ON f.assigned_by = u.id
       WHERE f.student_id = ? ORDER BY f.created_at DESC`, [uid]);
    res.json(rows);
  }
};

// POST /api/student/fees/:id/create-order  — create Razorpay order
exports.createOrder = async (req, res) => {
  const uid = req.session.user.id;
  const { id } = req.params;
  try {
    const [[fee]] = await db.query(
      'SELECT * FROM fees WHERE id=? AND student_id=?', [id, uid]
    );
    if (!fee)               return res.status(404).json({ message: 'Fee record not found.' });
    if (fee.status === 'paid') return res.status(400).json({ message: 'Fee already paid.' });

    const order = await getRazorpay().orders.create({
      amount  : Math.round(Number(fee.amount) * 100), // Razorpay expects paise
      currency: 'INR',
      receipt : `fee_${id}_${uid}`,
      notes   : {
        fee_id    : String(id),
        student_id: String(uid),
        description: fee.description,
      }
    });

    res.json({
      order_id  : order.id,
      amount    : order.amount,
      currency  : order.currency,
      fee_id    : id,
      description: fee.description,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/student/fees/:id/verify-payment  — verify & mark paid
exports.verifyPayment = async (req, res) => {
  const uid = req.session.user.id;
  const { id } = req.params;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ message: 'Payment details missing.' });

  try {
    // Verify signature using HMAC SHA256
    const crypto    = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'XXXXXXXXXXXXXXXXXXXXXXXX';

    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature)
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });

    // Confirm fee record belongs to this student and is still pending
    const [[fee]] = await db.query(
      'SELECT * FROM fees WHERE id=? AND student_id=?', [id, uid]
    );
    if (!fee)                  return res.status(404).json({ message: 'Fee not found.' });
    if (fee.status === 'paid') return res.status(400).json({ message: 'Already paid.' });

    // Mark paid + store Razorpay payment ID (try with column, fallback without)
    try {
      await db.query(
        `UPDATE fees SET status='paid', paid_at=NOW(), razorpay_payment_id=? WHERE id=?`,
        [razorpay_payment_id, id]
      );
    } catch (colErr) {
      // Column doesn't exist yet — mark paid without payment_id
      await db.query(
        `UPDATE fees SET status='paid', paid_at=NOW() WHERE id=?`, [id]
      );
    }

    res.json({ message: 'Payment successful! Fee marked as paid.', payment_id: razorpay_payment_id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/student/fees/:id/pay  — kept for manual/test pay (no gateway)
exports.payFee = async (req, res) => {
  const uid = req.session.user.id;
  const { id } = req.params;
  try {
    const [[fee]] = await db.query('SELECT * FROM fees WHERE id=? AND student_id=?', [id, uid]);
    if (!fee) return res.status(404).json({ message: 'Fee record not found.' });
    if (fee.status === 'paid') return res.status(400).json({ message: 'Fee already paid.' });
    await db.query(`UPDATE fees SET status='paid', paid_at=NOW() WHERE id=?`, [id]);
    res.json({ message: 'Fee paid successfully.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/student/complaints
exports.getComplaints = async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.query(
      'SELECT * FROM complaints WHERE student_id=? ORDER BY created_at DESC', [uid]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/student/complaints
exports.raiseComplaint = async (req, res) => {
  const uid = req.session.user.id;
  const { category, description } = req.body;
  if (!category || !description)
    return res.status(400).json({ message: 'Category and description required.' });
  try {
    await db.query(
      'INSERT INTO complaints (student_id, category, description) VALUES (?,?,?)',
      [uid, category, description]
    );
    res.json({ message: 'Complaint raised successfully.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/student/leaves
exports.getLeaves = async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.query(
      `SELECT lr.*, u.name AS approved_by_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.approved_by = u.id
       WHERE lr.student_id=? ORDER BY lr.created_at DESC`, [uid]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/student/leaves
exports.requestLeave = async (req, res) => {
  const uid = req.session.user.id;
  const { from_date, to_date, reason, destination } = req.body;
  if (!from_date || !to_date || !reason)
    return res.status(400).json({ message: 'All fields required.' });
  try {
    await db.query(
      'INSERT INTO leave_requests (student_id, from_date, to_date, reason, destination) VALUES (?,?,?,?,?)',
      [uid, from_date, to_date, reason, destination]
    );
    res.json({ message: 'Leave request submitted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/student/announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS posted_by_name
       FROM announcements a JOIN users u ON a.posted_by = u.id
       ORDER BY a.created_at DESC LIMIT 20`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
};