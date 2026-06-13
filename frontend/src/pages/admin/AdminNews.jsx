import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_STYLE = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const EMPTY = {
  title: '', title_vi: '', summary_vi: '', level: '',
  source: '', source_url: '', thumbnail_url: '',
  content: '', segments: [], is_published: false,
};

const LIMIT = 20;

export default function AdminNews() {
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading]   = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      const r = await api.get(`/admin/news?${params}`);
      setData(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchNews, 300);
    return () => clearTimeout(timer);
  }, [fetchNews]);

  // ── Form open ────────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = async (row) => {
    setEditId(row.id);
    setModal(true);
    try {
      const r = await api.get(`/admin/news/${row.id}`);
      const a = r.data;
      setForm({
        title:         a.title         || '',
        title_vi:      a.title_vi      || '',
        summary_vi:    a.summary_vi    || '',
        level:         a.level         || '',
        source:        a.source        || '',
        source_url:    a.source_url    || '',
        thumbnail_url: a.thumbnail_url || '',
        content:       a.content       || '',
        segments:      Array.isArray(a.segments) ? a.segments : [],
        is_published:  a.is_published  || false,
      });
    } catch (e) {
      showAlert('error', e.message);
    }
  };

  // ── Generate segments (AI) ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenerating(true);
    try {
      const r = await api.post('/admin/news/generate-segments', { content: form.content });
      setForm(f => ({ ...f, segments: r.data.segments || [] }));
      showAlert('success', `Đã tách & sinh ${r.data.segments?.length || 0} câu. Hãy kiểm tra lại trước khi lưu.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Thumbnail upload (dùng lại bucket passage-images) ─────────────────────────
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post('/admin/reading-passages/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, thumbnail_url: r.data.url }));
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Segment edit helpers ──────────────────────────────────────────────────────
  const updateSeg = (i, key, val) =>
    setForm(f => ({ ...f, segments: f.segments.map((s, idx) => idx === i ? { ...s, [key]: val } : s) }));
  const removeSeg = (i) =>
    setForm(f => ({ ...f, segments: f.segments.filter((_, idx) => idx !== i) }));
  const addSeg = () =>
    setForm(f => ({ ...f, segments: [...f.segments, { jp: '', furigana: '', vi: '' }] }));

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) return showAlert('error', 'Tiêu đề (tiếng Nhật) là bắt buộc.');
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/news/${editId}`, form);
      else        await api.post('/admin/news', form);
      showAlert('success', editId ? 'Đã cập nhật bài đọc.' : 'Đã tạo bài đọc.');
      setModal(false);
      fetchNews();
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/news/${deleteTarget.id}`);
      showAlert('success', 'Đã xóa bài đọc.');
      setDeleteTarget(null);
      if (data.length === 1 && page > 1) setPage(p => p - 1);
      else fetchNews();
    } catch (e) {
      showAlert('error', e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Quản lý Đọc báo">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            Luyện đọc báo <span className="ml-2 text-lg font-normal text-on-muted">({total})</span>
          </h1>
          <p className="text-sm text-on-muted mt-0.5">
            Tạo bài đọc tiếng Nhật, dùng AI tách câu + sinh furigana &amp; bản dịch, rồi đăng cho học viên.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Tạo bài đọc mới
        </Button>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl pointer-events-none">search</span>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm theo tiêu đề..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">newspaper</span>
          <p className="text-lg font-semibold text-charcoal mb-1">
            {search ? 'Không tìm thấy bài đọc' : 'Chưa có bài đọc nào'}
          </p>
          <p className="text-sm mb-6">Tạo bài đọc đầu tiên cho học viên</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {data.map(row => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-surface-low overflow-hidden shrink-0 flex items-center justify-center">
                {row.thumbnail_url
                  ? <img src={row.thumbnail_url} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  : <span className="material-symbols-outlined text-outline/40">newspaper</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate">{row.title}</p>
                {row.title_vi && <p className="text-xs text-on-muted truncate">{row.title_vi}</p>}
              </div>
              {row.level && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${LEVEL_STYLE[row.level] || 'bg-gray-100 text-gray-600'}`}>
                  {row.level}
                </span>
              )}
              <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                row.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {row.is_published ? 'Đã đăng' : 'Nháp'}
              </span>
              <span className="text-xs text-on-muted hidden md:block w-20 text-right">
                {row.created_at ? new Date(row.created_at).toLocaleDateString('vi') : '—'}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => openEdit(row)} title="Sửa"
                  className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onClick={() => setDeleteTarget(row)} title="Xóa"
                  className="p-1.5 text-on-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 transition-colors">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 transition-colors">Tiếp →</button>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa bài đọc' : 'Tạo bài đọc mới'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>{editId ? 'Lưu thay đổi' : 'Tạo bài đọc'}</Button>
          </>
        }
      >
        <NewsForm
          form={form}
          onChange={setForm}
          onGenerate={handleGenerate}
          generating={generating}
          onUpload={handleUpload}
          uploading={uploading}
          updateSeg={updateSeg}
          removeSeg={removeSeg}
          addSeg={addSeg}
        />
      </Modal>

      {/* Delete modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xóa bài đọc"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              Xóa vĩnh viễn
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-800">
          <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">warning</span>
          <p>Bài đọc <strong>"{deleteTarget?.title}"</strong> sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</p>
        </div>
      </Modal>
    </AdminLayout>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────
function NewsForm({ form, onChange, onGenerate, generating, onUpload, uploading, updateSeg, removeSeg, addSeg }) {
  return (
    <div className="space-y-4">
      {/* Metadata */}
      <Input
        label="Tiêu đề (Tiếng Nhật) *"
        value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })}
        placeholder="記事のタイトル..."
      />
      <Input
        label="Tiêu đề (Tiếng Việt)"
        value={form.title_vi}
        onChange={e => onChange({ ...form, title_vi: e.target.value })}
        placeholder="Dịch tiêu đề..."
      />

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả ngắn (hiển thị ở thẻ danh sách)</label>
        <textarea
          value={form.summary_vi}
          onChange={e => onChange({ ...form, summary_vi: e.target.value })}
          rows={2}
          placeholder="Tóm tắt ngắn bằng tiếng Việt..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
          <select
            value={form.level}
            onChange={e => onChange({ ...form, level: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
          >
            <option value="">-- Chọn cấp độ --</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
          <button
            type="button"
            onClick={() => onChange({ ...form, is_published: !form.is_published })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              form.is_published
                ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                : 'bg-surface-low border-outline text-on-muted hover:bg-outline/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{form.is_published ? 'public' : 'draft'}</span>
            {form.is_published ? 'Đăng cho học viên' : 'Bản nháp'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nguồn (vd: NHK)"
          value={form.source}
          onChange={e => onChange({ ...form, source: e.target.value })}
          placeholder="NHK, Asahi..."
        />
        <Input
          label="Link nguồn"
          value={form.source_url}
          onChange={e => onChange({ ...form, source_url: e.target.value })}
          placeholder="https://..."
        />
      </div>

      {/* Thumbnail */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Ảnh thumbnail</label>
        <div className="flex items-center gap-3">
          {form.thumbnail_url && (
            <img src={form.thumbnail_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-low shrink-0" />
          )}
          <Input
            className="flex-1"
            value={form.thumbnail_url}
            onChange={e => onChange({ ...form, thumbnail_url: e.target.value })}
            placeholder="Dán URL hoặc tải ảnh lên →"
          />
          <label className="shrink-0 cursor-pointer inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border border-outline text-sm font-medium text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">
            <span className="material-symbols-outlined text-[18px]">{uploading ? 'progress_activity' : 'upload'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={e => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      {/* Content + generate */}
      <div className="pt-2 border-t border-outline/30">
        <label className="block text-sm font-medium text-on-muted mb-1">Toàn văn tiếng Nhật</label>
        <textarea
          value={form.content}
          onChange={e => onChange({ ...form, content: e.target.value })}
          rows={5}
          placeholder="Dán toàn bộ nội dung bài báo tiếng Nhật vào đây..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-y leading-relaxed"
        />
        <Button variant="purple" size="sm" className="mt-2" loading={generating} onClick={onGenerate}>
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          Tách câu &amp; sinh furigana + dịch
        </Button>
      </div>

      {/* Segments review */}
      {form.segments.length > 0 && (
        <div className="pt-2 border-t border-outline/30">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-on-muted">
              Câu đã tách ({form.segments.length}) — kiểm tra &amp; sửa trước khi lưu
            </label>
            <button type="button" onClick={addSeg}
              className="text-xs font-semibold text-tsubaki-red hover:underline inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span> Thêm câu
            </button>
          </div>
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
            {form.segments.map((seg, i) => (
              <div key={i} className="relative bg-surface-low/50 border border-outline/40 rounded-xl p-3 space-y-2">
                <button type="button" onClick={() => removeSeg(i)}
                  className="absolute top-2 right-2 text-on-muted hover:text-error transition-colors" title="Xóa câu">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <SegField label="Câu (JP)" value={seg.jp} onChange={v => updateSeg(i, 'jp', v)} />
                <SegField label="Furigana (ruby HTML)" value={seg.furigana} onChange={v => updateSeg(i, 'furigana', v)} mono />
                <SegField label="Dịch (VI)" value={seg.vi} onChange={v => updateSeg(i, 'vi', v)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SegField({ label, value, onChange, mono }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-on-muted uppercase tracking-wide mb-0.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={mono ? 2 : 1}
        className={`w-full px-3 py-2 bg-white border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red transition-colors resize-y ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  );
}
