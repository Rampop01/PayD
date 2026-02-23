import { Router } from 'express';
import { throttlingMiddleware } from '../../middlewares/throttlingMiddleware';
import searchRoutes from '../searchRoutes';
import employeeRoutes from '../employeeRoutes';
import paymentRoutes from '../paymentRoutes';
import authRoutes from '../authRoutes';
import assetRoutes from '../assetRoutes';
import throttlingRoutes from '../throttlingRoutes';
import payrollBonusRoutes from '../payrollBonusRoutes';
import payrollAuditRoutes from '../payrollAuditRoutes';
import auditRoutes from '../auditRoutes';
import balanceRoutes from '../balanceRoutes';
import trustlineRoutes from '../trustlineRoutes';
import payrollRoutes from '../payroll.routes';
import taxRoutes from '../taxRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/search', searchRoutes);
router.use('/employees', employeeRoutes);
router.use('/payments', throttlingMiddleware(), paymentRoutes);
router.use('/assets', assetRoutes);
router.use('/throttling', throttlingRoutes);
router.use('/payroll-bonus', payrollBonusRoutes);
router.use('/payroll/audit', payrollAuditRoutes);
router.use('/payroll', payrollRoutes);
router.use('/audit', auditRoutes);
router.use('/balance', balanceRoutes);
router.use('/trustline', trustlineRoutes);
router.use('/taxes', taxRoutes);

export default router;
