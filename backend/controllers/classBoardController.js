'use strict';

const { supabaseAdmin } = require('../config/supabase');
const multer = require('multer');

const classDb = supabaseAdmin.schema('classroom_module');
const examDb  = supabaseAdmin.schema('exam_module');

exports.uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
}).single('file');

// Vai trò của user với lớp: 'teacher' (chủ lớp), 'student' (đang học), hoặc null
async function getClassRole(classId, userId) {
  const { data: cls } = await classDb.from('classes').select('id, name, description, teacher_id').eq('id', classId).single();
  if (!cls) return { role: null };
  if (cls.teacher_id === userId) return { role: 'teacher', cls };
  const { data: enr } = await classDb.from('class_enrollments')
    .select('id').eq('class_id', classId).eq('student_id', userId).eq('status', 'active').maybeSingle();
  return { role: enr ? 'student' : null, cls };
}

// Gắn tên tác giả cho danh sách (bài/bình luận)
async function attachAuthors(rows) {
  const ids = [...new Set(rows.map(r => r.author_id).filter(Boolean))];
  if (!ids.length) return rows.map(r => ({ ...r, author: null }));
  const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email, avatar_url').in('id', ids);
  const map = Object.fromEntries((users || []).map(u => [u.id, u]));
  return rows.map(r => ({ ...r, author: map[r.author_id] || null }));
}

// GET /api/classes/:id/board — bài đăng + meta (thành viên xem được)
exports.listPosts = async (req, res) => {
  try {
    const { role, cls } = await getClassRole(req.params.id, req.user.id);
    if (!role) return res.status(403).json({ error: 'Bạn không thuộc lớp này.' });

    const { data: posts, error } = await classDb.from('class_posts')
      .select('*').eq('class_id', req.params.id)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;

    const withAuthors = await attachAuthors(posts || []);

    // Đếm bình luận mỗi bài
    const postIds = withAuthors.map(p => p.id);
    const counts = {};
    if (postIds.length) {
      const { data: cmts } = await classDb.from('class_post_comments').select('post_id').in('post_id', postIds);
      (cmts || []).forEach(c => { counts[c.post_id] = (counts[c.post_id] || 0) + 1; });
    }

    res.json({
      role,
      class: { id: cls.id, name: cls.name, description: cls.description },
      posts: withAuthors.map(p => ({ ...p, comment_count: counts[p.id] || 0 })),
    });
  } catch (err) {
    console.error('listPosts error:', err);
    res.status(500).json({ error: 'Không thể tải bảng lớp.' });
  }
};

// POST /api/classes/:id/board — tạo bài đăng (chỉ GV chủ lớp)
exports.createPost = async (req, res) => {
  const { type = 'announcement', title, body, link_url, file_url, file_name,
          due_at, is_pinned, exam_id, new_exam_title, max_attempts } = req.body;
  try {
    const { role } = await getClassRole(req.params.id, req.user.id);
    if (role !== 'teacher') return res.status(403).json({ error: 'Chỉ giáo viên của lớp được đăng bài.' });
    if (!['announcement','material','homework','quiz'].includes(type))
      return res.status(400).json({ error: 'Loại bài không hợp lệ.' });

    let assignment_id = null;
    let created_exam_id = null;

    // Bài kiểm tra: gắn đề có sẵn hoặc tạo đề mới, rồi giao cho lớp
    if (type === 'quiz') {
      let examId = exam_id;
      if (!examId) {
        if (!new_exam_title) return res.status(400).json({ error: 'Chọn đề có sẵn hoặc nhập tên đề mới.' });
        const { data: ex, error: exErr } = await examDb.from('quizzes')
          .insert({ title: new_exam_title, type: 'multiple_choice', is_exam: true, is_published: true, teacher_id: req.user.id })
          .select('id').single();
        if (exErr) throw exErr;
        examId = ex.id; created_exam_id = ex.id;
      }
      const { data: asg, error: asgErr } = await classDb.from('exam_assignments')
        .insert({ exam_id: examId, class_id: req.params.id, assigned_by: req.user.id, target_type: 'class',
                  end_time: due_at || null, max_attempts: max_attempts || 1 })
        .select('id').single();
      if (asgErr) throw asgErr;
      assignment_id = asg.id;
    }

    const { data, error } = await classDb.from('class_posts').insert({
      class_id: req.params.id, author_id: req.user.id, type,
      title: title || null, body: body || null, link_url: link_url || null,
      file_url: file_url || null, file_name: file_name || null,
      assignment_id, due_at: due_at || null, is_pinned: !!is_pinned,
    }).select().single();
    if (error) throw error;

    res.status(201).json({ ...data, created_exam_id });
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ error: 'Không thể đăng bài.' });
  }
};

