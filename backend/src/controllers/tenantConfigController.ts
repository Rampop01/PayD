import { Request, Response } from 'express';
import { z } from 'zod';
import tenantConfigService from '../services/tenantConfigService.js';

const upsertSchema = z.object({
  configKey: z.string().min(1).max(100),
  configValue: z.unknown(),
  description: z.string().max(500).optional(),
});

export class TenantConfigController {
  async getAll(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }
      const configs = await tenantConfigService.getAllConfigs(organizationId);
      return res.status(200).json({ success: true, data: configs });
    } catch (error) {
      console.error('getAll tenant config error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }
      const configKey = req.params.configKey as string;
      const config = await tenantConfigService.getConfig(organizationId, configKey);
      if (!config) return res.status(404).json({ error: 'Configuration not found' });
      return res.status(200).json({ success: true, data: { configKey, configValue: config } });
    } catch (error) {
      console.error('getOne tenant config error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async upsert(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }
      const { configKey, configValue, description } = upsertSchema.parse(req.body);
      const updated = await tenantConfigService.setConfig(
        organizationId,
        configKey,
        configValue,
        description
      );
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      console.error('upsert tenant config error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'User is not associated with an organization' });
      }
      const configKey = req.params.configKey as string;
      const deleted = await tenantConfigService.deleteConfig(organizationId, configKey);
      if (!deleted) return res.status(404).json({ error: 'Configuration not found' });
      return res.status(204).send();
    } catch (error) {
      console.error('delete tenant config error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const tenantConfigController = new TenantConfigController();
