import { Request } from 'express';
export * from '../db/schema';

export interface UserPayload {
  userId: number;
  username: string;
}

// Augment Express Request to carry typed user
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export interface Product {
  id: number;
  name: string;
  price: string | number;
  stock: number;
}

export interface OrderEvent {
  orderId: number;
  userId: number;
  username: string;
  productId: number;
  quantity: number;
  timestamp: string | Date;
}

