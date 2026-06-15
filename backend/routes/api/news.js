'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/newsController');

// Student: đọc bài báo (chỉ bài đã publish)
router.get('/',    requireAuth, c.list);
router.get('/:id', requireAuth, c.getOne);

module.exports = router;
