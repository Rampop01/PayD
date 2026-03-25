import { payrollWorker } from './payrollWorker.js';
import logger from '../utils/logger.js';

export const startWorkers = () => {
    logger.info('Starting BullMQ workers...');

    // Workers are started when imported
    if (payrollWorker.isRunning()) {
        logger.info('Payroll worker is running');
    }
};
