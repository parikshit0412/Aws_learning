import { Router, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { products, orders } from '../../db/schema';
import { redisClient } from '../cache';
import { sendOrderEvent } from '../kafka';
import { verifyToken } from '../middleware/auth';
import { AuthenticatedRequest, OrderEvent } from '../../types';

const router = Router();

router.post('/', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Valid productId and positive quantity required.' });
  }

  try {
    const orderResult = await db.transaction(async (tx) => {
      // Drizzle ORM native pessimistic row-lock: .for('update')
      const [productCheck] = await tx
        .select({ stock: products.stock, name: products.name })
        .from(products)
        .where(eq(products.id, productId))
        .for('update');

      if (!productCheck) {
        throw { statusCode: 404, message: 'Product does not exist.' };
      }

      if (productCheck.stock < quantity) {
        throw { statusCode: 400, message: `Insufficient stock. Remaining: ${productCheck.stock}` };
      }

      // Deduct stock atomically in DB
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${quantity}` })
        .where(eq(products.id, productId));

      // Insert order entry
      const [createdOrder] = await tx
        .insert(orders)
        .values({
          userId: req.user!.userId,
          productId,
          quantity,
          status: 'PLACED',
        })
        .returning({
          id: orders.id,
          createdAt: orders.createdAt,
        });

      return createdOrder;
    });

    const orderId = orderResult.id;

    // Cache invalidation
    await redisClient.del(`product:${productId}`);

    // Typed asynchronous Kafka event
    const eventPayload: OrderEvent = {
      orderId,
      userId: req.user!.userId,
      username: req.user!.username,
      productId,
      quantity,
      timestamp: orderResult.createdAt,
    };
    await sendOrderEvent(eventPayload);

    return res.status(201).json({
      message: 'Your order has been placed successfully.',
      orderId,
      status: 'PLACED',
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Transaction failed.' });
  }
});

export default router;

