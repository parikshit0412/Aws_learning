import React, { useState, useEffect } from 'react';
import './App.css';
import { checkHealth, register, login, fetchProduct, placeOrder } from './api';
import { ProductResponse } from './types';

export function App() {
  // State
  const [healthStatus, setHealthStatus] = useState<string>('Connecting...');
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('username'));

  // Auth inputs
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Product & Cache inspection
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // Order & Concurrency
  const [quantity, setQuantity] = useState(1);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Activity Logs
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 30)]);
  };

  // Initial Health & Product Load
  useEffect(() => {
    checkHealth()
      .then((data) => {
        setHealthStatus(data.status);
        addLog(`System Health Probe OK: Nginx -> Express API (${data.status})`);
      })
      .catch(() => {
        setHealthStatus('Offline');
        addLog('System Health Probe FAILED: Check Docker containers');
      });

    loadProduct();
  }, []);

  const loadProduct = async () => {
    setLoadingProduct(true);
    try {
      const data = await fetchProduct(1);
      setProduct(data);
      addLog(`GET /api/products/1 -> Source: [${data.source.toUpperCase()}] in ${data.latencyMs}ms`);
    } catch (err: any) {
      addLog(`Product fetch error: ${err.message}`);
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authMode === 'register') {
        await register(usernameInput, passwordInput);
        setAuthSuccess('Registration successful! Please login.');
        setAuthMode('login');
        addLog(`Registered user: "${usernameInput}" (PostgreSQL + bcrypt)`);
      } else {
        const data = await login(usernameInput, passwordInput);
        setToken(data.token);
        setCurrentUser(usernameInput);
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('username', usernameInput);
        addLog(`Authenticated as "${usernameInput}". JWT saved.`);
      }
    } catch (err: any) {
      setAuthError(err.message);
      addLog(`Auth Error: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('username');
    addLog('User logged out.');
  };

  const handlePlaceOrder = async () => {
    if (!token) {
      setOrderError('You must be logged in to place an order.');
      return;
    }

    setOrderLoading(true);
    setOrderError(null);
    setOrderMessage(null);

    try {
      addLog(`Acquiring PostgreSQL Pessimistic Lock (SELECT FOR UPDATE on product: 1)...`);
      const data = await placeOrder(1, quantity, token);
      setOrderMessage(`Order #${data.orderId} Placed! Kafka fulfillment event dispatched.`);
      addLog(`Order #${data.orderId} Created (Status: ${data.status})`);
      addLog(`Kafka Producer dispatched typed OrderEvent to topic "order-events"`);
      addLog(`Redis Cache Invalidated: product:1 evicted.`);

      // Refresh product view to observe decremented stock and cache miss
      loadProduct();
    } catch (err: any) {
      setOrderError(err.message);
      addLog(`Checkout Failed: ${err.message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Cloud Architecture E-Commerce Suite</h1>
        <p>Full-Stack Request Lifecycle: Nginx &bull; Express &bull; Drizzle ORM &bull; Redis &bull; Kafka KRaft</p>
        <div className="arch-bar">
          <span className={`chip ${healthStatus === 'UP' ? 'active' : ''}`}>
            <span className="dot"></span> Nginx Proxy (:80)
          </span>
          <span className={`chip ${healthStatus === 'UP' ? 'active' : ''}`}>
            <span className="dot"></span> Express API (:3000)
          </span>
          <span className="chip active">
            <span className="dot"></span> PostgreSQL 15 (ACID)
          </span>
          <span className="chip active">
            <span className="dot"></span> Redis 7 (Cache-Aside)
          </span>
          <span className="chip active">
            <span className="dot"></span> Apache Kafka (KRaft)
          </span>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* =================================================================== */}
        {/* Card 1: User Authentication & JWT Session                           */}
        {/* =================================================================== */}
        <div className="card">
          <h2>
            <span>User Authentication</span>
            {currentUser && <span className="chip active">{currentUser}</span>}
          </h2>

          {token ? (
            <div>
              <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                You are authenticated with a typed JWT Bearer token.
              </p>
              <div style={{ background: '#0d1117', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                {token.slice(0, 35)}...{token.slice(-25)}
              </div>
              <button className="btn-danger" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={authMode === 'login' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setAuthMode('login')}
                  style={{ flex: 1 }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={authMode === 'register' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setAuthMode('register')}
                  style={{ flex: 1 }}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuthSubmit}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  {authMode === 'login' ? 'Authenticate' : 'Create Account'}
                </button>
              </form>

              {authSuccess && <div className="alert alert-success">{authSuccess}</div>}
              {authError && <div className="alert alert-error">{authError}</div>}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* Card 2: Product Catalog & Redis Cache Inspector                     */}
        {/* =================================================================== */}
        <div className="card">
          <h2>
            <span>Live Catalog & Caching</span>
            {product && (
              <span className={`cache-badge ${product.source}`}>
                {product.source === 'cache' ? '⚡ Redis Cache' : '🐘 PostgreSQL DB'}
              </span>
            )}
          </h2>

          {product ? (
            <div>
              <div className="product-box">
                <div className="product-header">
                  <span className="product-title">{product.data.name}</span>
                  <span className="product-price">${Number(product.data.price).toFixed(2)}</span>
                </div>
                <div className="product-stock">
                  Stock Remaining: <strong>{product.data.stock} units</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="latency">Response Latency: {product.latencyMs}ms</span>
                  <button className="btn-secondary" onClick={loadProduct} disabled={loadingProduct} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    {loadingProduct ? 'Querying...' : 'Re-Query (Test Hit/Miss)'}
                  </button>
                </div>
              </div>

              {/* Transactional Checkout Section */}
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <label>Checkout Quantity (Pessimistic Row Lock Demo)</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    style={{ width: '80px' }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handlePlaceOrder}
                    disabled={orderLoading || product.data.stock <= 0}
                  >
                    {orderLoading ? 'Acquiring DB Lock...' : product.data.stock <= 0 ? 'Out of Stock' : 'Checkout & Dispatch Event'}
                  </button>
                </div>

                {orderMessage && <div className="alert alert-success">{orderMessage}</div>}
                {orderError && <div className="alert alert-error">{orderError}</div>}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>Loading product data...</p>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Event Stream Terminal & Observability Activity Log                    */}
      {/* ===================================================================== */}
      <div className="card stream-card">
        <h2>
          <span>Architecture Event Stream & Telemetry Log</span>
          <button className="btn-secondary" onClick={() => setLogs([])} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
            Clear
          </button>
        </h2>
        <div className="log-terminal">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>Waiting for system events... (Interact with UI to generate traffic)</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="log-entry">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Observability Dashboards Links */}
      <footer>
        <a href={`http://${window.location.hostname}:9090`} target="_blank" rel="noreferrer">
          📊 Prometheus Metrics (:9090)
        </a>
        <a href={`http://${window.location.hostname}:3001`} target="_blank" rel="noreferrer">
          📈 Grafana Dashboard (:3001)
        </a>
      </footer>
    </div>
  );
}

export default App;

