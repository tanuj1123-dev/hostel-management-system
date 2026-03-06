// backend/routes/authRoutes.js
const router = require('express').Router();
const c = require('../controllers/authController');

router.post('/login',           c.login);
router.post('/logout',          c.logout);
router.get('/me',               c.me);
router.post('/change-password', c.changePassword);

module.exports = router;