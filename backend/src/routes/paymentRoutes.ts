import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { require2FA } from '../middlewares/require2fa.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

router.use(authenticateJWT);

router.get('/anchor-info', PaymentController.getAnchorInfo);
router.post('/sep31/initiate', isolateOrganization, require2FA, PaymentController.initiateSEP31);
router.get('/sep31/status/:domain/:id', PaymentController.getStatus);
router.post('/pathfind', PaymentController.findPaths);

export default router;
