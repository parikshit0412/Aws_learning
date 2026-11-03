import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { products } from '../../db/schema';
import { redisClient } from '../cache';
import { Product } from '../../types';

const router = Router();

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  const productId = Number(req.params.id);
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product id.' });
  }
  const cacheKey = `product:${productId}`;

  try {
    // 1. Check Redis Cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({ source: 'cache', data: JSON.parse(cachedData) as Product });
    }

    // 2. Query Postgres via Drizzle on cache miss
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // 3. Populate Redis with a 60-second TTL
    await redisClient.set(cacheKey, JSON.stringify(product), { EX: 60 });

    return res.json({ source: 'database', data: product });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

