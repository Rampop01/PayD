import { Worker, Job } from 'bullmq';
import { redisConnection, PAYROLL_QUEUE_NAME } from '../config/queue.js';
import { PayrollBonusService } from '../services/payrollBonusService.js';
import { PayrollJobData } from '../services/payrollQueueService.js';
import { StellarService } from '../services/stellarService.js';
import { emitBulkUpdate } from '../services/socketService.js';
import logger from '../utils/logger.js';
import { Keypair, Asset, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

/**
 * Worker to process payroll runs in the background.
 */
export const payrollWorker = new Worker<PayrollJobData>(
    PAYROLL_QUEUE_NAME,
    async (job: Job<PayrollJobData>) => {
        const { payrollRunId } = job.data;
        logger.info(`Processing payroll run ${payrollRunId} (Job: ${job.id})`);

        try {
            // 1. Get payroll run and items
            const summary = await PayrollBonusService.getPayrollRunSummary(payrollRunId);
            if (!summary) {
                throw new Error(`Payroll run ${payrollRunId} not found`);
            }

            const { payroll_run, items } = summary;
            const batchId = payroll_run.batch_id;

            // Update status to processing
            await PayrollBonusService.updatePayrollRunStatus(payrollRunId, 'processing');
            emitBulkUpdate(batchId, 'processing', { progress: 0 });

            // 2. Prepare for blockchain transaction
            // For this implementation, we use a single distribution account defined in env
            const distributionSecret = process.env.ORGUSD_DISTRIBUTION_SECRET;
            if (!distributionSecret) {
                throw new Error('ORGUSD_DISTRIBUTION_SECRET not configured on server');
            }

            const distributionKeypair = Keypair.fromSecret(distributionSecret);
            const assetCode = payroll_run.asset_code;
            // In a real app, you'd get the issuer from the DB or config based on organization
            const assetIssuer = process.env.ORGUSD_ISSUER_PUBLIC;

            const asset = assetCode === 'XLM'
                ? Asset.native()
                : new Asset(assetCode, assetIssuer!);

            // 3. Group items into batches of 100 (Stellar transaction limit)
            const chunkSize = 100;
            const itemChunks = [];
            for (let i = 0; i < items.length; i += chunkSize) {
                itemChunks.push(items.slice(i, i + chunkSize));
            }

            let completedCount = 0;
            const totalItems = items.length;

            for (let i = 0; i < itemChunks.length; i++) {
                const chunk = itemChunks[i]!;
                logger.info(`Processing chunk ${i + 1}/${itemChunks.length} for run ${payrollRunId}`);

                try {
                    // Build operations for this chunk
                    const operations = chunk.map(item => {
                        if (!item.employee_wallet_address) {
                            throw new Error(`Employee ${item.employee_id} has no wallet address`);
                        }
                        return Operation.payment({
                            destination: item.employee_wallet_address,
                            asset: asset,
                            amount: item.amount,
                        });
                    });

                    // Build and submit transaction
                    const server = StellarService.getServer();
                    const networkPassphrase = StellarService.getNetworkPassphrase();
                    const account = await server.loadAccount(distributionKeypair.publicKey());

                    const txBuilder = new TransactionBuilder(account, {
                        fee: (1000 * operations.length).toString(), // Adaptive fee for batch size
                        networkPassphrase,
                    });

                    operations.forEach((op) => txBuilder.addOperation(op));
                    txBuilder.setTimeout(180); // Longer timeout for large batches

                    const tx = txBuilder.build();
                    tx.sign(distributionKeypair);

                    const result = await StellarService.submitTransaction(tx);
                    logger.info(`Chunk ${i + 1} submitted successfully. Tx Hash: ${result.hash}`);

                    // Update database for items in this chunk
                    for (const item of chunk) {
                        await PayrollBonusService.updateItemStatus(item.id, 'completed', result.hash);
                        completedCount++;
                    }

                    // Emit progress
                    const progress = Math.round((completedCount / totalItems) * 100);
                    emitBulkUpdate(batchId, 'processing', {
                        progress,
                        completedCount,
                        totalItems,
                        lastTxHash: result.hash
                    });

                } catch (chunkError: any) {
                    logger.error(`Failed to process chunk ${i + 1} for run ${payrollRunId}`, chunkError);

                    // Mark items in this chunk as failed
                    for (const item of chunk) {
                        await PayrollBonusService.updateItemStatus(item.id, 'failed');
                    }

                    // We continue with other chunks instead of failing the whole job immediately,
                    // but we will mark the run as failed at the end if any chunk fails.
                    throw chunkError; // BullMQ will retry based on config
                }
            }

            // 4. Wrap up
            await PayrollBonusService.updatePayrollRunStatus(payrollRunId, 'completed');
            emitBulkUpdate(batchId, 'completed', { progress: 100, completedCount: totalItems });
            logger.info(`Successfully completed payroll run ${payrollRunId}`);

        } catch (error: any) {
            logger.error(`Critical failure in payroll worker for run ${payrollRunId}`, error);

            // Update run status to failed if not already completed
            await PayrollBonusService.updatePayrollRunStatus(payrollRunId, 'failed');

            const summary = await PayrollBonusService.getPayrollRunSummary(payrollRunId);
            if (summary) {
                emitBulkUpdate(summary.payroll_run.batch_id, 'failed', {
                    error: error.message
                });
            }

            throw error; // Rethrow so BullMQ knows it failed
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Process one payroll run at a time to prevent sequence number issues
    }
);

payrollWorker.on('completed', (job) => {
    logger.info(`Payroll job ${job.id} completed successfully`);
});

payrollWorker.on('failed', (job, err) => {
    logger.error(`Payroll job ${job?.id} failed with error: ${err.message}`);
});
