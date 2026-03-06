// backend/routes/wardenRoutes.js
const router = require('express').Router();
const c = require('../controllers/wardenController');

const isWarden = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'warden')
    return res.status(403).json({ message: 'Access denied.' });
  next();
};
router.use(isWarden);

router.get('/dashboard',                        c.dashboard);
router.get('/leave-requests',                   c.getLeaveRequests);
router.put('/leave-requests/:id/approve',       c.approveLeave);
router.put('/leave-requests/:id/reject',        c.rejectLeave);
router.get('/announcements',                    c.getAnnouncements);
router.post('/announcements',                   c.postAnnouncement);
router.delete('/announcements/:id',             c.deleteAnnouncement);

module.exports = router;