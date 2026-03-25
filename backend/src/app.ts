import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import logger from './utils/logger.js';
import passport from './config/passport.js';
import { apiVersionMiddleware } from './middlewares/apiVersionMiddleware.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swaggerConfig.js';
import fs from 'fs';

// Feature Routes
import v1Routes from './routes/v1/index.js';
import authRoutes from './routes/authRoutes.js';
import webhookRoutes from './routes/webhook.routes.js';

// Upstream Routes
import payrollRoutes from './routes/payroll.routes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve stellar.toml for SEP-0001
app.get('/.well-known/stellar.toml', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../.well-known/stellar.toml'));
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// Export openapi.json for frontend
fs.writeFileSync(
  path.join(__dirname, '../openapi.json'),
  JSON.stringify(swaggerSpec, null, 2)
);

// Middleware for versioning
app.use(apiVersionMiddleware);

// Feature / PR specific routes
app.use('/auth', authRoutes);
app.use('/api/v1', v1Routes);
app.use('/webhooks', webhookRoutes);

// Upstream / Base routes
app.use('/api/auth', authRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', contractRoutes);
app.use('/api/schedules', scheduleRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'An error occurred',
  });
});

export default app;
