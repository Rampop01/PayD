import { Router } from 'express';
import { ThrottlingController } from '../controllers/throttlingController';

const router = Router();

router.get('/status', ThrottlingController.getStatus);
router.get('/config', ThrottlingController.getConfig);
router.put('/config', ThrottlingController.updateConfig);
router.delete('/queue', ThrottlingController.clearQueue);
router.get('/metrics', ThrottlingController.getMetrics);

export default router;
