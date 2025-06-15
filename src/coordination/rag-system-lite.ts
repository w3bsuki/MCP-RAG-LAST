import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { RAGDocument, RAGQueryResult } from '../types/index.js';
import { createHash } from 'crypto';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export class RAGSystemLite {
  private db!: sqlite3.Database;
  private isInitialized = false;
  private dbPath: string;

  constructor() {
    // Use local SQLite when MILVUS_ADDRESS points to a .db file
    this.dbPath = config.rag.collectionName || './milvus.db';
  }

  async initialize(): Promise<void> {
    logger.info('RAGSystemLite', 'Initializing SQLite-based RAG system');
    
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Initialize SQLite
      this.db = new sqlite3.Database(this.dbPath);
      
      // Promisify methods
      const run = promisify(this.db.run.bind(this.db));
      
      // Create tables
      await run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT,
          embedding TEXT,
          timestamp TEXT NOT NULL
        )
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_timestamp ON documents(timestamp);
      `);

      // Create FTS5 table for full-text search
      await run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          id UNINDEXED,
          content,
          content=documents,
          content_rowid=rowid
        );
      `);

      // Create triggers to keep FTS in sync
      await run(`
        CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
          INSERT INTO documents_fts(rowid, content) VALUES (new.rowid, new.content);
        END;
      `);

      this.isInitialized = true;
      logger.info('RAGSystemLite', 'SQLite RAG system initialized successfully');
    } catch (error) {
      logger.error('RAGSystemLite', 'Failed to initialize', error);
      throw error;
    }
  }

  async store(content: string, metadata: Record<string, any>, id?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    const documentId = id || this.generateId(content);
    const timestamp = new Date().toISOString();
    
    try {
      const run = promisify(this.db.run.bind(this.db));
      
      // Simple embedding - in production, use a real model
      const embedding = await this.generateEmbedding(content);
      
      await run(
        `INSERT OR REPLACE INTO documents (id, content, metadata, embedding, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          documentId,
          content,
          JSON.stringify(metadata),
          JSON.stringify(embedding),
          timestamp
        ]
      );

      logger.debug('RAGSystemLite', `Stored document ${documentId}`);
      return documentId;
    } catch (error) {
      logger.error('RAGSystemLite', 'Failed to store document', error);
      throw error;
    }
  }

  async query(queryText: string, maxResults: number = 10, threshold: number = 0.7): Promise<RAGQueryResult> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    try {
      const all = promisify(this.db.all.bind(this.db));
      
      // Use FTS5 for text search
      const results = await all(
        `SELECT 
          d.id, d.content, d.metadata, d.timestamp,
          bm25(documents_fts) as score
         FROM documents d
         JOIN documents_fts ON d.rowid = documents_fts.rowid
         WHERE documents_fts MATCH ?
         ORDER BY score
         LIMIT ?`,
        [queryText, maxResults]
      );

      const documents: RAGDocument[] = [];
      const scores: number[] = [];

      for (const row of results) {
        documents.push({
          id: row.id,
          content: row.content,
          metadata: JSON.parse(row.metadata),
          timestamp: row.timestamp
        });
        // Normalize BM25 score to 0-1 range
        scores.push(Math.min(1, Math.abs(row.score) / 10));
      }

      // If no FTS results, fall back to simple LIKE search
      if (documents.length === 0) {
        const likeResults = await all(
          `SELECT * FROM documents 
           WHERE content LIKE ? 
           ORDER BY timestamp DESC 
           LIMIT ?`,
          [`%${queryText}%`, maxResults]
        );

        for (const row of likeResults) {
          documents.push({
            id: row.id,
            content: row.content,
            metadata: JSON.parse(row.metadata),
            timestamp: row.timestamp
          });
          scores.push(0.5); // Fixed score for LIKE matches
        }
      }

      logger.debug('RAGSystemLite', `Query returned ${documents.length} results`);

      return {
        documents,
        scores,
        query: queryText,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('RAGSystemLite', 'Failed to query documents', error);
      throw error;
    }
  }

  private generateId(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    hash.update(Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // For SQLite version, we'll use a simpler approach
    // Store text features instead of full embeddings
    const features = [];
    
    // Word count
    features.push(text.split(/\s+/).length);
    
    // Character count
    features.push(text.length);
    
    // Line count
    features.push(text.split('\n').length);
    
    // Code indicators
    features.push(text.includes('function') ? 1 : 0);
    features.push(text.includes('class') ? 1 : 0);
    features.push(text.includes('import') ? 1 : 0);
    
    return features;
  }

  async shutdown(): Promise<void> {
    logger.info('RAGSystemLite', 'Shutting down SQLite RAG system');
    
    if (this.isInitialized && this.db) {
      const close = promisify(this.db.close.bind(this.db));
      await close();
    }
    
    this.isInitialized = false;
  }

  // Additional methods
  async deleteDocument(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    const run = promisify(this.db.run.bind(this.db));
    await run('DELETE FROM documents WHERE id = ?', [id]);
    logger.debug('RAGSystemLite', `Deleted document ${id}`);
  }

  async getDocument(id: string): Promise<RAGDocument | null> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    const get = promisify(this.db.get.bind(this.db));
    const row = await get('SELECT * FROM documents WHERE id = ?', [id]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp
    };
  }

  async getAllDocuments(limit: number = 100): Promise<RAGDocument[]> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    const all = promisify(this.db.all.bind(this.db));
    const rows = await all(
      'SELECT * FROM documents ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    
    return rows.map(row => ({
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp
    }));
  }
}