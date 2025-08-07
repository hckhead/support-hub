const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// CORS 설정
app.use(cors({
  origin: ['https://hckhead.github.io', 'http://localhost:3000'],
  credentials: true
}));

// 프록시 미들웨어 설정
app.use('/api', createProxyMiddleware({
  target: 'http://3.39.174.130',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api/v1'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying: ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
