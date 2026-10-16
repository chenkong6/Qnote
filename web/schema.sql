CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  mood TEXT DEFAULT 'neutral',
  tags TEXT DEFAULT '',
  visibility TEXT DEFAULT 'private',
  source TEXT DEFAULT 'web',
  weight REAL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  entry_id INTEGER,
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT DEFAULT 'application/octet-stream',
  size INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'private',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(entry_id) REFERENCES entries(id)
);

CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
