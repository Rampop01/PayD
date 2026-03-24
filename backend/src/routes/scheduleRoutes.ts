import { Router } from 'express';
import { ScheduleController } from '../controllers/scheduleController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

router.get('/', ScheduleController.listSchedules);
router.post('/', ScheduleController.saveSchedule);
router.delete('/:id', ScheduleController.cancelSchedule);

export default router;
