export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
}

export interface Product {
  id: number;
  name: string;
  price: string | number;
  stock: number;
}

export interface ProductResponse {
  source: 'cache' | 'database';
  data: Product;
  latencyMs?: number;
}

export interface OrderResponse {
  message: string;
  orderId: number;
  status: string;
}