// PUT /api/classes/board/:postId — sửa bài (GV chủ lớp)
exports.updatePost = async (req, res) => {
  try {
    const { data: post } = await classDb.from('class_posts').select('class_id').eq('id', req.params.postId).single();
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài.' });
    const { role } = await getClassRole(post.class_id, req.user.id);
    if (role !== 'teacher') return res.status(403).json({ error: 'Không có quyền.' });

    const allowed = ['title','body','link_url','file_url','file_name','due_at','is_pinned'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_at = new Date().toISOString();
    const { data, error } = await classDb.from('class_posts').update(updates).eq('id', req.params.postId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài.' }); }
};

// DELETE /api/classes/board/:postId
exports.deletePost = async (req, res) => {
  try {
    const { data: post } = await classDb.from('class_posts').select('class_id, assignment_id').eq('id', req.params.postId).single();
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài.' });
    const { role } = await getClassRole(post.class_id, req.user.id);
    if (role !== 'teacher') return res.status(403).json({ error: 'Không có quyền.' });
    if (post.assignment_id) await classDb.from('exam_assignments').delete().eq('id', post.assignment_id);
    await classDb.from('class_posts').delete().eq('id', req.params.postId);
    res.json({ message: 'Đã xóa bài.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài.' }); }
};

// GET /api/classes/board/:postId/comments
exports.listComments = async (req, res) => {
  try {
    const { data: post } = await classDb.from('class_posts').select('class_id').eq('id', req.params.postId).single();
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài.' });
    const { role } = await getClassRole(post.class_id, req.user.id);
    if (!role) return res.status(403).json({ error: 'Không có quyền.' });
    const { data, error } = await classDb.from('class_post_comments')
      .select('*').eq('post_id', req.params.postId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(await attachAuthors(data || []));
  } catch (err) { res.status(500).json({ error: 'Không thể tải bình luận.' }); }
};

// POST /api/classes/board/:postId/comments — thành viên lớp bình luận
exports.addComment = async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Bình luận trống.' });
  try {
    const { data: post } = await classDb.from('class_posts').select('class_id').eq('id', req.params.postId).single();
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài.' });
    const { role } = await getClassRole(post.class_id, req.user.id);
    if (!role) return res.status(403).json({ error: 'Không có quyền.' });
    const { data, error } = await classDb.from('class_post_comments')
      .insert({ post_id: req.params.postId, author_id: req.user.id, body: body.trim() }).select().single();
    if (error) throw error;
    res.status(201).json((await attachAuthors([data]))[0]);
  } catch (err) { res.status(500).json({ error: 'Không thể bình luận.' }); }
};

// DELETE /api/classes/board/comments/:commentId — tác giả hoặc GV chủ lớp
exports.deleteComment = async (req, res) => {
  try {
    const { data: cmt } = await classDb.from('class_post_comments').select('author_id, post_id').eq('id', req.params.commentId).single();
    if (!cmt) return res.status(404).json({ error: 'Không tìm thấy.' });
    let allowed = cmt.author_id === req.user.id;
    if (!allowed) {
      const { data: post } = await classDb.from('class_posts').select('class_id').eq('id', cmt.post_id).single();
      const { role } = post ? await getClassRole(post.class_id, req.user.id) : { role: null };
      allowed = role === 'teacher';
    }
    if (!allowed) return res.status(403).json({ error: 'Không có quyền.' });
    await classDb.from('class_post_comments').delete().eq('id', req.params.commentId);
    res.json({ message: 'Đã xóa bình luận.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// POST /api/classes/:id/board/upload — GV upload file/ảnh đính kèm
exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file.' });
  try {
    const { role } = await getClassRole(req.params.id, req.user.id);
    if (role !== 'teacher') return res.status(403).json({ error: 'Không có quyền.' });
    const safe = req.file.originalname.replace(/[^\w.\-]/g, '_');
    const path = `${req.params.id}/${Date.now()}_${safe}`;
    const { error } = await supabaseAdmin.storage.from('class-files')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: urlData } = supabaseAdmin.storage.from('class-files').getPublicUrl(path);
    res.json({ file_url: urlData.publicUrl, file_name: req.file.originalname });
  } catch (err) {
    console.error('uploadFile error:', err);
    res.status(500).json({ error: 'Không thể tải file lên.' });
  }
};

// GET /api/classes/teacher/exams — danh sách đề thi của GV để gắn vào bài kiểm tra
exports.listTeacherExams = async (req, res) => {
  try {
    const { data, error } = await examDb.from('quizzes')
      .select('id, title').eq('teacher_id', req.user.id).eq('is_exam', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Không thể tải đề thi.' }); }
};
