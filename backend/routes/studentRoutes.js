// backend/routes/studentRoutes.js
const router = require('express').Router();
const c = require('../controllers/studentController');

const isStudent = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'student')
    return res.status(403).json({ message: 'Access denied.' });
  next();
};
router.use(isStudent);

router.get('/dashboard',          c.dashboard);
router.post('/apply-hostel',      c.applyHostel);
router.get('/application-status', c.applicationStatus);
router.get('/fees',                       c.getFees);
router.post('/fees/:id/create-order',     c.createOrder);
router.post('/fees/:id/verify-payment',   c.verifyPayment);
router.put('/fees/:id/pay',               c.payFee);
router.get('/complaints',         c.getComplaints);
router.post('/complaints',        c.raiseComplaint);
router.get('/leaves',             c.getLeaves);
router.post('/leaves',            c.requestLeave);
router.get('/announcements',      c.getAnnouncements);

module.exports = router;