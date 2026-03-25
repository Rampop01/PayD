import { Router } from 'express';
import { FeeController } from '../controllers/feeController.js';

const router = Router();

router.get('/recommendation', FeeController.recommendation);
router.post('/batch-budget', FeeController.batchBudget);

export default router;
