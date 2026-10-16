import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('fragment.db');
const JWT_SECRET = 'fragment-secret-key-123';

const createPrivateShareToken = (entry: { id: number | string; content: string }) => {
  const hash = crypto.createHash('sha256').update(`${entry.id}:${entry.content}`).digest('hex');
  return `${entry.id}-${hash}`;
};

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    mood TEXT,
    tags TEXT,
    visibility TEXT DEFAULT 'private',
    source TEXT DEFAULT 'web',
    weight REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    // For MVP, if user doesn't exist, create it (Auto-registration)
    let user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, hashedPassword);
      user = { id: result.lastInsertRowid, email };
    } else {
      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: '邮箱或密码不正确' });
      }
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email } });
  });

  // Calculate Weight Logic
  const calculateWeight = (content: string, userId: number) => {
    let weight = 1.0;

    // 1. Content length factor (max 2.0)
    weight += Math.min(content.length / 100, 1.0);

    // 2. Late night record (23:00 - 05:00)
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) {
      weight += 0.5;
    }

    // 3. Consecutive records (check if there's an entry yesterday)
    // Simplified for MVP: just check if there's any entry in the last 24h
    const recent = db.prepare('SELECT id FROM entries WHERE user_id = ? AND created_at > datetime("now", "-1 day")').get(userId);
    if (recent) {
      weight += 0.3;
    }

    return weight * 10; // Scale for heatmap
  };

  // Entries
  app.post('/api/entries', authenticateToken, (req: any, res) => {
    const { content, mood, tags, source } = req.body;
    const weight = calculateWeight(content, req.user.id);

    const result = db.prepare(`
      INSERT INTO entries (user_id, content, mood, tags, source, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, content, mood || 'neutral', tags || '', source || 'web', weight);

    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
    res.json(entry);
  });

  app.get('/api/entries', authenticateToken, (req: any, res) => {
    const entries = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(entries);
  });

  app.get('/api/entries/random', authenticateToken, (req: any, res) => {
    const entry = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY RANDOM() LIMIT 1').get(req.user.id);
    res.json(entry || null);
  });

  app.get('/api/public/entries/:id', (req, res) => {
    const entry = db.prepare('SELECT id, content, mood, weight, created_at, updated_at FROM entries WHERE id = ? AND visibility = ?')
      .get(req.params.id, 'public');
    if (!entry) {
      return res.status(404).json({ error: '记录不存在或未公开' });
    }
    res.json(entry);
  });

  app.get('/api/private-share/:id/:hash', (req, res) => {
    const { id, hash } = req.params;
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return res.status(400).json({ error: '分享链接无效' });
    }

    const entry: any = db.prepare('SELECT id, content, mood, weight, created_at, updated_at FROM entries WHERE id = ?')
      .get(id);

    if (!entry) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const expectedToken = createPrivateShareToken(entry);
    if (expectedToken !== `${id}-${hash.toLowerCase()}`) {
      return res.status(404).json({ error: '分享链接已失效' });
    }

    res.json(entry);
  });

  app.get('/api/heatmap', authenticateToken, (req: any, res) => {
    // Group by day and sum weights
    const data = db.prepare(`
      SELECT date(created_at) as date, SUM(weight) as weight
      FROM entries
      WHERE user_id = ?
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(req.user.id);
    res.json(data);
  });

  app.delete('/api/entries/:id', authenticateToken, (req: any, res) => {
    db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.sendStatus(204);
  });

  app.post('/api/entries/:id/share', authenticateToken, (req: any, res) => {
    const { visibility } = req.body;
    const nextVisibility = visibility === 'private' ? 'private' : 'public';
    const result = db.prepare('UPDATE entries SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .run(nextVisibility, req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ visibility: nextVisibility });
  });

  app.post('/api/entries/:id/private-share', authenticateToken, (req: any, res) => {
    const entry: any = db.prepare('SELECT id, content FROM entries WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!entry) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ token: createPrivateShareToken(entry) });
  });

  app.patch('/api/entries/:id', authenticateToken, (req: any, res) => {
    const { content } = req.body;
    db.prepare('UPDATE entries SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .run(content, req.params.id, req.user.id);
    res.json({ success: true });
  });

  // --- Vite & Production Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
