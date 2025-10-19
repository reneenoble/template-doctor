/**
 * Admin Configuration Routes
 * Provides endpoints for managing application configuration settings
 * 
 * SECURITY: All routes require admin authentication
 * - Set ADMIN_GITHUB_USERS=username1,username2 in .env
 * - Clients must include: Authorization: Bearer <github_token>
 */

import { Router, Request, Response } from 'express';
import { ConfigurationStorage } from '../services/configuration-storage.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const adminConfigRouter = Router();

// Apply authentication and admin authorization to ALL routes
adminConfigRouter.use(requireAuth);
adminConfigRouter.use(requireAdmin);

/**
 * GET /api/v4/admin/config
 * Get all configuration settings with metadata
 */
adminConfigRouter.get('/config', async (req: Request, res: Response) => {
  try {
    const settings = await ConfigurationStorage.getAll();
    res.json({ settings });
  } catch (error: any) {
    console.error('[AdminConfig] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch configuration settings', message: error.message });
  }
});

/**
 * GET /api/v4/admin/config/:key
 * Get a single configuration setting
 */
adminConfigRouter.get('/config/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const value = await ConfigurationStorage.get(key);
    
    if (value === null) {
      return res.status(404).json({ error: 'Configuration setting not found' });
    }
    
    res.json({ key, value });
  } catch (error: any) {
    console.error('[AdminConfig] Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch configuration setting', message: error.message });
  }
});

/**
 * PUT /api/v4/admin/config/:key
 * Update a single configuration setting
 */
adminConfigRouter.put('/config/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Missing value in request body' });
    }
    
    // Get authenticated user from middleware
    const updatedBy = (req as any).githubUser || 'unknown';
    
    await ConfigurationStorage.set(key, value, updatedBy);
    
    res.json({ success: true, key, value });
  } catch (error: any) {
    console.error('[AdminConfig] Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update configuration setting', message: error.message });
  }
});

/**
 * POST /api/v4/admin/config
 * Update multiple configuration settings
 */
adminConfigRouter.post('/config', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid settings object in request body' });
    }
    
    // Get authenticated user from middleware
    const updatedBy = (req as any).githubUser || 'unknown';
    
    await ConfigurationStorage.setMany(settings, updatedBy);
    
    res.json({ success: true, updated: Object.keys(settings).length });
  } catch (error: any) {
    console.error('[AdminConfig] Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update configuration settings', message: error.message });
  }
});

/**
 * DELETE /api/v4/admin/config/:key
 * Delete a configuration setting (resets to default)
 */
adminConfigRouter.delete('/config/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    await ConfigurationStorage.delete(key);
    
    res.json({ success: true, key });
  } catch (error: any) {
    console.error('[AdminConfig] Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete configuration setting', message: error.message });
  }
});

/**
 * POST /api/v4/admin/config/reset
 * Reset all settings to defaults
 */
adminConfigRouter.post('/config/reset', async (req: Request, res: Response) => {
  try {
    await ConfigurationStorage.initializeDefaults();
    
    res.json({ success: true, message: 'Configuration reset to defaults' });
  } catch (error: any) {
    console.error('[AdminConfig] Error resetting configuration:', error);
    res.status(500).json({ error: 'Failed to reset configuration', message: error.message });
  }
});
