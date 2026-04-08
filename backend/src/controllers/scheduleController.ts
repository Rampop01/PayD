import { Request, Response } from 'express';
import { ScheduleService } from '../services/scheduleService.js';
import logger from '../utils/logger.js';

export class ScheduleController {
    /**
     * GET /api/schedules
     */
    static async listSchedules(req: Request, res: Response) {
        const orgId = Number(req.headers['x-organization-id']);
        if (!orgId) return res.status(400).json({ error: 'Missing organization context' });

        try {
            const schedules = await ScheduleService.listSchedules(orgId);
            res.json(schedules);
        } catch (error: any) {
            logger.error('Error fetching schedules', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/schedules
     */
    static async saveSchedule(req: Request, res: Response) {
        const orgId = Number(req.headers['x-organization-id']);
        if (!orgId) return res.status(400).json({ error: 'Missing organization context' });

        const config = req.body; // SchedulingConfig
        if (!config || !config.frequency || !config.timeOfDay) {
            return res.status(400).json({ error: 'Invalid schedule config' });
        }

        try {
            const schedule = await ScheduleService.saveSchedule(orgId, config);
            res.json(schedule);
        } catch (error: any) {
            logger.error('Error saving schedule', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * DELETE /api/schedules/:id
     */
    static async cancelSchedule(req: Request, res: Response) {
        const { id } = req.params;
        const orgId = Number(req.headers['x-organization-id']);
        if (!orgId) return res.status(400).json({ error: 'Missing organization context' });

        try {
            const success = await ScheduleService.cancelSchedule(Number(id), orgId);
            if (success) {
                res.json({ message: 'Schedule cancelled successfully' });
            } else {
                res.status(404).json({ error: 'Schedule not found for this organization' });
            }
        } catch (error: any) {
            logger.error('Error cancelling schedule', error);
            res.status(500).json({ error: error.message });
        }
    }
}
