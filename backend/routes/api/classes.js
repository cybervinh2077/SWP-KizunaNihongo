'use strict';

const router = require('express').Router();
const { requireAuth, requireTeacher, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/classController');
const b = require('../../controllers/classBoardController');

// Student: join / view own classes
router.post('/join',       requireAuth, c.joinClass);
router.get('/my',          requireAuth, c.listMyEnrollments);
router.delete('/my/:id',   requireAuth, c.leaveClass);

// ── Bảng lớp (Padlet): bài đăng + bình luận ──────────────────────────────────
// Static routes ("board/...") đặt TRƯỚC route param để không bị nuốt
router.get('/teacher/exams',                 requireAuth, requireTeacher, b.listTeacherExams);
router.put('/board/:postId',                 requireAuth, b.updatePost);
router.delete('/board/:postId',              requireAuth, b.deletePost);
router.get('/board/:postId/comments',        requireAuth, b.listComments);
router.post('/board/:postId/comments',       requireAuth, b.addComment);
router.delete('/board/comments/:commentId',  requireAuth, b.deleteComment);
router.get('/:id/board',                     requireAuth, b.listPosts);
router.post('/:id/board',                    requireAuth, b.createPost);
router.post('/:id/board/upload',             requireAuth, b.uploadMiddleware, b.uploadFile);

// Teacher: manage own classes
router.get('/teacher',                         requireAuth, requireTeacher, c.listMyClasses);
router.post('/teacher',                        requireAuth, requireTeacher, c.createClass);
router.put('/teacher/:id',                     requireAuth, requireTeacher, c.updateClass);
router.delete('/teacher/:id',                  requireAuth, requireTeacher, c.deleteClass);
router.get('/teacher/:id/students',            requireAuth, requireTeacher, c.getClassStudents);
router.put('/teacher/enrollments/:enrollmentId', requireAuth, requireTeacher, c.updateEnrollmentStatus);
router.delete('/teacher/enrollments/:enrollmentId', requireAuth, requireTeacher, c.removeEnrollment);

// Admin
router.get('/admin',       requireAuth, requireAdmin, c.adminListClasses);
router.get('/admin/:id',   requireAuth, requireAdmin, c.adminGetClassDetail);

module.exports = router;
