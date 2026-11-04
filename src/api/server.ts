import express, { Request, Response, NextFunction } from 'express';
import { initDB } from './db';
import { connectRedis } from './cache';
import { client, metricsMiddleware } from './metrics';

import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

// Enable Cross-Origin Resource Sharing (CORS)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Kubernetes Probes & Monitoring
let isHealthy = true;
const memoryHog: Buffer[] = [];

app.get('/healthz', (req: Request, res: Response) => {
  if (!isHealthy) {
    return res.status(500).json({ status: 'FAIL', reason: 'Simulated container deadlock' });
  }
  return res.status(200).json({ status: 'UP' });
});

app.get('/readyz', async (req: Request, res: Response) => {
  return res.status(200).json({ status: 'READY' });
});

// Chaos Testing Endpoints for Kubernetes Container Monitoring Scenarios
app.post('/chaos/break-liveness', (req: Request, res: Response) => {
  isHealthy = false;
  return res.json({ message: 'Liveness probe broken. Kubernetes should restart this container within 15s.' });
});

app.post('/chaos/leak-memory', (req: Request, res: Response) => {
  // Rapidly allocate 100MB buffers in a loop to exceed container memory limit
  for (let i = 0; i < 10; i++) {
    memoryHog.push(Buffer.alloc(100 * 1024 * 1024, 'a')); // ~1GB memory consumption
  }
  return res.json({ message: 'Allocated 1GB memory. Container should trigger OOMKilled (Exit Code 137).' });
});

app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap(): Promise<void> {
  console.log('[TypeScript API Server] Starting bootstrap sequence...');
  await initDB();
  await connectRedis();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TypeScript API Server] Running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err);
  process.exit(1);
});

