import { Request, Response } from 'express';
import { WebhookService, WEBHOOK_EVENTS } from '../services/webhook.service.js';
import { z } from 'zod';

const subscribeSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string()).default(['*']),
});

const updateSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(16).optional(),
  events: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

function getIdParam(params: Record<string, string | string[] | undefined>): string {
  const id = params.id;
  if (Array.isArray(id)) {
    return id[0] || '';
  }
  return id || '';
}

export class WebhookController {
  static async subscribe(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const validatedData = subscribeSchema.parse(req.body);
      const subscription = await WebhookService.subscribe(
        organization_id,
        validatedData.url,
        validatedData.secret,
        validatedData.events
      );
      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues });
        return;
      }
      console.error('Webhook subscription error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const id = getIdParam(req.params);
      if (!id) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }

      const validatedData = updateSchema.parse(req.body);

      const subscription = await WebhookService.updateSubscription(
        id,
        organization_id,
        validatedData
      );
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }
      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues });
        return;
      }
      console.error('Webhook update error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async listSubscriptions(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const subscriptions = await WebhookService.listSubscriptions(organization_id);
      res.json(subscriptions);
    } catch (error) {
      console.error('List subscriptions error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getSubscription(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const id = getIdParam(req.params);
      if (!id) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }

      const subscription = await WebhookService.getSubscriptionById(id, organization_id);
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }
      res.json(subscription);
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async deleteSubscription(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const id = getIdParam(req.params);
      if (!id) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }

      const success = await WebhookService.deleteSubscription(id, organization_id);
      if (success) {
        res.status(204).send();
        return;
      }
      res.status(404).json({ error: 'Subscription not found' });
    } catch (error) {
      console.error('Delete subscription error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDeliveryLogs(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const id = getIdParam(req.params);
      if (!id) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }

      const subscription = await WebhookService.getSubscriptionById(id, organization_id);
      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const logs = await WebhookService.getDeliveryLogs(id, limit);
      res.json(logs);
    } catch (error) {
      console.error('Get delivery logs error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getEvents(req: Request, res: Response) {
    res.json({
      events: Object.values(WEBHOOK_EVENTS),
      description: 'Available webhook event types for subscription',
    });
  }

  static async triggerMockEvent(req: Request, res: Response) {
    try {
      const organization_id = (req.user as any)?.organizationId;
      if (!organization_id) {
        res.status(401).json({ error: 'Organization not identified' });
        return;
      }

      const { event, payload } = req.body;
      await WebhookService.dispatch(
        (event as string) || 'payment.completed',
        organization_id,
        payload || { id: 'test_tx_123', amount: 100 }
      );
      res.json({ message: 'Mock event dispatched' });
    } catch (error) {
      console.error('Trigger mock event error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
