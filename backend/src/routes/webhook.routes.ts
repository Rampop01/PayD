import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);

router.post('/subscribe', WebhookController.subscribe);
router.put('/subscriptions/:id', WebhookController.update);
router.get('/subscriptions', WebhookController.listSubscriptions);
router.get('/subscriptions/:id', WebhookController.getSubscription);
router.delete('/subscriptions/:id', WebhookController.deleteSubscription);
router.get('/subscriptions/:id/delivery-logs', WebhookController.getDeliveryLogs);
router.get('/events', WebhookController.getEvents);
router.post('/test-trigger', WebhookController.triggerMockEvent);

export default router;
