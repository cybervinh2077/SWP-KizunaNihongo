import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS      = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SKILLS      = ['Đọc hiểu', 'Nghe hiểu', 'Nói', 'Viết'];
const DIFFICULTIES = [{ value: 'easy', label: 'Dễ' }, { value: 'medium', label: 'Trung bình' }, { value: 'hard', label: 'Khó' }];
const STATUSES    = [{ value: 'pending', label: 'Chờ duyệt' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'draft', label: 'Nháp' }];

const LEVEL_COLORS = {
  N5: 'bg-emerald-500 text-white',
  N4: 'bg-sky-500 text-white',
  N3: 'bg-violet-500 text-white',
  N2: 'bg-orange-500 text-white',
  N1: 'bg-tsubaki-red text-white',
};
const SKILL_ICONS = {
  'Đọc hiểu': 'menu_book',
  'Nghe hiểu': 'headphones',
  'Nói':       'record_voice_over',
  'Viết':      'edit_note',
};
const DIFF_COLORS = {
  easy:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard:   'bg-red-100 text-red-700',
};
const STATUS_CONFIG = {
  approved: { label: 'Đã duyệt', icon: 'check_circle',  cls: 'text-emerald-600' },
  pending:  { label: 'Chờ duyệt', icon: 'pending',       cls: 'text-amber-600' },
  draft:    { label: 'Nháp',      icon: 'draft',          cls: 'text-on-muted' },
};

const EMPTY_FORM = {
  question_text: '', options: ['', '', '', ''], correct_answer: '',
  explanation: '', level: '', skill: '', topic: '', difficulty: 'medium',
  status: 'pending', is_ai_generated: false,
};

function StatCard({ icon, label, value, accent, iconBg }) {
  return (
    <div className={`glass-card rounded-2xl p-5 flex items-center justify-between group ${accent || ''}`}>
      <div>
        <p className="text-xs font-semibold text-on-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-bold text-charcoal">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
  );
}

