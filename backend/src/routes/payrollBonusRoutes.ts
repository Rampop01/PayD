import { Router } from 'express';
import { PayrollBonusController } from '../controllers/payrollBonusController';

const router = Router();

router.post('/runs', PayrollBonusController.createPayrollRun);
router.get('/runs', PayrollBonusController.listPayrollRuns);
router.get('/runs/:id', PayrollBonusController.getPayrollRun);
router.patch('/runs/:id/status', PayrollBonusController.updatePayrollRunStatus);
router.post('/items/bonus', PayrollBonusController.addBonusItem);
router.post('/items/bonus/batch', PayrollBonusController.addBatchBonusItems);
router.get('/runs/:payrollRunId/items', PayrollBonusController.getPayrollItems);
router.delete('/items/:itemId', PayrollBonusController.deletePayrollItem);
router.get('/bonuses/history', PayrollBonusController.getBonusHistory);

export default router;
