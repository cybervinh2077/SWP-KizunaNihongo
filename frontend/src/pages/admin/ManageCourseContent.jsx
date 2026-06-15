import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

// Các phần nhỏ trong một bài học — mỗi phần mở editor riêng (gắn theo lesson_id).
const LESSON_PARTS = [
  { seg: 'vocabulary', label: 'Từ vựng', icon: 'translate',  color: 'text-green-600',  bg: 'hover:bg-green-50' },
  { seg: 'kanji',      label: 'Kanji',   icon: 'draw',       color: 'text-purple-600', bg: 'hover:bg-purple-50' },
  { seg: 'grammar',    label: 'Ngữ pháp', icon: 'spellcheck', color: 'text-amber-600',  bg: 'hover:bg-amber-50' },
  { seg: 'reading',    label: 'Reading', icon: 'article',    color: 'text-primary',    bg: 'hover:bg-primary/10' },
  { seg: 'quiz',       label: 'Quiz',    icon: 'quiz',       color: 'text-tsubaki-red', bg: 'hover:bg-tsubaki-red/10' },
];

const EMPTY_LESSON = { title: '', title_ja: '', duration_minutes: '' };

// ── Lesson card ───────────────────────────────────────────────────────────────

function LessonCard({ lesson, index, onOpenPart, onEdit, onDelete, onDragStart, onDragOver, onDragEnd, isDragging }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`bg-white border rounded-2xl shadow-sm transition-all duration-200 group
        ${isDragging
          ? 'opacity-40 border-tsubaki-red/30 scale-[0.99]'
          : 'border-outline/30 hover:shadow-md'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline/10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined text-outline/50 cursor-grab text-xl shrink-0">drag_indicator</span>
          <span className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-on-surface text-sm truncate">{lesson.title}</h3>
            {lesson.title_ja && <p className="text-xs text-on-muted truncate">{lesson.title_ja}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(lesson)}
            title="Chỉnh sửa thông tin"
            className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">tune</span>
          </button>
          <button
            onClick={() => onDelete(lesson)}
            title="Xóa bài học"
            className="p-1.5 text-on-muted hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>

      {/* Part buttons */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {LESSON_PARTS.map(part => (
          <button
            key={part.seg}
            onClick={() => onOpenPart(lesson, part.seg)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border border-outline/20 text-xs font-medium text-on-surface transition-all ${part.bg} hover:border-outline/40`}
          >
            <span className={`material-symbols-outlined text-2xl ${part.color}`}>{part.icon}</span>
            {part.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManageCourseContent() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse]   = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Lesson modal state
  const [lessonModal, setLessonModal]   = useState(false);
  const [lessonForm, setLessonForm]     = useState(EMPTY_LESSON);
  const [editingLesson, setEditingLesson] = useState(null);
  const [savingLesson, setSavingLesson] = useState(false);

  // Drag state
  const dragIdx = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const loadCourse = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/courses/${courseId}/builder`);
      setCourse(r.data);
      setLessons(r.data.lessons || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Không thể tải khóa học.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourse(); }, [courseId]);

  // ── Publish / Unpublish ──────────────────────────────────────────────────────

  const handlePublishToggle = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/admin/courses/${courseId}`, { is_published: !course.is_published });
      setCourse(prev => ({ ...prev, is_published: r.data.is_published }));
      setAlert({ type: 'success', msg: r.data.is_published ? 'Đã xuất bản khóa học.' : 'Đã đưa về bản nháp.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Lesson CRUD ──────────────────────────────────────────────────────────────

  const openPart = (lesson, seg) => navigate(`/admin/lessons/${lesson.id}/${seg}`);

  const openAddLesson = () => {
    setLessonForm(EMPTY_LESSON);
    setEditingLesson(null);
    setLessonModal(true);
  };

  const openEditLesson = (lesson) => {
    setLessonForm({
      title: lesson.title || '',
      title_ja: lesson.title_ja || '',
      duration_minutes: lesson.duration_minutes || '',
    });
    setEditingLesson(lesson);
    setLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề bài học không được để trống.' });
    setSavingLesson(true);
    try {
      const payload = {
        title: lessonForm.title.trim(),
        title_ja: lessonForm.title_ja.trim() || null,
        duration_minutes: Number(lessonForm.duration_minutes) || 0,
      };
      if (editingLesson) {
        await api.put(`/admin/lessons/${editingLesson.id}`, payload);
      } else {
        await api.post('/admin/lessons', { ...payload, course_id: courseId, order_index: lessons.length });
      }
      setLessonModal(false);
      await loadCourse();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSavingLesson(false);
    }
  };

  const deleteLesson = async (lesson) => {
    if (!confirm(`Xóa bài học "${lesson.title}"?`)) return;
    try {
      await api.delete(`/admin/lessons/${lesson.id}`);
      await loadCourse();
      setAlert({ type: 'success', msg: 'Đã xóa bài học.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Drag & drop reorder ──────────────────────────────────────────────────────

  const handleDragStart = (e, idx) => {
    dragIdx.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const updated = [...lessons];
    const [moved] = updated.splice(dragIdx.current, 1);
    updated.splice(idx, 0, moved);
    dragIdx.current = idx;
    setDraggingIdx(idx);
    setLessons(updated);
  };

  const handleDragEnd = async () => {
    setDraggingIdx(null);
    dragIdx.current = null;
    try {
      await api.patch('/admin/lessons/reorder', {
        items: lessons.map((l, i) => ({ id: l.id, order_index: i })),
      });
    } catch (e) {
      setAlert({ type: 'error', msg: 'Không thể lưu thứ tự bài học.' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminLayout title="Quản lý nội dung khóa học">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </AdminLayout>
    );
  }

  if (!course) {
    return (
      <AdminLayout title="Quản lý nội dung khóa học">
        <div className="text-center py-24 text-on-muted">Không tìm thấy khóa học.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Quản lý nội dung khóa học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/courses')}
            className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại danh sách
          </button>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {course.level && (
              <span className="bg-surface-container-highest/60 text-on-muted px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                {course.level}
              </span>
            )}
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${
              course.is_published
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {course.is_published ? 'Đã xuất bản' : 'Bản nháp'}
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-on-surface">{course.title}</h1>
          {course.description && (
            <p className="text-on-muted text-sm mt-1 max-w-xl">{course.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handlePublishToggle}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${course.is_published
                ? 'bg-surface border border-outline text-on-surface hover:bg-surface-low'
                : 'bg-tsubaki-red text-white hover:shadow-lg active:scale-95'}`}
          >
            <span className="material-symbols-outlined text-base">
              {course.is_published ? 'unpublished' : 'publish'}
            </span>
            {saving ? 'Đang lưu...' : course.is_published ? 'Bỏ xuất bản' : 'Xuất bản'}
          </button>
        </div>
      </section>

      {/* ── Lesson list ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {lessons.map((lesson, idx) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            index={idx}
            onOpenPart={openPart}
            onEdit={openEditLesson}
            onDelete={deleteLesson}
            isDragging={draggingIdx === idx}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
          />
        ))}

        {lessons.length === 0 && (
          <div className="text-center py-10 text-on-muted text-sm">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-20">inbox</span>
            Chưa có bài học nào. Hãy thêm bài học đầu tiên bên dưới.
          </div>
        )}

        {/* Add lesson button */}
        <button
          onClick={openAddLesson}
          className="w-full py-10 bg-white border-2 border-dashed border-outline/25 rounded-2xl flex flex-col items-center justify-center gap-2
            hover:border-tsubaki-red/50 hover:bg-surface-container-low/30 transition-all group"
        >
          <div className="w-11 h-11 rounded-full bg-surface-container-highest/50 group-hover:bg-tsubaki-red group-hover:text-white transition-all flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">add</span>
          </div>
          <span className="font-semibold text-on-muted group-hover:text-tsubaki-red transition-colors text-sm">Thêm bài học mới</span>
          <p className="text-xs text-outline">Mỗi bài học chứa các phần: Từ vựng, Kanji, Ngữ pháp, Reading, Quiz</p>
        </button>
      </div>

      {/* ── Lesson Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={lessonModal}
        onClose={() => setLessonModal(false)}
        title={editingLesson ? 'Chỉnh sửa bài học' : 'Thêm bài học'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLessonModal(false)}>Hủy</Button>
            <Button loading={savingLesson} onClick={saveLesson}>Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Việt) *</label>
            <input
              type="text"
              value={lessonForm.title}
              onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))}
              placeholder="VD: Bài 1 – Chào hỏi"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Nhật)</label>
            <input
              type="text"
              value={lessonForm.title_ja}
              onChange={e => setLessonForm(f => ({ ...f, title_ja: e.target.value }))}
              placeholder="日本語のタイトル"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Thời lượng (phút)</label>
            <input
              type="number"
              min="0"
              value={lessonForm.duration_minutes}
              onChange={e => setLessonForm(f => ({ ...f, duration_minutes: e.target.value }))}
              placeholder="0"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
