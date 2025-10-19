// Admin configuration management endpoints
import { Router, Request, Response } from "express";
import { ConfigurationStorage } from "../services/configuration-storage.js";
import { database } from "../services/database.js";

export const adminRouter = Router();

// Get database connection info (for debugging)
adminRouter.get("/db-info", async (req: Request, res: Response) => {
  try {
    const mongoUri = process.env.MONGODB_URI || '(not set)';
    const cosmosEndpoint = process.env.COSMOS_ENDPOINT || '(not set)';
    const mongodbDatabase = process.env.MONGODB_DATABASE || '(not set)';
    const cosmosDatabase = process.env.COSMOS_DATABASE_NAME || '(not set)';
    
    // Mask sensitive parts
    const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    
    res.json({
      mongoUri: maskedUri,
      cosmosEndpoint,
      mongodbDatabase,
      cosmosDatabase,
      actualDatabase: database['db']?.databaseName || '(not connected)',
      connectionType: process.env.MONGODB_URI ? 'MongoDB' : (process.env.COSMOS_ENDPOINT ? 'Cosmos' : 'Unknown')
    });
  } catch (error) {
    console.error('[admin] Failed to get DB info:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve DB info',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all configuration settings
adminRouter.get("/settings", async (req: Request, res: Response) => {
  try {
    const settings = await ConfigurationStorage.getAll();
    res.json(settings);
  } catch (error) {
    console.error('[admin] Failed to get settings:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get settings by category
adminRouter.get("/settings/category/:category", async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const allSettings = await ConfigurationStorage.getAll();
    const settings = allSettings.filter(s => s.category === category);
    res.json(settings);
  } catch (error) {
    console.error('[admin] Failed to get settings by category:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get single setting
adminRouter.get("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const value = await ConfigurationStorage.get(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ key, value });
  } catch (error) {
    console.error('[admin] Failed to get setting:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve setting',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update single setting
adminRouter.put("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Missing value in request body' });
    }
    
    // Get authenticated user (from GitHub OAuth, if available)
    const updatedBy = req.headers['x-github-user'] as string | undefined;
    
    const setting = await ConfigurationStorage.set(key, value, updatedBy);
    res.json(setting);
  } catch (error) {
    console.error('[admin] Failed to update setting:', error);
    res.status(500).json({ 
      error: 'Failed to update setting',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update multiple settings
adminRouter.post("/settings", async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'settings must be an array' });
    }
    
    // Validate all settings have key and value
    for (const setting of settings) {
      if (!setting || typeof setting !== 'object' || !setting.key || setting.value === undefined) {
        return res.status(400).json({ 
          error: 'Invalid setting format. Expected { key: string, value: any }' 
        });
      }
    }
    
    const updatedBy = req.headers['x-github-user'] as string | undefined;
    
    // Convert array to object format
    const settingsObj: Record<string, string | number | boolean> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }
    
    await ConfigurationStorage.setMany(settingsObj, updatedBy);
    res.json({ success: true, updated: Object.keys(settingsObj).length });
  } catch (error) {
    console.error('[admin] Failed to update settings:', error);
    res.status(500).json({ 
      error: 'Failed to update settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Delete setting
adminRouter.delete("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const deleted = await ConfigurationStorage.delete(key);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[admin] Failed to delete setting:', error);
    res.status(500).json({ 
      error: 'Failed to delete setting',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Initialize default settings (idempotent)
adminRouter.post("/settings/initialize", async (req: Request, res: Response) => {
  try {
    await ConfigurationStorage.initializeDefaults();
    res.json({ success: true, message: 'Default settings initialized' });
  } catch (error) {
    console.error('[admin] Failed to initialize settings:', error);
    res.status(500).json({ 
      error: 'Failed to initialize settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get database statistics
adminRouter.get("/db-stats", async (req: Request, res: Response) => {
  try {
    const db = database['db'];
    
    if (!db) {
      return res.status(503).json({
        error: 'Database not connected'
      });
    }

    // List all collections
    const collections = await db.listCollections().toArray();
    const stats = {
      database: db.databaseName,
      collections: [] as Array<{
        name: string;
        count: number;
        sample: { keys: string[]; _id?: string } | null;
      }>
    };

    // Get stats for each collection
    for (const col of collections) {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      
      const collectionStats = {
        name: col.name,
        count,
        sample: null as { keys: string[]; _id?: string } | null
      };

      // Get one sample document to show structure
      if (count > 0) {
        const sample = await collection.findOne();
        if (sample) {
          collectionStats.sample = {
            keys: Object.keys(sample),
            _id: sample._id?.toString()
          };
        }
      }

      stats.collections.push(collectionStats);
    }

    res.json(stats);
  } catch (error) {
    console.error('[admin] Failed to get database stats:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve database stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Query specific collection
adminRouter.get("/db-query/:collection", async (req: Request, res: Response) => {
  try {
    const db = database['db'];
    
    if (!db) {
      return res.status(503).json({
        error: 'Database not connected'
      });
    }

    const { collection: collectionName } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = parseInt(req.query.skip as string) || 0;

    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    const documents = await collection.find().skip(skip).limit(limit).toArray();

    res.json({
      collection: collectionName,
      total: count,
      limit,
      skip,
      documents: documents.map((doc: any) => ({
        ...doc,
        _id: doc._id?.toString()
      }))
    });
  } catch (error) {
    console.error('[admin] Failed to query collection:', error);
    res.status(500).json({ 
      error: 'Failed to query collection',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

