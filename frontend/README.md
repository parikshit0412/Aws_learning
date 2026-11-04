# E-Commerce Cloud Architecture Frontend (React + TypeScript + Vite)

A modern, responsive React + TypeScript application demonstrating the full-stack request lifecycle:

- **JWT Authentication**: User registration and login (`POST /api/auth/*`).
- **Redis Cache Inspector**: Live badge showing whether product data came from `Redis Cache` or `PostgreSQL DB`, complete with response latency timing.
- **Pessimistic Locking & ACID Checkout**: Decrement inventory with `.for('update')` row locking and dispatch asynchronous Kafka fulfillment events.
- **Real-Time Event Stream Terminal**: Interactive log window displaying backend events and state transitions.

---

## Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The application will start on **`http://localhost:5173`**.

All `/api/*` and `/healthz` requests are automatically proxied to the backend API (`http://localhost:3000` or port 80 via Nginx).

---

### 3. Build for Production
```bash
npm run build
```
This compiles the application into `/frontend/dist`.

