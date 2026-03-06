// backend/routes/adminRoutes.js
const router = require('express').Router();
const c = require('../controllers/adminController');

// Auth middleware
const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).json({ message: 'Access denied.' });
  next();
};

router.use(isAdmin);

router.get('/dashboard',                    c.dashboard);
router.get('/applications',                 c.getApplications);
router.put('/applications/:id/approve',     c.approveApplication);
router.put('/applications/:id/reject',      c.rejectApplication);
router.get('/hostels',                      c.getHostels);
router.post('/hostels',                     c.createHostel);
router.get('/rooms/:hostel_id',             c.getRooms);
router.get('/all-rooms',                    c.getAllRooms);
router.post('/rooms',                       c.createRoom);
router.get('/students',                     c.getStudents);
router.post('/users',                       c.createUser);

module.exports = router;