import { pipeline, env } from '@xenova/transformers';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { RAGDocument, RAGQueryResult } from '../types/index.js';
import { createHash } from 'crypto';

// Configure Transformers.js to use local models
env.cacheDir = './models';
env.localURL = './models';

export class RAGSystemEmbedded {
  private db!: sqlite3.Database;
  private extractor: any;
  private isInitialized = false;
  private dbPath: string;
  private embeddingModel = 'Xenova/all-MiniLM-L6-v2'; // Fast, good quality embeddings

  constructor() {
    this.dbPath = process.env.MILVUS_ADDRESS?.endsWith('.db') 
      ? process.env.MILVUS_ADDRESS 
      : './rag-store/embeddings.db';
  }

  async initialize(): Promise<void> {
    logger.info('RAGSystemEmbedded', 'Initializing embedded RAG system with real embeddings');
    
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Initialize embedding model
      logger.info('RAGSystemEmbedded', `Loading embedding model: ${this.embeddingModel}`);
      this.extractor = await pipeline('feature-extraction', this.embeddingModel);
      
      // Initialize SQLite with vector extension simulation
      this.db = new sqlite3.Database(this.dbPath);
      
      // Promisify methods
      const run = promisify(this.db.run.bind(this.db));
      const get = promisify(this.db.get.bind(this.db));
      const all = promisify(this.db.all.bind(this.db));
      
      // Create tables with proper vector storage
      await run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT,
          embedding BLOB NOT NULL,
          embedding_json TEXT,
          timestamp TEXT NOT NULL
        )
      `);

      // Create indexes for better performance
      await run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON documents(timestamp);`);
      
      // Create a separate embeddings table for efficient similarity search
      await run(`
        CREATE TABLE IF NOT EXISTS embeddings (
          doc_id TEXT PRIMARY KEY,
          dimension INTEGER,
          vector_data BLOB,
          FOREIGN KEY (doc_id) REFERENCES documents(id)
        )
      `);

      // Create FTS5 for hybrid search
      await run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
          content,
          content=documents,
          content_rowid=rowid
        );
      `);

      this.isInitialized = true;
      logger.info('RAGSystemEmbedded', 'Embedded RAG system with transformer embeddings ready!');
    } catch (error) {
      logger.error('RAGSystemEmbedded', 'Failed to initialize', error);
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
      logger.debug('RAGSystemEmbedded', `Generating embedding for document ${documentId}`);
      
      // Generate real embedding using Transformers.js
      const embedding = await this.generateEmbedding(content);
      
      const run = promisify(this.db.run.bind(this.db));
      
      // Store document with embedding
      await run(
        `INSERT OR REPLACE INTO documents (id, content, metadata, embedding, embedding_json, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          documentId,
          content,
          JSON.stringify(metadata),
          Buffer.from(new Float32Array(embedding).buffer),
          JSON.stringify(embedding),
          timestamp
        ]
      );

      // Store in embeddings table for efficient search
      await run(
        `INSERT OR REPLACE INTO embeddings (doc_id, dimension, vector_data) 
         VALUES (?, ?, ?)`,
        [
          documentId,
          embedding.length,
          Buffer.from(new Float32Array(embedding).buffer)
        ]
      );

      logger.info('RAGSystemEmbedded', `Stored document ${documentId} with ${embedding.length}-dim embedding`);
      return documentId;
    } catch (error) {
      logger.error('RAGSystemEmbedded', 'Failed to store document', error);
      throw error;
    }
  }

  async query(queryText: string, maxResults: number = 10, threshold: number = 0.7): Promise<RAGQueryResult> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    try {
      logger.debug('RAGSystemEmbedded', `Querying for: "${queryText}"`);
      
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      const all = promisify(this.db.all.bind(this.db));
      
      // Get all documents with embeddings
      const documents = await all(`
        SELECT d.*, e.vector_data 
        FROM documents d 
        JOIN embeddings e ON d.id = e.doc_id
      `);

      // Calculate cosine similarity for each document
      const results = documents.map(doc => {
        const docEmbedding = new Float32Array(doc.vector_data);
        const similarity = this.cosineSimilarity(queryEmbedding, Array.from(docEmbedding));
        
        return {
          document: {
            id: doc.id,
            content: doc.content,
            metadata: JSON.parse(doc.metadata),
            timestamp: doc.timestamp
          },
          score: similarity
        };
      });

      // Sort by similarity and filter by threshold
      const sortedResults = results
        .filter(r => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      logger.info('RAGSystemEmbedded', `Found ${sortedResults.length} results above threshold ${threshold}`);

      return {
        documents: sortedResults.map(r => r.document),
        scores: sortedResults.map(r => r.score),
        query: queryText,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('RAGSystemEmbedded', 'Failed to query documents', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use the transformer model to generate embeddings
      const output = await this.extractor(text, { 
        pooling: 'mean',
        normalize: true 
      });
      
      // Convert to array
      const embedding = Array.from(output.data);
      
      logger.debug('RAGSystemEmbedded', `Generated ${embedding.length}-dimensional embedding`);
      return embedding;
    } catch (error) {
      logger.error('RAGSystemEmbedded', 'Failed to generate embedding', error);
      throw error;
    }
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  private generateId(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    hash.update(Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }

  async shutdown(): Promise<void> {
    logger.info('RAGSystemEmbedded', 'Shutting down embedded RAG system');
    
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
    await run('DELETE FROM embeddings WHERE doc_id = ?', [id]);
    logger.debug('RAGSystemEmbedded', `Deleted document ${id}`);
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

  async getStats(): Promise<any> {
    const get = promisify(this.db.get.bind(this.db));
    const stats = await get(`
      SELECT 
        COUNT(*) as total_documents,
        AVG(LENGTH(content)) as avg_content_length,
        MAX(timestamp) as last_updated
      FROM documents
    `);
    
    return {
      ...stats,
      embeddingModel: this.embeddingModel,
      embeddingDimension: 384 // all-MiniLM-L6-v2 dimension
    };
  }
}