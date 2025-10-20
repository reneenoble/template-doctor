/**
 * Database Service for Template Doctor
 *
 * Provides MongoDB connectivity to Cosmos DB using Managed Identity (RBAC).
 * Implements connection pooling, automatic reconnection, and index management.
 *
 * Collections:
 * - analysis: Template analysis results
 * - azdtests: Azure Developer CLI deployment test results
 * - rulesets: Analysis ruleset configurations
 * - configuration: Application configuration key-value pairs
 */
import { MongoClient } from 'mongodb';
import { DefaultAzureCredential } from '@azure/identity';
// ===== Database Service Class =====
class DatabaseService {
  client = null;
  db = null;
  connectionString = '';
  isConnected = false;
  /**
   * Connect to MongoDB (local or Cosmos DB)
   * Supports both local MongoDB (MONGODB_URI) and Cosmos DB with Managed Identity (COSMOS_ENDPOINT)
   */
  async connect() {
    if (this.isConnected && this.client && this.db) {
      console.log('[Database] Already connected');
      return;
    }
    const mongoUri = process.env.MONGODB_URI;
    const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
    const databaseName =
      process.env.COSMOS_DATABASE_NAME || process.env.MONGODB_DATABASE || 'template_doctor';
    // Local MongoDB (e.g., MongoDB Compass)
    if (mongoUri) {
      console.log(
        `[Database] Connecting to local MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`,
      );
      try {
        this.client = new MongoClient(mongoUri, {
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
        });
        await this.client.connect();
        this.db = this.client.db(databaseName);
        this.isConnected = true;
        console.log(`[Database] Connected to local MongoDB database: ${databaseName}`);
        // Create indexes (async, non-blocking)
        this.createIndexes().catch((err) =>
          console.error('[Database] Index creation failed:', err),
        );
        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.disconnect());
        process.on('SIGINT', () => this.disconnect());
        return;
      } catch (error) {
        this.isConnected = false;
        console.error('[Database] Local MongoDB connection failed:', error?.message);
        throw error;
      }
    }
    // Cosmos DB with Managed Identity
    if (cosmosEndpoint) {
      console.log(`[Database] Connecting to Cosmos DB: ${cosmosEndpoint}`);
      try {
        // Acquire access token using Managed Identity
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken('https://cosmos.azure.com/.default');
        if (!tokenResponse || !tokenResponse.token) {
          throw new Error('Failed to acquire access token from Managed Identity');
        }
        // Build MongoDB connection string with token as username
        // Cosmos DB MongoDB API accepts MI token as username
        const token = tokenResponse.token;
        this.connectionString = `mongodb://${encodeURIComponent(token)}:${encodeURIComponent(token)}@${cosmosEndpoint.replace('https://', '')}:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@${databaseName}@`;
        // Create MongoDB client with connection pooling
        this.client = new MongoClient(this.connectionString, {
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        await this.client.connect();
        this.db = this.client.db(databaseName);
        this.isConnected = true;
        console.log(`[Database] Connected to Cosmos DB database: ${databaseName}`);
        // Create indexes (async, non-blocking)
        this.createIndexes().catch((err) =>
          console.error('[Database] Index creation failed:', err),
        );
        // Set up token refresh (every 1 hour)
        this.scheduleTokenRefresh();
        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.disconnect());
        process.on('SIGINT', () => this.disconnect());
        return;
      } catch (error) {
        this.isConnected = false;
        console.error('[Database] Cosmos DB connection failed:', error?.message);
        throw error;
      }
    }
    throw new Error(
      'No database configuration found. Set MONGODB_URI for local MongoDB or COSMOS_ENDPOINT for Cosmos DB',
    );
  }
  /**
   * Create indexes for performance optimization
   */
  async createIndexes() {
    if (!this.db) return;
    console.log('[Database] Creating indexes...');
    try {
      // Repos collection indexes (V2 schema - primary collection)
      await this.repos.createIndex({ repoUrl: 1 }, { unique: true, background: true });
      await this.repos.createIndex({ owner: 1, repo: 1 }, { background: true });
      await this.repos.createIndex(
        { 'latestAnalysis.compliancePercentage': -1 },
        { background: true },
      );
      await this.repos.createIndex({ 'latestAnalysis.scanDate': -1 }, { background: true });
      // Analysis collection indexes (V2 schema - historical results)
      await this.analysis.createIndex({ repoUrl: 1, scanDate: -1 }, { background: true });
      await this.analysis.createIndex({ owner: 1, repo: 1 }, { background: true });
      await this.analysis.createIndex({ scanDate: -1 }, { background: true });
      await this.analysis.createIndex({ 'compliance.percentage': -1 }, { background: true });
      await this.analysis.createIndex({ createdBy: 1 }, { background: true });
      // AZD Tests collection indexes
      await this.azdTests.createIndex({ repoUrl: 1, timestamp: -1 }, { background: true });
      await this.azdTests.createIndex({ status: 1, startedAt: -1 }, { background: true });
      // Rulesets collection indexes
      await this.rulesets.createIndex({ name: 1 }, { unique: true, background: true });
      // Configuration collection indexes
      await this.configuration.createIndex({ key: 1 }, { unique: true, background: true });
      await this.configuration.createIndex({ category: 1 }, { background: true });
      console.log('[Database] Indexes created successfully');
    } catch (error) {
      console.error('[Database] Index creation error:', error?.message);
    }
  }
  /**
   * Refresh MI token periodically (every 1 hour)
   */
  scheduleTokenRefresh() {
    setInterval(async () => {
      console.log('[Database] Refreshing MI token...');
      try {
        await this.disconnect();
        await this.connect();
        console.log('[Database] Token refreshed and reconnected');
      } catch (error) {
        console.error('[Database] Token refresh failed:', error?.message);
      }
    }, 3600000); // 1 hour
  }
  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.isConnected = false;
      console.log('[Database] Disconnected');
    }
  }
  /**
   * Health check - tests database connectivity
   */
  async healthCheck() {
    if (!this.db) {
      return { connected: false, error: 'Database not initialized' };
    }
    try {
      const start = Date.now();
      await this.db.admin().ping();
      const latency = Date.now() - start;
      const type = process.env.MONGODB_URI ? 'local-mongodb' : 'cosmos-db';
      const database = this.db.databaseName;
      return { connected: true, type, database, latency };
    } catch (error) {
      return { connected: false, error: error?.message };
    }
  }
  // ===== Collection Accessors =====
  /**
   * Analysis collection
   */
  /**
   * Analysis collection (V2: historical results, keep last 10 per repo)
   */
  get analysis() {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('analysis');
  }
  /**
   * Repos collection (V2: primary collection for repository metadata)
   */
  get repos() {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('repos');
  }
  /**
   * AZD Tests collection
   */
  get azdTests() {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('azdtests');
  }
  /**
   * Rulesets collection
   */
  get rulesets() {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('rulesets');
  }
  /**
   * Configuration collection
   */
  get configuration() {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('configuration');
  }
}
// Singleton instance
export const database = new DatabaseService();
