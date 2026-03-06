// backend/routes/maintenanceRoutes.js
const router = require('express').Router();
const c = require('../controllers/maintenanceController');

const isMaintenance = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'maintenance')
    return res.status(403).json({ message: 'Access denied.' });
  next();
};
router.use(isMaintenance);

router.get('/dashboard',               c.dashboard);
router.get('/complaints',              c.getComplaints);
router.put('/complaints/:id/schedule', c.scheduleVisit);
router.put('/complaints/:id/resolve',  c.resolveComplaint);

module.exports = router;