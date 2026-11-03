import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

export const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  database: process.env.DB_NAME || 'ecommerce',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Initialize type-safe Drizzle ORM client
export const db = drizzle(pool, { schema });

export async function initDB(retries = 10, delayMs = 2000): Promise<void> {
  while (retries > 0) {
    try {
      const client: PoolClient = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            price NUMERIC(10, 2) NOT NULL,
            stock INT NOT NULL CHECK (stock >= 0)
          );

          CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            product_id INT REFERENCES products(id),
            quantity INT NOT NULL CHECK (quantity > 0),
            status VARCHAR(30) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          INSERT INTO products (id, name, price, stock)
          VALUES (1, 'Apple MacBook Pro M3', 1999.99, 25)
          ON CONFLICT (id) DO NOTHING;
        `);
        console.log('[PostgreSQL] Database schema initialized successfully.');
        return;
      } finally {
        client.release();
      }
    } catch (err: any) {
      retries--;
      console.warn(`[PostgreSQL] Waiting for database ready (${retries} attempts left)...`);
      if (retries === 0) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

