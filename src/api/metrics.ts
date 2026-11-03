import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'ecommerce_' });

export const httpRequestsTotal = new client.Counter({
  name: 'ecommerce_http_requests_total',
  help: 'Total HTTP requests intercepted',
  labelNames: ['method', 'route', 'status_code'],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });
  next();
}

export { client };

