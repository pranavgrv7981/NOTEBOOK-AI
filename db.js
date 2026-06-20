import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We use standard sqlite3, but wrap it in promises for async/await
export class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'rag.sqlite'), (err) => {
      if (err) console.error('Error opening database:', err);
    });
    this.init();
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async init() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documentId TEXT NOT NULL,
        text TEXT NOT NULL,
        embeddingJSON TEXT NOT NULL,
        FOREIGN KEY(documentId) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);
  }

  async addDocument(id, filename) {
    await this.run('INSERT INTO documents (id, filename) VALUES (?, ?)', [id, filename]);
  }

  async deleteDocument(id) {
    await this.run('DELETE FROM documents WHERE id = ?', [id]);
    await this.run('DELETE FROM chunks WHERE documentId = ?', [id]); // Manual cascade for safety
  }

  async getDocuments() {
    return await this.all('SELECT id, filename, uploadedAt FROM documents ORDER BY uploadedAt DESC');
  }

  async addChunks(documentId, chunks) {
    for (const chunk of chunks) {
      const embeddingStr = JSON.stringify(chunk.embedding);
      await this.run('INSERT INTO chunks (documentId, text, embeddingJSON) VALUES (?, ?, ?)', [
        documentId, chunk.text, embeddingStr
      ]);
    }
  }

  async getAllChunks() {
    const rows = await this.all('SELECT c.text, c.embeddingJSON, d.filename FROM chunks c JOIN documents d ON c.documentId = d.id');
    return rows.map(r => ({
      text: r.text,
      filename: r.filename,
      embedding: JSON.parse(r.embeddingJSON)
    }));
  }
}

export const db = new Database();
