import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { RAGDocument, RAGQueryResult } from '../types/index.js';
import { createHash } from 'crypto';

export class RAGSystem {
  private client!: MilvusClient;
  private collectionName: string;
  private isInitialized = false;

  constructor() {
    this.collectionName = config.rag.collectionName;
  }

  async initialize(): Promise<void> {
    logger.info('RAGSystem', 'Initializing RAG system');
    
    try {
      // Initialize Milvus client
      const milvusAddress = process.env.MILVUS_ADDRESS || 'localhost:19530';
      const milvusToken = process.env.MILVUS_TOKEN;
      
      this.client = new MilvusClient({
        address: milvusAddress,
        token: milvusToken,
        // Add connection pool settings
        pool: {
          max: 10,
          min: 2
        }
      });

      // Check if collection exists
      const hasCollection = await this.client.hasCollection({
        collection_name: this.collectionName
      });

      if (!hasCollection.value) {
        // Create collection with schema
        await this.createCollection();
      } else {
        // Load existing collection
        await this.client.loadCollection({
          collection_name: this.collectionName
        });
      }

      this.isInitialized = true;
      logger.info('RAGSystem', 'RAG system initialized successfully');
    } catch (error) {
      logger.error('RAGSystem', 'Failed to initialize RAG system', error);
      throw error;
    }
  }

  private async createCollection(): Promise<void> {
    logger.info('RAGSystem', 'Creating new collection');
    
    const schema = [
      {
        name: 'id',
        description: 'Document ID',
        data_type: DataType.VarChar,
        max_length: 128,
        is_primary_key: true
      },
      {
        name: 'content',
        description: 'Document content',
        data_type: DataType.VarChar,
        max_length: 65535
      },
      {
        name: 'metadata',
        description: 'Document metadata as JSON',
        data_type: DataType.JSON,
      },
      {
        name: 'embedding',
        description: 'Content embedding vector',
        data_type: DataType.FloatVector,
        dim: config.rag.embeddingDimension
      },
      {
        name: 'timestamp',
        description: 'Creation timestamp',
        data_type: DataType.VarChar,
        max_length: 32
      }
    ];

    await this.client.createCollection({
      collection_name: this.collectionName,
      fields: schema,
      enable_dynamic_field: true
    });

    // Create index for vector search
    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 128 }
    });

    // Load collection
    await this.client.loadCollection({
      collection_name: this.collectionName
    });
  }

  async store(content: string, metadata: Record<string, any>, id?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    // Validate content length
    if (!content || content.length > 65535) {
      throw new Error('Content must be between 1 and 65535 characters');
    }

    // Validate metadata size
    const metadataStr = JSON.stringify(metadata);
    if (metadataStr.length > 16384) {
      throw new Error('Metadata too large (max 16KB)');
    }

    const documentId = id || this.generateId(content);
    const timestamp = new Date().toISOString();
    
    try {
      // Generate embedding (placeholder - in production, use real embedding model)
      const embedding = await this.generateEmbedding(content);

      // Insert document
      await this.client.insert({
        collection_name: this.collectionName,
        data: [{
          id: documentId,
          content: content,
          metadata: JSON.stringify(metadata),
          embedding: embedding,
          timestamp: timestamp
        }]
      });

      logger.debug('RAGSystem', `Stored document ${documentId}`);
      
      // Cache the document for faster retrieval
      await this.cacheDocument({
        id: documentId,
        content,
        metadata,
        embedding,
        timestamp
      });

      return documentId;
    } catch (error) {
      logger.error('RAGSystem', 'Failed to store document', error);
      throw error;
    }
  }

  async query(queryText: string, maxResults: number = 10, threshold: number = 0.7): Promise<RAGQueryResult> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Perform vector search
      const searchResult = await this.client.search({
        collection_name: this.collectionName,
        vector: queryEmbedding,
        output_fields: ['id', 'content', 'metadata', 'timestamp'],
        limit: maxResults,
        metric_type: 'L2'
      });

      const documents: RAGDocument[] = [];
      const scores: number[] = [];

      for (const result of searchResult.results) {
        // Convert L2 distance to similarity score (0-1)
        const similarity = 1 / (1 + result.score);
        
        if (similarity >= threshold) {
          documents.push({
            id: result.id as string,
            content: result.content as string,
            metadata: JSON.parse(result.metadata as string),
            timestamp: result.timestamp as string
          });
          scores.push(similarity);
        }
      }

      logger.debug('RAGSystem', `Query returned ${documents.length} results`);

      return {
        documents,
        scores,
        query: queryText,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('RAGSystem', 'Failed to query documents', error);
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
    // Placeholder embedding generation
    // In production, use a real embedding model like Sentence Transformers
    const embedding = new Array(config.rag.embeddingDimension).fill(0);
    
    // Simple hash-based pseudo-embedding for demo
    const hash = createHash('sha256').update(text).digest();
    for (let i = 0; i < config.rag.embeddingDimension; i++) {
      embedding[i] = (hash[i % hash.length] / 255) * 2 - 1;
    }
    
    return embedding;
  }

  private async cacheDocument(doc: RAGDocument): Promise<void> {
    // Implement caching logic here
    // For now, this is a placeholder
    logger.debug('RAGSystem', `Cached document ${doc.id}`);
  }

  async shutdown(): Promise<void> {
    logger.info('RAGSystem', 'Shutting down RAG system');
    
    if (this.isInitialized && this.client) {
      try {
        await this.client.releaseCollection({
          collection_name: this.collectionName
        });
      } catch (error) {
        logger.error('RAGSystem', 'Error during shutdown', error);
      }
    }
    
    this.isInitialized = false;
  }

  // Utility methods
  async deleteDocument(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    // Validate ID to prevent injection
    if (!id || typeof id !== 'string' || id.length > 128) {
      throw new Error('Invalid document ID');
    }

    try {
      await this.client.delete({
        collection_name: this.collectionName,
        expr: `id == "${id.replace(/"/g, '\\"')}"`
      });
      
      logger.debug('RAGSystem', `Deleted document ${id}`);
    } catch (error) {
      logger.error('RAGSystem', 'Failed to delete document', error);
      throw error;
    }
  }

  async getDocument(id: string): Promise<RAGDocument | null> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized');
    }

    // Validate ID to prevent injection
    if (!id || typeof id !== 'string' || id.length > 128) {
      throw new Error('Invalid document ID');
    }

    try {
      const result = await this.client.query({
        collection_name: this.collectionName,
        expr: `id == "${id.replace(/"/g, '\\"')}"`,
        output_fields: ['id', 'content', 'metadata', 'timestamp']
      });

      if (result.data.length === 0) {
        return null;
      }

      const doc = result.data[0];
      return {
        id: doc.id as string,
        content: doc.content as string,
        metadata: JSON.parse(doc.metadata as string),
        timestamp: doc.timestamp as string
      };
    } catch (error) {
      logger.error('RAGSystem', 'Failed to get document', error);
      throw error;
    }
  }
}