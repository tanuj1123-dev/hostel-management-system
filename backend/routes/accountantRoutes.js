// backend/routes/accountantRoutes.js
const router = require('express').Router();
const c = require('../controllers/accountantController');

const isAccountant = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'accountant')
    return res.status(403).json({ message: 'Access denied.' });
  next();
};
router.use(isAccountant);

router.get('/dashboard',   c.dashboard);
router.get('/students',    c.getStudents);
router.get('/fees',        c.getFees);
router.get('/overdue',     c.getOverdue);
router.post('/fees',       c.assignFee);
router.post('/fees/bulk',  c.assignFeeBulk);
router.post('/fees/late-fine', c.assignLateFine);

module.exports = router;