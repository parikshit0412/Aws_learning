import { AuthResponse, ProductResponse, OrderResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/healthz`);
  return res.json();
}

export async function register(username: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invalid credentials');
  return data;
}

export async function fetchProduct(id: number): Promise<ProductResponse> {
  const startTime = performance.now();
  const res = await fetch(`${API_BASE}/api/products/${id}`);
  const endTime = performance.now();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Product fetch failed');
  return {
    ...data,
    latencyMs: Math.round(endTime - startTime),
  };
}

export async function placeOrder(productId: number, quantity: number, token: string): Promise<OrderResponse> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId, quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  return data;
}

