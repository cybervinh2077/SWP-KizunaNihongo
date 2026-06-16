import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/layout/AdminLayout';
import TeacherLayout from '../components/layout/TeacherLayout';
import StudentLayout from '../components/layout/StudentLayout';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import api from '../lib/api';

const TYPE_META = {
  announcement: { icon: 'campaign',   label: 'Thông báo',   color: 'bg-sky-100 text-sky-700' },
  material:     { icon: 'link',       label: 'Tài liệu',    color: 'bg-violet-100 text-violet-700' },
  homework:     { icon: 'assignment', label: 'Bài tập',     color: 'bg-amber-100 text-amber-700' },
  quiz:         { icon: 'quiz',       label: 'Bài kiểm tra', color: 'bg-tsubaki-red/10 text-tsubaki-red' },
};

const fmt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

// ── Khối bình luận ──────────────────────────────────────────────────────────
function Comments({ postId, role, onCountChange }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get(`/classes/board/${postId}/comments`); setList(r.data || []); } catch { setList([]); }
  }, [postId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/classes/board/${postId}/comments`, { body: text });
      setList(l => [...(l || []), r.data]); setText(''); onCountChange?.(1);
    } catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const del = async (id) => {
    try { await api.delete(`/classes/board/comments/${id}`); setList(l => l.filter(c => c.id !== id)); onCountChange?.(-1); } catch {}
  };

  return (
    <div className="mt-3 pt-3 border-t border-outline/20 space-y-2">
      {(list || []).map(c => (
        <div key={c.id} className="flex items-start gap-2 group">
          <div className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-xs font-bold shrink-0">
            {(c.author?.full_name?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs"><span className="font-semibold">{c.author?.full_name || 'Ẩn'}</span>
              <span className="text-on-muted ml-2">{fmt(c.created_at)}</span></p>
            <p className="text-sm text-charcoal whitespace-pre-wrap break-words">{c.body}</p>
          </div>
          <button onClick={() => del(c.id)} title="Xóa"
            className="opacity-0 group-hover:opacity-100 text-on-muted hover:text-error text-xs p-1">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Viết bình luận..." className="flex-1 px-3 py-1.5 text-sm border border-outline rounded-lg outline-none focus:border-tsubaki-red" />
        <button onClick={add} disabled={busy || !text.trim()} className="text-tsubaki-red disabled:opacity-40">
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  );
}

// ── Thẻ bài đăng ────────────────────────────────────────────────────────────
function PostCard({ post, role, onDelete, onTakeQuiz }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(post.comment_count || 0);
  const meta = TYPE_META[post.type] || TYPE_META.announcement;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
          <span className="material-symbols-outlined">{meta.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
            {post.is_pinned && <span className="material-symbols-outlined text-amber-500 text-[16px]">push_pin</span>}
            {post.due_at && <span className="text-[11px] text-amber-600">⏰ Hạn: {fmt(post.due_at)}</span>}
            <span className="text-[11px] text-on-muted ml-auto">{post.author?.full_name || ''} · {fmt(post.created_at)}</span>
          </div>
          {post.title && <h3 className="font-bold text-base mt-1">{post.title}</h3>}
          {post.body && <p className="text-sm text-charcoal whitespace-pre-wrap break-words mt-1">{post.body}</p>}
          {post.link_url && (
            <a href={post.link_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-sumire-purple hover:underline mt-2 break-all">
              <span className="material-symbols-outlined text-base">open_in_new</span>{post.link_url}
            </a>
          )}
          {post.file_url && (
            <a href={post.file_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-sumire-purple hover:underline mt-2">
              <span className="material-symbols-outlined text-base">attach_file</span>{post.file_name || 'Tệp đính kèm'}
            </a>
          )}
          {post.type === 'quiz' && post.assignment_id && (
            <div className="mt-3">
              <Button onClick={() => onTakeQuiz(post)} className="text-sm">
                <span className="material-symbols-outlined text-base">play_arrow</span>
                {role === 'teacher' ? 'Xem / Quản lý đề' : 'Làm bài'}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-on-muted">
            <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 hover:text-tsubaki-red">
              <span className="material-symbols-outlined text-base">chat_bubble</span>
              {count > 0 ? `${count} bình luận` : 'Bình luận'}
            </button>
            {role === 'teacher' && (
              <button onClick={() => onDelete(post)} className="inline-flex items-center gap-1 hover:text-error">
                <span className="material-symbols-outlined text-base">delete</span>Xóa
              </button>
            )}
          </div>
          {open && <Comments postId={post.id} role={role} onCountChange={d => setCount(c => c + d)} />}
        </div>
      </div>
    </div>
  );
}

// ── Modal đăng bài ──────────────────────────────────────────────────────────
function CreatePostModal({ open, onClose, classId, onCreated }) {
  const [type, setType]   = useState('announcement');
  const [form, setForm]   = useState({ title:'', body:'', link_url:'', due_at:'', is_pinned:false });
  const [file, setFile]   = useState(null);
  const [exams, setExams] = useState([]);
  const [examMode, setExamMode] = useState('existing'); // existing | new
  const [examId, setExamId]     = useState('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (open) {
      setType('announcement'); setForm({ title:'', body:'', link_url:'', due_at:'', is_pinned:false });
      setFile(null); setExamMode('existing'); setExamId(''); setNewExamTitle(''); setError('');
      api.get('/classes/teacher/exams').then(r => setExams(r.data || [])).catch(() => {});
    }
  }, [open]);

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      const payload = { type, title: form.title, body: form.body, is_pinned: form.is_pinned };
      if (type === 'material') payload.link_url = form.link_url;
      if (type === 'homework' || type === 'quiz') payload.due_at = form.due_at || null;
      if (type === 'quiz') {
        if (examMode === 'existing') { if (!examId) throw new Error('Chọn một đề thi.'); payload.exam_id = examId; }
        else { if (!newExamTitle.trim()) throw new Error('Nhập tên đề mới.'); payload.new_exam_title = newExamTitle.trim(); }
      }
      // Upload file trước nếu có
      if (file) {
        const fd = new FormData(); fd.append('file', file);
        const up = await api.post(`/classes/${classId}/board/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.file_url = up.data.file_url; payload.file_name = up.data.file_name;
      }
      const r = await api.post(`/classes/${classId}/board`, payload);
      onCreated(r.data);
      onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const TABS = [['announcement','Thông báo'],['material','Tài liệu'],['homework','Bài tập'],['quiz','Bài kiểm tra']];

  return (
    <Modal open={open} onClose={onClose} title="Đăng bài lên lớp" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button loading={saving} onClick={submit}>Đăng</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([v, l]) => (
            <button key={v} onClick={() => setType(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${type===v ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red' : 'border-outline text-on-muted'}`}>
              <span className="material-symbols-outlined text-base align-middle mr-1">{TYPE_META[v].icon}</span>{l}
            </button>
          ))}
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <Input label="Tiêu đề" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Tiêu đề bài đăng" />
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nội dung</label>
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={3}
            className="w-full px-4 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none"
            placeholder="Nội dung / mô tả..." />
        </div>

        {type === 'material' && (
          <Input label="Đường link" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
        )}

        {(type === 'material' || type === 'homework' || type === 'announcement') && (
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tệp đính kèm (tùy chọn)</label>
            <input type="file" onChange={e => setFile(e.target.files[0] || null)} className="text-sm" />
          </div>
        )}

        {(type === 'homework' || type === 'quiz') && (
          <Input label="Hạn nộp / hạn làm" type="datetime-local" value={form.due_at}
            onChange={e => setForm({ ...form, due_at: e.target.value })} />
        )}

        {type === 'quiz' && (
          <div className="space-y-3 p-3 rounded-xl bg-surface-low/50 border border-outline/30">
            <div className="flex gap-2">
              {[['existing','Đề có sẵn'],['new','Tạo đề mới']].map(([v,l]) => (
                <button key={v} onClick={() => setExamMode(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${examMode===v ? 'border-tsubaki-red text-tsubaki-red' : 'border-outline text-on-muted'}`}>{l}</button>
              ))}
            </div>
            {examMode === 'existing' ? (
              <select value={examId} onChange={e => setExamId(e.target.value)}
                className="w-full px-3 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">— Chọn đề thi —</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </select>
            ) : (
              <>
                <Input label="Tên đề mới" value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} placeholder="VD: Kiểm tra 15 phút bài 1" />
                <p className="text-[11px] text-on-muted">Sau khi đăng, vào trang <strong>Đề thi</strong> để thêm câu hỏi cho đề mới này.</p>
              </>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} className="accent-tsubaki-red" />
          <span className="text-sm">Ghim lên đầu</span>
        </label>
      </div>
    </Modal>
  );
}

// ── Trang chính ─────────────────────────────────────────────────────────────
export default function ClassBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isTeacher } = useAuth();
  const Layout = isAdmin() ? AdminLayout : isTeacher() ? TeacherLayout : StudentLayout;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/classes/${id}/board`); setData(r.data); }
    catch (e) { setError(e.response?.data?.error || 'Không thể tải lớp.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (post) => {
    if (!confirm('Xóa bài đăng này?')) return;
    try { await api.delete(`/classes/board/${post.id}`); setData(d => ({ ...d, posts: d.posts.filter(p => p.id !== post.id) })); } catch {}
  };
  const takeQuiz = (post) => navigate(`/exams/${post.assignment_id}`);

  return (
    <Layout title="Lớp học">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại
        </button>

        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
        ) : data && (
          <>
            <div className="flex items-center justify-between mb-6 gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">{data.class?.name}</h1>
                {data.class?.description && <p className="text-sm text-on-muted mt-0.5">{data.class.description}</p>}
              </div>
              {data.role === 'teacher' && (
                <Button onClick={() => setModal(true)}><span className="material-symbols-outlined text-lg">add</span> Đăng bài</Button>
              )}
            </div>

            {data.posts.length === 0 ? (
              <div className="glass-card rounded-2xl p-16 text-center">
                <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">dashboard</span>
                <p className="font-bold text-lg mb-1">Bảng lớp trống</p>
                <p className="text-on-muted text-sm">{data.role === 'teacher' ? 'Đăng bài đầu tiên cho lớp của bạn.' : 'Chưa có bài đăng nào.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.posts.map(p => (
                  <PostCard key={p.id} post={p} role={data.role} onDelete={handleDelete} onTakeQuiz={takeQuiz} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <CreatePostModal open={modal} onClose={() => setModal(false)} classId={id} onCreated={() => load()} />
    </Layout>
  );
}
