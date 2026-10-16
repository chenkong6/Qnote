import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  History,
  Calendar,
  Settings,
  Sparkles,
  Trash2,
  LogOut,
  Moon,
  Sun,
  Plus,
  RefreshCw,
  Cloud,
  Upload,
  Download,
  File as FileIcon,
  Search,
  Share2,
  Lock,
  Globe2,
  ListTree,
  X,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format, subDays, startOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseUtcTimestamp(value: string) {
  if (!value) return new Date(NaN);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(`${value.replace(' ', 'T')}Z`);
}

interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
  line: number;
}

function markdownHeadingText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[>*_~]/g, '')
    .trim();
}

function getMarkdownHeadings(content: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const lines = content.split(/\r?\n/);
  let fenceCharacter = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const character = fence[1][0];
      fenceCharacter = fenceCharacter === character ? '' : character;
      continue;
    }
    if (fenceCharacter) continue;

    const atx = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (atx) {
      const text = markdownHeadingText(atx[2]);
      if (text) headings.push({ id: `shared-heading-${index + 1}`, text, level: atx[1].length, line: index + 1 });
      continue;
    }

    const underline = lines[index + 1]?.match(/^\s{0,3}(=+|-+)\s*$/);
    const text = markdownHeadingText(line);
    if (underline && text) {
      headings.push({
        id: `shared-heading-${index + 1}`,
        text,
        level: underline[1][0] === '=' ? 1 : 2,
        line: index + 1,
      });
      index += 1;
    }
  }

  return headings;
}

// --- Types ---
interface Entry {
  id: number;
  content: string;
  mood: string;
  visibility?: 'private' | 'public';
  weight: number;
  created_at: string;
}

interface HeatmapData {
  date: string;
  weight: number;
}

interface CloudFile {
  id: number;
  filename: string;
  content_type: string;
  size: number;
  visibility: 'private' | 'public';
  created_at: string;
}

type ThemeId = 'default' | 'charcoal-pink' | 'indigo-water' | 'warm-red' | 'vine-violet' | 'deepsea-milk';

const THEME_STORAGE_KEY = 'qnote-theme';

const COLOR_THEMES: Array<{
  id: ThemeId;
  name: string;
  description: string;
  colors: [string, string];
  cmyk: [string, string];
}> = [
  {
    id: 'default',
    name: '默认黑白',
    description: '当前经典编辑主题',
    colors: ['#0A0A0A', '#FFFFFF'],
    cmyk: ['默认深黑', '默认纯白'],
  },
  {
    id: 'charcoal-pink',
    name: '炭黑色 + 甜酷粉',
    description: '炭黑色 #1A1A1D / 甜酷粉 #E6397C',
    colors: ['#1A1A1D', '#E6397C'],
    cmyk: ['C85 M81 Y76 K64', 'C12 M88 Y26 K0'],
  },
  {
    id: 'indigo-water',
    name: '捣蓝色 + 清水蓝',
    description: '捣蓝色 #113056 / 清水蓝 #91CFD5',
    colors: ['#113056', '#91CFD5'],
    cmyk: ['C99 M90 Y51 K20', 'C47 M6 Y20 K0'],
  },
  {
    id: 'warm-red',
    name: '无白色 + 茶花红',
    description: '无白色 #F1DDDF / 茶花红 #E72D48',
    colors: ['#F1DDDF', '#E72D48'],
    cmyk: ['C7 M17 Y9 K0', 'C10 M92 Y63 K0'],
  },
  {
    id: 'vine-violet',
    name: '藤紫色 + 钛啡绿',
    description: '藤紫色 #91C53A / 钛啡绿 #5E55A2',
    colors: ['#91C53A', '#5E55A2'],
    cmyk: ['C51 M6 Y90 K0', 'C74 M73 Y8 K0'],
  },
  {
    id: 'deepsea-milk',
    name: '深海蓝 + 柔奶白',
    description: '深海蓝 #122E8A / 柔奶白 #F5EFEA',
    colors: ['#122E8A', '#F5EFEA'],
    cmyk: ['C100 M93 Y20 K0', 'C5 M7 Y9 K0'],
  },
];

function getInitialTheme(): ThemeId {
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
  if (saved && COLOR_THEMES.some(theme => theme.id === saved)) return saved;
  const randomTheme = COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)].id;
  localStorage.setItem(THEME_STORAGE_KEY, randomTheme);
  return randomTheme;
}

