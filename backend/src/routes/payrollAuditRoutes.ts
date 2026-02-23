import { Router } from 'express';
import { PayrollAuditController } from '../controllers/payrollAuditController';

const router = Router();

router.get('/', PayrollAuditController.getAuditLogs);
router.get('/export', PayrollAuditController.exportAuditLogsCsv);
router.get('/summary', PayrollAuditController.getAuditSummary);
router.get('/payroll-run/:payrollRunId', PayrollAuditController.getAuditLogsByPayrollRun);
router.get('/employee/:employeeId', PayrollAuditController.getAuditLogsByEmployee);
router.get('/:id', PayrollAuditController.getAuditLogById);

export default router;
