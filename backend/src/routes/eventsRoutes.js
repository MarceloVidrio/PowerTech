const express = require('express');
const router = express.Router();
const c = require('../controllers/eventsController');
const { requireAuth } = require('../middleware/auth');

router.post('/ticket', requireAuth, c.ticket);
router.get('/', c.stream);

module.exports = router;