export default function App() {
  const sharedEntryId = new URLSearchParams(window.location.search).get('share');
  const privateShareToken = new URLSearchParams(window.location.search).get('privateShare');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);
  const [view, setView] = useState<'home' | 'timeline' | 'heatmap' | 'files' | 'random' | 'settings'>('home');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData[]>([]);
  const [user, setUser] = useState<{email: string} | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Auth State
  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } else {
      // optional: surface error to user via toast (kept simple here)
      alert(data.error || '登录失败');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const hRes = await fetch('/api/heatmap', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const entriesRes = await fetch('/api/entries', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (hRes.status === 401 || entriesRes.status === 401) {
        logout();
        return;
      }

      const heatmapData = await hRes.json();
      const entriesData = await entriesRes.json();

      if (!hRes.ok || !entriesRes.ok) {
        throw new Error(heatmapData.error || entriesData.error || '同步失败');
      }

      setHeatmap(Array.isArray(heatmapData) ? heatmapData : []);
      setEntries(Array.isArray(entriesData) ? entriesData : []);
    } catch (e) {
      console.error(e);
      setHeatmap([]);
      setEntries([]);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  if (sharedEntryId) return <SharedEntryPage endpoint={`/api/public/entries/${sharedEntryId}`} label="公开记录" />;
  if (privateShareToken) {
    const [entryId, hash] = privateShareToken.split('-');
    return <SharedEntryPage endpoint={`/api/private-share/${entryId}/${hash}`} label="私密分享" />;
  }

  if (!token) return <AuthPage onLogin={login} />;

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-white selection:text-black overflow-hidden">
      {/* Editorial Navigation Rail */}
      <Navigation view={view} setView={setView} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Main Workspace Header */}
        <header className="p-12 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-6xl font-serif italic tracking-tighter">碎片</h1>
            <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mt-2 px-1">私人时间流 / 0.1</p>
          </div>
          <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right mb-1">
            状态：已同步<br/>
            节点：Edge-HKG
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-12 py-8 custom-scrollbar">
          <div className="max-w-4xl">
            <AnimatePresence mode="wait">
              {view === 'home' && (
                <HomeView key="home" token={token} onNewEntry={fetchData} recentEntries={entries.slice(0, 5)} />
              )}
              {view === 'timeline' && (
                <TimelineView key="timeline" entries={entries} token={token} onChange={fetchData} />
              )}
              {view === 'heatmap' && (
                <EnhancedHeatmapView key="heatmap" data={heatmap} />
              )}
              {view === 'files' && (
                <CloudDriveView token={token} />
              )}
              {view === 'random' && (
                <RandomView key="random" token={token} />
              )}
              {view === 'settings' && (
                <SettingsView key="settings" user={user} theme={theme} onThemeChange={setTheme} onLogout={logout} />
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Global Footer Area */}
        <footer className="h-16 border-t border-neutral-900 px-12 flex items-center justify-between">
          <div className="flex space-x-12">
             <div className="flex flex-col">
              <span className="text-[9px] text-neutral-600 uppercase tracking-wider">本地持久化</span>
              <span className="text-[11px] font-mono">SQLite / fragment.db</span>
            </div>
          </div>
          <div className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">
            &copy; 2024 私人时间流 · 匿名
          </div>
        </footer>
      </main>
    </div>
  );
}

// --- Views ---

function AuthPage({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6 selection:bg-white selection:text-black">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-12"
      >
        <div className="text-center space-y-4">
          <h1 className="text-7xl font-serif italic tracking-tighter text-white">碎片</h1>
          <div className="flex items-center justify-center gap-4">
             <div className="h-px w-8 bg-neutral-900"></div>
             <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.3em]">意识流记录</p>
             <div className="h-px w-8 bg-neutral-900"></div>
          </div>
        </div>

          <div className="space-y-4 p-10 bg-neutral-900/20 border border-neutral-900 rounded-[3rem]">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest ml-4">账号</label>
            <input
              type="email"
              placeholder="邮箱地址"
              className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl text-white placeholder:text-neutral-800 focus:outline-none focus:border-neutral-600 transition-all font-mono text-sm"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 mt-4">
            <label className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest ml-4">密码</label>
            <input
              type="password"
              placeholder="输入密码"
              className="w-full px-6 py-4 bg-black border border-neutral-800 rounded-2xl text-white placeholder:text-neutral-800 focus:outline-none focus:border-neutral-600 transition-all font-mono text-sm"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onLogin(email, password)}
            className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-neutral-200 transition-all text-sm uppercase tracking-widest mt-4"
          >
            进入
          </motion.button>
          <p className="text-[9px] font-mono text-neutral-700 text-center uppercase tracking-tighter mt-6">
            JWT 鉴权 · 本地 SQLite 持久化
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Navigation({ view, setView }: { view: string, setView: (v: any) => void }) {
  const items = [
    { id: 'home', icon: Plus, label: '记录' },
    { id: 'timeline', icon: History, label: '时间线' },
    { id: 'heatmap', icon: Calendar, label: '热力图' },
    { id: 'files', icon: Cloud, label: '云盘' },
    { id: 'random', icon: Sparkles, label: '随机' },
    { id: 'settings', icon: Settings, label: '设置' },
  ];

  return (
    <nav className="w-24 border-r border-neutral-900 flex flex-col items-center py-12 space-y-12 bg-neutral-950">
      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-white/5">
        <div className="w-5 h-5 bg-black rounded-full"></div>
      </div>

      <div className="flex flex-col space-y-10">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "flex flex-col items-center gap-2 transition-all relative group",
              view === item.id ? "text-white scale-110" : "text-neutral-600 hover:text-neutral-400"
            )}
          >
            <item.icon size={22} strokeWidth={1.5} />
            <span className={cn(
              "text-[8px] uppercase tracking-widest font-mono transition-opacity",
              view === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              {item.label}
            </span>
            {view === item.id && (
              <motion.div
                layoutId="activeNav"
                className="absolute -right-[1.5rem] w-1 h-8 bg-white rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <div className="w-10 h-10 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-neutral-500 font-mono text-[10px]">
          USR
        </div>
      </div>
    </nav>
  );
}

interface HomeViewProps {
  key?: string;
  token: string;
  onNewEntry: () => void;
  recentEntries: Entry[];
}

function HomeView({ token, onNewEntry, recentEntries }: HomeViewProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content }),
      });
      setContent('');
      onNewEntry();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      submit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-12"
    >
      <div className="relative group bg-neutral-900 border border-neutral-800 rounded-3xl p-8 focus-within:border-neutral-700 transition-all">
        <textarea
          ref={inputRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="写下此刻闪过的念头..."
          className="w-full min-h-[140px] bg-transparent text-3xl font-serif italic tracking-tight resize-none focus:outline-none placeholder:text-neutral-800"
        />
        <div className="flex items-center justify-between mt-6">
          <div className="flex space-x-2">
            <span className="px-3 py-1 bg-neutral-800 text-neutral-500 text-[10px] font-mono uppercase tracking-widest rounded-full border border-neutral-700">情绪：平静</span>
            <span className="px-3 py-1 bg-neutral-800 text-neutral-500 text-[10px] font-mono uppercase tracking-widest rounded-full border border-neutral-700">来源：网页</span>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">⌘/Ctrl + Enter</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={submit}
              disabled={!content.trim() || submitting}
              className={cn(
                "px-8 py-3 rounded-full font-bold text-sm tracking-tight transition-all",
                content.trim() ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
              )}
            >
              保存
            </motion.button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-px flex-1 bg-neutral-900"></div>
          <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-neutral-600">最近记录</span>
          <div className="h-px flex-1 bg-neutral-900"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentEntries.map(entry => (
            <div key={entry.id} className="p-6 bg-neutral-900/30 border border-neutral-900 rounded-2xl group hover:border-neutral-800 transition-all">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tight">{format(parseUtcTimestamp(entry.created_at), 'HH:mm')}</span>
                <span className="text-[10px] italic text-neutral-500 font-serif lowercase">fragment#{entry.id}</span>
              </div>
              <p className="text-base leading-relaxed text-neutral-300 font-sans line-clamp-3">{entry.content}</p>
            </div>
          ))}
          {recentEntries.length === 0 && <p className="text-xs font-mono text-neutral-700 italic col-span-full">还没有碎片记录。</p>}
        </div>
      </div>
    </motion.div>
  );
}