function PreviewModal({ item, onClose }) {
  if (!item) return null;
  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {item.level && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level]}`}>{item.level}</span>}
              {item.skill && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-low text-on-muted border border-outline">
                  <span className="material-symbols-outlined text-[13px]">{SKILL_ICONS[item.skill] || 'quiz'}</span>
                  {item.skill}
                </span>
              )}
              {item.difficulty && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${DIFF_COLORS[item.difficulty]}`}>{DIFFICULTIES.find(d=>d.value===item.difficulty)?.label}</span>}
              {item.is_ai_generated && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sumire-purple/10 text-sumire-purple">
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span> AI
                </span>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-muted">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <p className="text-base font-semibold text-charcoal mb-4 leading-relaxed">{item.question_text}</p>

          {Array.isArray(item.options) && item.options.length > 0 && (
            <div className="space-y-2 mb-4">
              {item.options.map((opt, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-all
                  ${opt === item.correct_answer ? 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold' : 'border-outline bg-surface-low text-charcoal'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${opt === item.correct_answer ? 'bg-emerald-500 text-white' : 'bg-outline/30 text-on-muted'}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                  {opt === item.correct_answer && <span className="material-symbols-outlined text-[16px] ml-auto text-emerald-500">check_circle</span>}
                </div>
              ))}
            </div>
          )}

          {item.explanation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">lightbulb</span> Giải thích
              </p>
              <p className="text-sm text-amber-800">{item.explanation}</p>
            </div>
          )}

          {item.topic && (
            <p className="text-xs text-on-muted mt-3">
              Chủ đề: <span className="font-semibold text-charcoal">{item.topic}</span>
            </p>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline/30">
            <span className={`flex items-center gap-1 text-xs font-bold ${sc.cls}`}>
              <span className="material-symbols-outlined text-[16px]">{sc.icon}</span>{sc.label}
            </span>
            <span className="text-xs text-on-muted">{new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuestionBank() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [stats, setStats]     = useState({ total: 0, pending: 0, topLevel: '—' });
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [page, setPage]       = useState(1);
  const LIMIT = 15;

  // Filters
  const [search, setSearch]         = useState('');
  const [filterLevel, setFilterLevel]     = useState('');
  const [filterSkill, setFilterSkill]     = useState('');
  const [filterDiff, setFilterDiff]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');

  // Modals
  const [formModal, setFormModal] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const searchTimer = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const r = await api.get('/admin/question-bank/stats');
      setStats(r.data);
    } catch (_) {}
  }, []);

  const fetchItems = useCallback(async (p = 1, l = '', sk = '', d = '', st = '', s = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (l)  params.set('level', l);
      if (sk) params.set('skill', sk);
      if (d)  params.set('difficulty', d);
      if (st) params.set('status', st);
      if (s)  params.set('search', s);
      const r = await api.get(`/admin/question-bank?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, search);
  }, [page, filterLevel, filterSkill, filterDiff, filterStatus]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchItems(1, filterLevel, filterSkill, filterDiff, filterStatus, val);
    }, 400);
  };

  const resetFilters = () => {
    setSearch(''); setFilterLevel(''); setFilterSkill(''); setFilterDiff(''); setFilterStatus('');
    setPage(1);
    fetchItems(1, '', '', '', '', '');
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setFormModal(true); };
  const openEdit   = (row) => {
    setForm({
      question_text: row.question_text || '',
      options:       Array.isArray(row.options) ? [...row.options, '', '', '', ''].slice(0, 4) : ['','','',''],
      correct_answer: row.correct_answer || '',
      explanation:   row.explanation || '',
      level:         row.level || '',
      skill:         row.skill || '',
      topic:         row.topic || '',
      difficulty:    row.difficulty || 'medium',
      status:        row.status || 'pending',
      is_ai_generated: row.is_ai_generated || false,
    });
    setEditId(row.id);
    setFormModal(true);
  };

  const handleSave = async () => {
    if (!form.question_text.trim()) return setAlert({ type: 'error', msg: 'Nội dung câu hỏi là bắt buộc.' });
    setSaving(true);
    try {
      const payload = { ...form, options: form.options.filter(o => o.trim()) };
      if (editId) await api.put(`/admin/question-bank/${editId}`, payload);
      else        await api.post('/admin/question-bank', payload);
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi mới.' });
      setFormModal(false);
      fetchStats();
      fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, search);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    try {
      await api.delete(`/admin/question-bank/${row.id}`);
      setAlert({ type: 'success', msg: 'Đã xóa.' });
      fetchStats();
      fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, search);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const handleApprove = async (row) => {
    try {
      await api.put(`/admin/question-bank/${row.id}`, { status: 'approved' });
      setAlert({ type: 'success', msg: 'Đã duyệt câu hỏi.' });
      fetchStats();
      fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, search);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const hasFilters = filterLevel || filterSkill || filterDiff || filterStatus || search;

  return (
    <AdminLayout title="Ngân hàng câu hỏi">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-on-muted mb-1">Admin Panel / Ngân hàng câu hỏi</p>
          <h1 className="font-display text-2xl font-bold">Ngân hàng câu hỏi</h1>
        </div>
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-lg">add</span> Thêm câu hỏi
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon="library_books" label="Tổng câu hỏi" value={stats.total.toLocaleString()}
          iconBg="bg-surface-low text-on-muted"
        />
        <StatCard
          icon="notification_important" label="Chờ duyệt" value={stats.pending}
          accent="border-l-4 border-l-tsubaki-red"
          iconBg="bg-red-50 text-tsubaki-red"
        />
        <StatCard
          icon="trending_up" label="Cấp độ phổ biến nhất" value={stats.topLevel}
          iconBg="bg-sumire-purple/10 text-sumire-purple"
        />
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-2xl p-5 mb-4">
        {/* Search + buttons */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="flex-1 min-w-[260px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-lg">search</span>
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Tìm kiếm nội dung câu hỏi..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-low border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm text-tsubaki-red border border-tsubaki-red/30 hover:bg-tsubaki-red/5 transition-colors">
              <span className="material-symbols-outlined text-[16px]">filter_list_off</span> Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Cấp độ JLPT', value: filterLevel, onChange: setFilterLevel,
              opts: [['', 'Tất cả cấp độ'], ...LEVELS.map(l => [l, l])] },
            { label: 'Kỹ năng', value: filterSkill, onChange: setFilterSkill,
              opts: [['', 'Tất cả kỹ năng'], ...SKILLS.map(s => [s, s])] },
            { label: 'Độ khó', value: filterDiff, onChange: setFilterDiff,
              opts: [['', 'Tất cả độ khó'], ...DIFFICULTIES.map(d => [d.value, d.label])] },
            { label: 'Trạng thái', value: filterStatus, onChange: setFilterStatus,
              opts: [['', 'Tất cả trạng thái'], ...STATUSES.map(s => [s.value, s.label])] },
          ].map(({ label, value, onChange, opts }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-on-muted mb-1">{label}</label>
              <select
                value={value}
                onChange={e => { onChange(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-surface-low border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              >
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-low border-b border-outline/30">
                <th className="px-5 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Câu hỏi</th>
                <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide w-16">Cấp độ</th>
                <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Kỹ năng</th>
                <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Độ khó</th>
                <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/20">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-surface-low rounded animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">inventory_2</span>
                    <p className="font-semibold text-charcoal">
                      {hasFilters ? 'Không tìm thấy câu hỏi nào' : 'Chưa có câu hỏi nào'}
                    </p>
                    <p className="text-sm text-on-muted mt-1">
                      {hasFilters ? 'Thử thay đổi bộ lọc.' : 'Nhấn "Thêm câu hỏi" để bắt đầu xây dựng ngân hàng đề thi.'}
                    </p>
                  </td>
                </tr>
              ) : items.map(item => {
                const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={item.id} className="group hover:bg-surface-low/60 transition-colors">
                    {/* Question text + tags */}
                    <td className="px-5 py-4 max-w-xs">
                      <p className="text-sm font-medium text-charcoal line-clamp-2 leading-snug">{item.question_text}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.topic && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-surface-low border border-outline/60 rounded font-semibold text-on-muted uppercase">
                            {item.topic}
                          </span>
                        )}
                        {item.is_ai_generated && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-sumire-purple/10 rounded font-bold text-sumire-purple">
                            <span className="material-symbols-outlined text-[11px]">auto_awesome</span> AI
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Level */}
                    <td className="px-4 py-4">
                      {item.level
                        ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level]}`}>{item.level}</span>
                        : <span className="text-on-muted text-xs">—</span>}
                    </td>
                    {/* Skill */}
                    <td className="px-4 py-4">
                      {item.skill ? (
                        <div className="flex items-center gap-1.5 text-on-muted">
                          <span className="material-symbols-outlined text-[18px]">{SKILL_ICONS[item.skill] || 'quiz'}</span>
                          <span className="text-xs font-medium">{item.skill}</span>
                        </div>
                      ) : <span className="text-on-muted text-xs">—</span>}
                    </td>
                    {/* Difficulty */}
                    <td className="px-4 py-4">
                      {item.difficulty
                        ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${DIFF_COLORS[item.difficulty]}`}>
                            {DIFFICULTIES.find(d => d.value === item.difficulty)?.label}
                          </span>
                        : <span className="text-on-muted text-xs">—</span>}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className={`flex items-center gap-1 text-xs font-bold ${sc.cls}`}>
                        <span className="material-symbols-outlined text-[15px]">{sc.icon}</span>
                        {sc.label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPreviewItem(item)} title="Xem trước"
                          className="p-1.5 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        {item.status === 'pending' && (
                          <button onClick={() => handleApprove(item)} title="Duyệt"
                            className="p-1.5 rounded-lg text-on-muted hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                        )}
                        <button onClick={() => openEdit(item)} title="Sửa"
                          className="p-1.5 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete(item)} title="Xóa"
                          className="p-1.5 rounded-lg text-on-muted hover:bg-red-50 hover:text-tsubaki-red transition-colors">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 bg-surface-low/50 border-t border-outline/20 flex justify-between items-center">
          <p className="text-xs text-on-muted">
            {loading ? '...' : `Hiển thị ${Math.min((page-1)*LIMIT+1, total)}–${Math.min(page*LIMIT, total)} / ${total} câu hỏi`}
          </p>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline text-on-muted hover:bg-surface-low disabled:opacity-40 transition-colors">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(Math.ceil(total / LIMIT), 5) }).map((_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors
                    ${page === p ? 'bg-tsubaki-red text-white' : 'border border-outline text-on-muted hover:bg-surface-low'}`}>
                  {p}
                </button>
              );
            })}
            <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline text-on-muted hover:bg-surface-low disabled:opacity-40 transition-colors">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI suggestion banner */}
      <div className="glass-card rounded-2xl p-5 border-l-4 border-l-sumire-purple relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-[0.06] pointer-events-none">
          <span className="material-symbols-outlined text-[120px] text-sumire-purple">auto_awesome</span>
        </div>
        <div className="flex items-start gap-4 relative">
          <div className="w-10 h-10 rounded-full bg-sumire-purple/10 flex items-center justify-center text-sumire-purple shrink-0">
            <span className="material-symbols-outlined">lightbulb</span>
          </div>
          <div>
            <h4 className="font-bold text-charcoal mb-1">Gợi ý từ AI</h4>
            <p className="text-sm text-on-muted max-w-2xl">
              Ngân hàng câu hỏi hiện có <strong className="text-charcoal">{stats.total}</strong> câu.
              {stats.pending > 0 && <> Còn <strong className="text-amber-600">{stats.pending} câu chờ duyệt</strong> — hãy kiểm tra và phê duyệt để đưa vào sử dụng.</>}
              {' '}Sử dụng chức năng <span className="text-sumire-purple font-semibold">AI Generator</span> để tự động tạo thêm câu hỏi theo cấp độ và chủ đề mong muốn.
            </p>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}

      {/* Create / Edit modal */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={editId ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Question text */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Nội dung câu hỏi *</label>
            <textarea
              value={form.question_text}
              onChange={e => setForm({ ...form, question_text: e.target.value })}
              rows={3}
              placeholder="Nhập nội dung câu hỏi..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none transition-colors"
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2">Các lựa chọn</label>
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 flex-shrink-0 rounded-full bg-surface-low text-xs font-bold text-on-muted flex items-center justify-center">
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={opt}
                  onChange={e => { const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o }); }}
                  placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                  className="flex-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Correct answer */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Đáp án đúng</label>
            <select
              value={form.correct_answer}
              onChange={e => setForm({ ...form, correct_answer: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            >
              <option value="">-- Chọn đáp án --</option>
              {form.options.filter(Boolean).map((opt, i) => (
                <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>
              ))}
            </select>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Giải thích (tùy chọn)</label>
            <textarea
              value={form.explanation}
              onChange={e => setForm({ ...form, explanation: e.target.value })}
              rows={2}
              placeholder="Giải thích đáp án đúng..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none transition-colors"
            />
          </div>

          {/* Metadata row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                <option value="">-- Không có --</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Kỹ năng</label>
              <select value={form.skill} onChange={e => setForm({ ...form, skill: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                <option value="">-- Không có --</option>
                {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Metadata row 2 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Độ khó</label>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <Input
            label="Chủ đề"
            value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })}
            placeholder="Cuộc sống hàng ngày, Kinh doanh..."
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_ai_generated}
              onChange={e => setForm({ ...form, is_ai_generated: e.target.checked })}
              className="w-4 h-4 accent-sumire-purple rounded" />
            <span className="text-sm font-medium text-on-muted flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-sumire-purple">auto_awesome</span>
              Được tạo bởi AI
            </span>
          </label>
        </div>
      </Modal>
    </AdminLayout>
  );
}
