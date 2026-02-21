import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import searchRoutes from './routes/searchRoutes';
import paymentRoutes from './routes/paymentRoutes';

import { HealthController } from './controllers/healthController';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', HealthController.getHealthStatus);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

export default app;