interface TimelineViewProps {
  key?: string;
  entries: Entry[];
  token: string;
  onChange: () => void;
}

function TimelineView({ entries, token, onChange }: TimelineViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openEntry, setOpenEntry] = useState<Entry | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const trimmedQuery = searchQuery.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const filteredEntries = normalizedQuery
    ? entries.filter((entry) => {
        const createdAt = parseUtcTimestamp(entry.created_at);
        const localDate = Number.isNaN(createdAt.getTime())
          ? ''
          : format(createdAt, 'yyyy年M月d日 HH:mm:ss yyyy-MM-dd HH:mm:ss', { locale: zhCN });
        const visibility = entry.visibility === 'public' ? '公开 public' : '私密 private';
        const haystack = [
          entry.id,
          entry.content,
          entry.mood || '平静',
          entry.weight,
          visibility,
          localDate,
        ].join(' ').toLowerCase();

        return haystack.includes(normalizedQuery);
      })
    : entries;

  const deleteEntry = async (id: number) => {
    if (!confirm('确定删除这条记忆吗？')) return;
    await fetch(`/api/entries/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    onChange();
  };

  const beginEditing = (entry: Entry) => {
    setOpenEntry(null);
    setEditingEntry(entry);
    setEditingContent(entry.content);
  };

  const saveEntry = async () => {
    if (!editingEntry || !editingContent.trim() || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/entries/${editingEntry.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editingContent }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '保存失败，请稍后重试。');
      setEditingEntry(null);
      onChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = async (entry: Entry) => {
    if (entry.visibility !== 'public') {
      await fetch(`/api/entries/${entry.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visibility: 'public' }),
      });
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${entry.id}`;
    await navigator.clipboard.writeText(shareUrl);
    await onChange();
    alert('公开链接已复制，可以分享给别人。');
  };

  const copyPrivateShareLink = async (entry: Entry) => {
    const res = await fetch(`/api/entries/${entry.id}/private-share`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '生成私密分享链接失败');
      return;
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?privateShare=${data.token}`;
    await navigator.clipboard.writeText(shareUrl);
    alert('私密分享链接已复制，不会把这条记录改为公开。');
  };

  const makePrivate = async (id: number) => {
    await fetch(`/api/entries/${id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ visibility: 'private' }),
    });
    onChange();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-4xl font-serif italic tracking-tight">完整时间线</h2>
        <div className="h-px flex-1 bg-neutral-900 mx-8"></div>
        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          {trimmedQuery ? `显示 ${filteredEntries.length} / ${entries.length} 条` : `已收集 ${entries.length} 条`}
        </span>
      </header>

      <section className="p-4 bg-neutral-900/20 border border-neutral-900 rounded-2xl">
        <div className="flex flex-col md:flex-row gap-3">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索正文、日期、心情、编号或分享状态"
              className="w-full pl-11 pr-4 py-3 rounded-full bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-all"
            />
          </label>
          <button
            onClick={() => setSearchQuery('')}
            disabled={!trimmedQuery}
            className={cn(
              'px-5 py-3 rounded-full border text-sm font-bold transition-all',
              trimmedQuery
                ? 'bg-white text-black border-white hover:bg-neutral-200'
                : 'bg-neutral-950 text-neutral-700 border-neutral-900 cursor-not-allowed'
            )}
          >
            清空搜索
          </button>
        </div>
      </section>

      <div className="space-y-8">
        {filteredEntries.length === 0 && (
          <div className="p-10 border border-neutral-900 rounded-2xl bg-neutral-900/20 text-center">
            <Search size={32} className="mx-auto text-neutral-700 mb-4" />
            <p className="text-sm font-mono text-neutral-600">没有找到匹配的记录。</p>
          </div>
        )}
        {filteredEntries.map((entry, idx) => {
          const date = format(parseUtcTimestamp(entry.created_at), 'yyyy年M月d日', { locale: zhCN });
          const prevDate = idx > 0 ? format(parseUtcTimestamp(filteredEntries[idx-1].created_at), 'yyyy年M月d日', { locale: zhCN }) : null;
          const showDate = date !== prevDate;

          return (
            <div key={entry.id} className="space-y-4">
              {showDate && (
                <div className="flex items-center gap-4 py-4">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em]">{date}</span>
                  <div className="h-px flex-1 bg-neutral-900"></div>
                </div>
              )}

              <div
                className="relative p-8 bg-neutral-900/20 border border-neutral-900 hover:border-neutral-700 rounded-2xl transition-all group cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                onClick={() => setOpenEntry(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setOpenEntry(entry);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`查看记录 #${entry.id} 全文`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tight">
                    {format(parseUtcTimestamp(entry.created_at), 'HH:mm:ss')}
                  </span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all">
                    <button
                      onClick={(event) => { event.stopPropagation(); beginEditing(entry); }}
                      className="text-neutral-600 hover:text-white transition-colors"
                      aria-label="编辑记录"
                      title="编辑记录"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={(event) => { event.stopPropagation(); deleteEntry(entry.id); }}
                      className="text-neutral-700 hover:text-red-400 transition-colors"
                      aria-label="删除记录"
                      title="删除记录"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-xl font-serif leading-relaxed text-neutral-200 whitespace-pre-wrap italic line-clamp-2">
                  {entry.content}
                </p>
                <span className="inline-block mt-3 text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400 transition-colors">点击阅读全文</span>
                <div className="mt-6 flex items-center gap-2">
                  <span className="text-[9px] font-mono px-2 py-1 bg-neutral-900 text-neutral-500 rounded uppercase tracking-tighter">权重：{entry.weight.toFixed(1)}</span>
                  <span className="text-[9px] font-mono px-2 py-1 bg-neutral-900 text-neutral-500 rounded uppercase tracking-tighter">{entry.mood || '平静'}</span>
                  <span className={cn(
                    "text-[9px] font-mono px-2 py-1 rounded uppercase tracking-tighter",
                    entry.visibility === 'public' ? 'bg-emerald-950 text-emerald-300' : 'bg-neutral-900 text-neutral-500'
                  )}>
                    {entry.visibility === 'public' ? '公开' : '私密'}
                  </span>
                  <button
                    onClick={(event) => { event.stopPropagation(); copyShareLink(entry); }}
                    className="ml-auto text-[9px] font-mono px-3 py-1 bg-white text-black rounded uppercase tracking-tighter hover:bg-neutral-200 transition-all"
                  >
                    {entry.visibility === 'public' ? '复制链接' : '公开分享'}
                  </button>
                  <button
                    onClick={(event) => { event.stopPropagation(); copyPrivateShareLink(entry); }}
                    className="text-[9px] font-mono px-3 py-1 bg-neutral-900 text-neutral-300 rounded uppercase tracking-tighter hover:text-white transition-all"
                  >
                    私密分享
                  </button>
                  {entry.visibility === 'public' && (
                    <button
                      onClick={(event) => { event.stopPropagation(); makePrivate(entry.id); }}
                      className="text-[9px] font-mono px-3 py-1 bg-neutral-900 text-neutral-400 rounded uppercase tracking-tighter hover:text-white transition-all"
                    >
                      设为私密
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {openEntry && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.button
              type="button"
              aria-label="关闭全文"
              className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenEntry(null)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={`记录 #${openEntry.id} 全文`}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="relative flex h-full w-full max-w-2xl flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-neutral-900 px-7 py-6 sm:px-10">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600">完整记录</p>
                  <p className="mt-1 text-sm font-mono text-neutral-400">{format(parseUtcTimestamp(openEntry.created_at), 'yyyy年M月d日 HH:mm:ss', { locale: zhCN })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => beginEditing(openEntry)}
                    className="flex items-center gap-2 rounded-full border border-neutral-800 px-4 py-2 text-xs font-bold text-neutral-200 transition-colors hover:border-neutral-600 hover:text-white"
                  >
                    <Pencil size={14} /> 编辑
                  </button>
                  <button type="button" onClick={() => setOpenEntry(null)} className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white" aria-label="关闭全文" title="关闭">
                    <X size={20} />
                  </button>
                </div>
              </header>
              <div className="custom-scrollbar flex-1 overflow-y-auto px-7 py-9 sm:px-10">
                <p className="whitespace-pre-wrap text-xl font-serif italic leading-[1.9] text-neutral-100">{openEntry.content}</p>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEntry && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
            <motion.button type="button" aria-label="取消编辑" className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setEditingEntry(null)} />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="编辑记录"
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.18 }}
              className="relative flex max-h-full w-full max-w-4xl flex-col rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl sm:p-9"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-serif italic text-white">编辑记录</p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-neutral-600">fragment #{editingEntry.id} · Ctrl/⌘ + Enter 保存</p>
                </div>
                <button type="button" onClick={() => setEditingEntry(null)} disabled={saving} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white" aria-label="取消编辑"><X size={20} /></button>
              </div>
              <textarea
                autoFocus
                value={editingContent}
                onChange={(event) => setEditingContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) saveEntry();
                }}
                className="min-h-[45vh] w-full resize-y rounded-2xl border border-neutral-800 bg-neutral-900/40 px-6 py-5 text-xl font-serif italic leading-relaxed text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-600"
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setEditingEntry(null)} disabled={saving} className="rounded-full px-5 py-3 text-sm font-bold text-neutral-400 hover:text-white disabled:opacity-50">取消</button>
                <button type="button" onClick={saveEntry} disabled={!editingContent.trim() || saving} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600">{saving ? '保存中…' : '保存修改'}</button>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SharedEntryTableOfContents({ headings }: { headings: MarkdownHeading[] }) {
  const [open, setOpen] = useState(false);

  if (headings.length === 0) return null;

  const navigateTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };

  const items = (
    <nav aria-label="文章目录" className="shared-entry-toc-list">
      {headings.map(heading => (
        <button
          key={heading.id}
          type="button"
          onClick={() => navigateTo(heading.id)}
          className="shared-entry-toc-link"
          style={{ paddingLeft: `${Math.max(0, heading.level - 1) * 12}px` }}
          title={heading.text}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="shared-entry-toc-desktop" aria-label="文章目录">
        <p className="shared-entry-toc-title">目录</p>
        {items}
      </aside>

      <div className="shared-entry-toc-mobile">
        {open && (
          <div className="shared-entry-toc-popover">
            <div className="shared-entry-toc-popover-header">
              <span>目录</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭目录" title="关闭目录">
                <X size={16} />
              </button>
            </div>
            {items}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="shared-entry-toc-trigger"
          aria-label={open ? '关闭目录' : '打开目录'}
          aria-expanded={open}
          title={open ? '关闭目录' : '打开目录'}
        >
          {open ? <X size={19} /> : <ListTree size={19} />}
        </button>
      </div>
    </>
  );
}

function SharedMarkdownContent({ content, headings }: { content: string; headings: MarkdownHeading[] }) {
  const headingIdByLine = new Map(headings.map(heading => [heading.line, heading.id]));
  const heading = (tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => ({ node, ...props }: any) => (
    React.createElement(tag, {
      ...props,
      id: headingIdByLine.get(node?.position?.start?.line),
    })
  );

  return (
    <div className="shared-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: heading('h1'),
          h2: heading('h2'),
          h3: heading('h3'),
          h4: heading('h4'),
          h5: heading('h5'),
          h6: heading('h6'),
          a: ({ href, children, ...props }) => <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function SharedEntryPage({ endpoint, label }: { endpoint: string; label: string }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(endpoint)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '无法打开这条记录');
        return data;
      })
      .then(data => {
        if (alive) setEntry(data);
      })
      .catch(err => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [endpoint]);

  const shouldRenderMarkdown = Boolean(entry && entry.content.length > 50);
  const headings = shouldRenderMarkdown && entry ? getMarkdownHeadings(entry.content) : [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <main className="shared-entry-main">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-serif italic tracking-tighter">碎片</h1>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.3em] mt-3">{label}</p>
        </div>

        <div className="rounded-[2rem] border border-neutral-900 bg-neutral-900/20 p-8 md:p-12">
          {loading && <p className="text-sm text-neutral-500 font-mono text-center">正在读取...</p>}
          {!loading && error && <p className="text-sm text-neutral-500 font-mono text-center">{error}</p>}
          {!loading && entry && (
            <article>
              {shouldRenderMarkdown ? (
                <SharedMarkdownContent content={entry.content} headings={headings} />
              ) : (
                <p className="text-3xl md:text-4xl font-serif italic leading-tight whitespace-pre-wrap">{entry.content}</p>
              )}
              <div className="mt-10 flex items-center justify-between gap-4 border-t border-neutral-900 pt-6">
                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                  {format(parseUtcTimestamp(entry.created_at), 'yyyy年M月d日 HH:mm', { locale: zhCN })}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">{label}</span>
              </div>
            </article>
          )}
        </div>
      </main>
      {shouldRenderMarkdown && <SharedEntryTableOfContents headings={headings} />}
    </div>
  );
}

interface HeatmapViewProps {
  key?: string;
  data: HeatmapData[];
}

function HeatmapView({ data }: HeatmapViewProps) {
  const today = new Date();
  const days = eachDayOfInterval({
    start: subDays(today, 365),
    end: today
  });

  const getColor = (weight: number) => {
    if (weight === 0) return 'bg-neutral-900';
    if (weight < 10) return 'bg-emerald-950/40';
    if (weight < 30) return 'bg-emerald-800/60';
    if (weight < 60) return 'bg-emerald-500';
    return 'bg-emerald-300';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
      <header className="flex items-center justify-between">
        <h2 className="text-4xl font-serif italic tracking-tight">活跃脉冲</h2>
        <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">年度记录热力图</div>
      </header>

      <div className="p-8 bg-black rounded-3xl border border-neutral-900 shadow-2xl overflow-x-auto">
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 min-w-[800px]">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayData = data.find(d => d.date === dateStr);
            const weight = dayData?.weight || 0;

            return (
              <div
                key={dateStr}
                title={`${dateStr}：强度 ${weight.toFixed(1)}`}
                className={cn("w-2.5 h-2.5 rounded-sm transition-all hover:ring-2 ring-white cursor-pointer", getColor(weight))}
              />
            );
          })}
        </div>
        <div className="mt-6 flex justify-between items-center px-2">
          <div className="flex items-center gap-4 text-[9px] font-mono text-neutral-700 uppercase tracking-widest">
            <span>8月</span>
            <span>9月</span>
            <span>10月</span>
            <span>11月</span>
            <span>12月</span>
            <span>1月</span>
            <span>2月</span>
            <span>3月</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-mono text-neutral-700 uppercase">少</span>
             <div className="flex gap-1">
                <div className="w-2 h-2 bg-neutral-900 rounded-sm"></div>
                <div className="w-2 h-2 bg-emerald-950/40 rounded-sm"></div>
                <div className="w-2 h-2 bg-emerald-800/60 rounded-sm"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-sm"></div>
                <div className="w-2 h-2 bg-emerald-300 rounded-sm"></div>
             </div>
             <span className="text-[9px] font-mono text-neutral-700 uppercase">多</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-neutral-900/30 rounded-3xl border border-neutral-900">
          <p className="text-4xl font-serif italic text-white">{data.length}</p>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">活跃天数</p>
        </div>
        <div className="p-8 bg-neutral-900/30 rounded-3xl border border-neutral-900">
          <p className="text-4xl font-serif italic text-white">
            {(data.reduce((acc, curr) => acc + curr.weight, 0) / (data.length || 1)).toFixed(1)}
          </p>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">平均强度</p>
        </div>
        <div className="p-8 bg-neutral-900/30 rounded-3xl border border-neutral-900">
          <p className="text-4xl font-serif italic text-white">
            {Math.max(...data.map(d => d.weight), 0).toFixed(0)}
          </p>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">峰值记录</p>
        </div>
      </div>
    </motion.div>
  );
}

function EnhancedHeatmapView({ data }: HeatmapViewProps) {
  const [mode, setMode] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const dailyMap = new Map(data.map(item => [item.date, item.weight]));

  const getColor = (weight: number) => {
    if (weight === 0) return 'bg-neutral-900';
    if (weight < 10) return 'bg-emerald-950/40';
    if (weight < 30) return 'bg-emerald-800/60';
    if (weight < 60) return 'bg-emerald-500';
    return 'bg-emerald-300';
  };

  const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
  const sumRange = (start: Date, days: number) => {
    let total = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      total += dailyMap.get(dateKey(d)) || 0;
    }
    return total;
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentYear, currentMonth, i + 1);
    return {
      key: dateKey(date),
      label: `${i + 1}`,
      title: format(date, 'yyyy年M月d日', { locale: zhCN }),
      weight: dailyMap.get(dateKey(date)) || 0,
    };
  });

  const weekCells = Array.from({ length: 26 }, (_, i) => {
    const end = new Date(now);
    end.setDate(now.getDate() - (25 - i) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return {
      key: dateKey(start),
      label: format(start, 'M/d'),
      title: `${format(start, 'yyyy年M月d日', { locale: zhCN })} - ${format(end, 'M月d日', { locale: zhCN })}`,
      weight: sumRange(start, 7),
    };
  });

  const monthCells = Array.from({ length: 12 }, (_, i) => {
    const days = new Date(currentYear, i + 1, 0).getDate();
    const start = new Date(currentYear, i, 1);
    return {
      key: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
      label: `${i + 1}月`,
      title: `${currentYear}年${i + 1}月`,
      weight: sumRange(start, days),
    };
  });

  const years = Array.from(new Set([
    currentYear,
    ...data.map(item => Number(item.date.slice(0, 4))).filter(Number.isFinite),
  ])).sort((a, b) => b - a);

  const yearCells = years.map(year => {
    const start = new Date(year, 0, 1);
    const days = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
    return {
      key: `${year}`,
      label: `${year}`,
      title: `${year}年`,
      weight: sumRange(start, days),
    };
  });

  const cells = mode === 'day' ? dayCells : mode === 'week' ? weekCells : mode === 'month' ? monthCells : yearCells;
  const gridClass = mode === 'day'
    ? 'grid grid-cols-7 gap-2'
    : mode === 'week'
      ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3'
      : mode === 'month'
        ? 'grid grid-cols-3 md:grid-cols-6 gap-4'
        : 'grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-4xl font-serif italic tracking-tight">活跃热力图</h2>
          <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">按日 / 周 / 月 / 年聚合记录强度</div>
        </div>
        <div className="flex rounded-full border border-neutral-800 bg-neutral-950 p-1">
          {[
            ['day', '日'],
            ['week', '周'],
            ['month', '月'],
            ['year', '年'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id as typeof mode)}
              className={cn(
                'px-4 py-2 rounded-full text-[10px] font-mono transition-all',
                mode === id ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-8 bg-black rounded-3xl border border-neutral-900 shadow-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-sm font-serif italic text-neutral-300">
            {mode === 'day' && `${currentYear}年${currentMonth + 1}月`}
            {mode === 'week' && '最近 26 周'}
            {mode === 'month' && `${currentYear}年 12 个月`}
            {mode === 'year' && '按年汇总'}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-neutral-700 uppercase">少</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-neutral-900 rounded-sm"></div>
              <div className="w-2 h-2 bg-emerald-950/40 rounded-sm"></div>
              <div className="w-2 h-2 bg-emerald-800/60 rounded-sm"></div>
              <div className="w-2 h-2 bg-emerald-500 rounded-sm"></div>
              <div className="w-2 h-2 bg-emerald-300 rounded-sm"></div>
            </div>
            <span className="text-[9px] font-mono text-neutral-700 uppercase">多</span>
          </div>
        </div>

        <div className={gridClass}>
          {cells.map(cell => (
            <div
              key={cell.key}
              title={`${cell.title}：强度 ${cell.weight.toFixed(1)}`}
              className={cn(
                'rounded-lg border border-neutral-900 transition-all hover:ring-2 ring-white/70 cursor-pointer flex items-end justify-between',
                getColor(cell.weight),
                mode === 'day' ? 'aspect-square p-2' : 'min-h-20 p-4'
              )}
            >
              <span className="text-[10px] font-mono text-white/80">{cell.label}</span>
              <span className="text-[10px] font-mono text-white/60">{cell.weight > 0 ? cell.weight.toFixed(0) : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-neutral-900/30 rounded-3xl border border-neutral-900">
          <p className="text-4xl font-serif italic text-white">{data.length}</p>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">活跃天数</p>
        </div>
        <div className="p-8 bg-neutral-900/30 rounded-3xl border border-neutral-900">
          <p className="text-4xl font-serif italic text-white">
            {(data.reduce((acc, curr) => acc + curr.weight, 0) / (data.length || 1)).toFixed(1)}
          </p>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">平均强度</p>
        </div>
        <div className="p-8 bg-neutral-900/30 rounded-3xl border border-neutral-900">
          <p className="text-4xl font-serif italic text-white">
            {Math.max(...data.map(d => d.weight), 0).toFixed(0)}
          </p>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">峰值记录</p>
        </div>
      </div>
    </motion.div>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function CloudDriveView({ token }: { token: string }) {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateMode, setDateMode] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '读取云盘失败');
      setFiles(data);
    } catch (error) {
      alert(error instanceof Error ? error.message : '读取云盘失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [token]);

  const filteredFiles = files.filter((file) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const haystack = `${file.filename} ${file.content_type || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (dateMode === 'all' || !dateFilter) return true;

    const createdAt = parseUtcTimestamp(file.created_at);
    if (Number.isNaN(createdAt.getTime())) return false;

    const day = format(createdAt, 'yyyy-MM-dd');
    const month = format(createdAt, 'yyyy-MM');
    const year = format(createdAt, 'yyyy');

    if (dateMode === 'day') return day === dateFilter;
    if (dateMode === 'month') return month === dateFilter;
    return year === dateFilter;
  });

  const uploadFile = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await fetchFiles();
    } catch (error) {
      alert(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (file: CloudFile) => {
    if (!confirm(`确定删除「${file.filename}」吗？`)) return;
    const res = await fetch(`/api/files/${file.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || '删除失败');
      return;
    }
    await fetchFiles();
  };

  const copyPublicShareLink = async (file: CloudFile) => {
    if (file.visibility !== 'public') {
      const res = await fetch(`/api/files/${file.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visibility: 'public' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '生成公开链接失败');
        return;
      }
    }

    const shareUrl = `${window.location.origin}/api/public/files/${file.id}`;
    await navigator.clipboard.writeText(shareUrl);
    await fetchFiles();
    alert('公开文件链接已复制，知道链接的人可以下载。');
  };

  const copyPrivateShareLink = async (file: CloudFile) => {
    const res = await fetch(`/api/files/${file.id}/private-share`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '生成私密分享链接失败');
      return;
    }

    const shareUrl = `${window.location.origin}/api/private-file-share/${data.token.replace('-', '/')}`;
    await navigator.clipboard.writeText(shareUrl);
    alert('私密文件链接已复制，不会把文件改为公开。');
  };

  const makePrivate = async (file: CloudFile) => {
    const res = await fetch(`/api/files/${file.id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ visibility: 'private' }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '恢复私有失败');
      return;
    }
    await fetchFiles();
  };

  const downloadFile = async (file: CloudFile) => {
    const res = await fetch(`/api/files/${file.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || '下载失败');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-serif italic tracking-tight">云盘</h2>
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-2">
            R2 私人文件存储 / qnote
          </p>
        </div>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="p-3 rounded-full bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 transition-all"
          title="刷新"
        >
          <RefreshCw size={18} className={cn(loading && 'animate-spin')} />
        </button>
      </header>

      <section className="p-6 bg-neutral-900/30 border border-neutral-900 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <input
            ref={inputRef}
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="block w-full text-sm text-neutral-400 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black hover:file:bg-neutral-200"
          />
          <button
            onClick={uploadFile}
            disabled={!selectedFile || uploading}
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all whitespace-nowrap',
              selectedFile && !uploading ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            )}
          >
            <Upload size={16} />
            {uploading ? '上传中...' : '上传'}
          </button>
        </div>
        {selectedFile && (
          <p className="text-xs font-mono text-neutral-500">
            待上传：{selectedFile.name} / {formatFileSize(selectedFile.size)}
          </p>
        )}
      </section>

      <section className="p-4 bg-neutral-900/20 border border-neutral-900 rounded-2xl space-y-4">
        <div className="flex flex-col xl:flex-row gap-3">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索文件名或类型"
              className="w-full pl-11 pr-4 py-3 rounded-full bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-all"
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex rounded-full bg-neutral-950 border border-neutral-800 p-1">
              {[
                ['all', '全部'],
                ['day', '日'],
                ['month', '月'],
                ['year', '年'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    setDateMode(mode as 'all' | 'day' | 'month' | 'year');
                    setDateFilter('');
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-bold transition-all',
                    dateMode === mode ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {dateMode !== 'all' && (
              <input
                type={dateMode === 'day' ? 'date' : dateMode === 'month' ? 'month' : 'number'}
                min={dateMode === 'year' ? '1970' : undefined}
                max={dateMode === 'year' ? '2999' : undefined}
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                placeholder="年份"
                className="px-4 py-3 rounded-full bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 outline-none focus:border-neutral-500 transition-all"
              />
            )}
          </div>
        </div>
        <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          显示 {filteredFiles.length} / {files.length} 个文件
        </p>
      </section>

      <section className="space-y-4">
        {loading && <p className="text-sm font-mono text-neutral-600">正在读取云盘...</p>}
        {!loading && files.length === 0 && (
          <div className="p-10 border border-neutral-900 rounded-2xl bg-neutral-900/20 text-center">
            <Cloud size={32} className="mx-auto text-neutral-700 mb-4" />
            <p className="text-sm font-mono text-neutral-600">还没有上传文件。</p>
          </div>
        )}
        {!loading && files.length > 0 && filteredFiles.length === 0 && (
          <div className="p-10 border border-neutral-900 rounded-2xl bg-neutral-900/20 text-center">
            <Search size={32} className="mx-auto text-neutral-700 mb-4" />
            <p className="text-sm font-mono text-neutral-600">没有符合条件的文件。</p>
          </div>
        )}
        {!loading && filteredFiles.map(file => (
          <div
            key={file.id}
            className="p-5 bg-neutral-900/20 border border-neutral-900 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 hover:border-neutral-800 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
              <FileIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-base text-neutral-100 truncate">{file.filename}</p>
                <span className={cn(
                  'shrink-0 px-2 py-1 rounded-full text-[10px] font-mono',
                  file.visibility === 'public' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-900 text-neutral-500'
                )}>
                  {file.visibility === 'public' ? '公开' : '私有'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-neutral-600 mt-1">
                {formatFileSize(file.size)} · {file.content_type || 'application/octet-stream'} · {format(parseUtcTimestamp(file.created_at), 'yyyy年M月d日 HH:mm', { locale: zhCN })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => downloadFile(file)}
                className="p-3 rounded-full bg-white text-black hover:bg-neutral-200 transition-all"
                title="下载"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => copyPublicShareLink(file)}
                className="p-3 rounded-full bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 transition-all"
                title="复制公开链接"
              >
                <Globe2 size={16} />
              </button>
              <button
                onClick={() => copyPrivateShareLink(file)}
                className="p-3 rounded-full bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 transition-all"
                title="复制私密链接"
              >
                <Share2 size={16} />
              </button>
              {file.visibility === 'public' && (
                <button
                  onClick={() => makePrivate(file)}
                  className="p-3 rounded-full bg-neutral-900 text-neutral-500 hover:text-amber-300 border border-neutral-800 transition-all"
                  title="恢复私有"
                >
                  <Lock size={16} />
                </button>
              )}
              <button
                onClick={() => deleteFile(file)}
                className="p-3 rounded-full bg-neutral-900 text-neutral-500 hover:text-red-400 border border-neutral-800 transition-all"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </section>
    </motion.div>
  );
}

interface RandomViewProps {
  key?: string;
  token: string;
}

function RandomView({ token }: RandomViewProps) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRandom = async () => {
    setLoading(true);
    const res = await fetch('/api/entries/random', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setEntry(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchRandom(); }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[70vh] flex flex-col justify-center items-center text-center space-y-16">
      <AnimatePresence mode="wait">
        {entry ? (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
            className="max-w-xl p-12 bg-neutral-900/10 border border-neutral-900 rounded-[3rem] relative"
          >
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-neutral-800 border border-neutral-700 rounded-full text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
              随机回看
            </div>
            <p className="text-4xl md:text-5xl font-serif leading-tight italic text-neutral-100 tracking-tighter">
              &ldquo;{entry.content}&rdquo;
            </p>
            <div className="mt-12 flex items-center justify-center gap-4">
               <div className="h-px w-8 bg-neutral-800"></div>
               <p className="text-[11px] font-mono text-neutral-600 uppercase tracking-[0.2em]">
                记录于 {format(parseUtcTimestamp(entry.created_at), 'yyyy年M月d日', { locale: zhCN })}
               </p>
               <div className="h-px w-8 bg-neutral-800"></div>
            </div>
          </motion.div>
        ) : (
          <p className="text-xs font-mono text-neutral-700 uppercase tracking-widest">还没有可回看的碎片。</p>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={fetchRandom}
        disabled={loading}
        className="flex items-center gap-4 px-10 py-5 bg-white text-black rounded-full font-bold shadow-2xl hover:shadow-white/10 transition-all group"
      >
        <span className="text-sm uppercase tracking-widest">换一条</span>
        <RefreshCw size={20} className={cn(loading && "animate-spin")} />
      </motion.button>
    </motion.div>
  );
}

interface SettingsViewProps {
  key?: string;
  user: any;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onLogout: () => void;
}

function SettingsView({ user, theme, onThemeChange, onLogout }: SettingsViewProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
      <header className="flex items-center justify-between">
        <h2 className="text-4xl font-serif italic tracking-tight">设置</h2>
        <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">系统配置</div>
      </header>

      <div className="space-y-6">
        <div className="p-8 bg-neutral-900/20 border border-neutral-900 rounded-[2.5rem] flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-3xl bg-neutral-800 flex items-center justify-center text-neutral-100 font-serif italic text-2xl border border-neutral-700">
               {user?.email?.[0].toUpperCase() || 'U'}
             </div>
             <div>
               <p className="text-xl font-serif italic text-white">{user?.email}</p>
               <p className="text-[10px] font-mono text-emerald-500 flex items-center gap-1.5 mt-2 uppercase tracking-widest">
                 <Sparkles size={12} /> 认证状态：已验证
               </p>
             </div>
          </div>
          <button onClick={onLogout} className="px-6 py-3 bg-neutral-900 text-neutral-400 hover:text-white rounded-2xl border border-neutral-800 transition-all flex items-center gap-2">
            <LogOut size={16} />
            <span className="text-[10px] uppercase font-mono font-bold">退出登录</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="p-8 bg-neutral-900/20 border border-neutral-900 rounded-[2.5rem] flex flex-col">
              <h3 className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.2em] mb-4">说明</h3>
              <div className="text-sm text-neutral-500 font-mono leading-relaxed mt-4">
                <p>碎片是一个极简的私人时间流系统。</p>
                <p className="mt-4">它鼓励保留未经修饰的念头，并通过权重算法呈现不同时间段的记录强度。</p>
              </div>
           </div>
           <div className="p-8 bg-neutral-900/20 border border-neutral-900 rounded-[2.5rem] flex flex-col">
              <h3 className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.2em] mb-4">缓存</h3>
              <p className="text-2xl font-serif italic text-white">配色选择会保存在当前浏览器。</p>
              <div className="mt-auto pt-6 border-t border-neutral-900/50 flex items-center gap-3 text-neutral-700">
                <Sun size={18} />
                <Moon size={18} />
                <span className="text-[10px] font-mono uppercase tracking-widest">localStorage</span>
              </div>
           </div>
        </div>

        <section className="p-8 bg-neutral-900/20 border border-neutral-900 rounded-[2.5rem] space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h3 className="text-2xl font-serif italic text-white">配色方案</h3>
              <p className="text-xs font-mono text-neutral-600 mt-2">
                共 6 组，包含当前默认主题和你提供的 5 组经典双色搭配。
              </p>
            </div>
            <button
              onClick={() => {
                const next = COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)].id;
                onThemeChange(next);
              }}
              className="px-5 py-3 rounded-full bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 transition-all text-xs font-bold"
            >
              随机换色
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {COLOR_THEMES.map((item) => (
              <button
                key={item.id}
                onClick={() => onThemeChange(item.id)}
                className={cn(
                  'text-left p-4 rounded-2xl border transition-all bg-neutral-950/50 hover:border-neutral-700',
                  theme === item.id ? 'border-white' : 'border-neutral-900'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-20 overflow-hidden rounded-xl border border-neutral-800 shrink-0">
                    <span className="flex-1" style={{ backgroundColor: item.colors[0] }} />
                    <span className="flex-1" style={{ backgroundColor: item.colors[1] }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-neutral-100 truncate">{item.name}</p>
                      {theme === item.id && (
                        <span className="px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono uppercase">
                          使用中
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-neutral-600 mt-1">{item.description}</p>
                    <p className="text-[10px] font-mono text-neutral-700 mt-1">{item.cmyk.join(' / ')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
