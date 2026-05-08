#!/usr/bin/env node
/**
 * 轻量 API 服务器，提供 /api/refresh 接口触发数据重新生成
 * 由 start-dashboard.command 在后台启动，Vite dev server 通过代理转发请求
 */

import { execSync } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5174;

let isRefreshing = false;

const server = http.createServer((req, res) => {
	// CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url === '/api/refresh' && req.method === 'POST') {
		if (isRefreshing) {
			res.writeHead(409, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ ok: false, message: '数据正在生成中，请稍候...' }));
			return;
		}

		isRefreshing = true;
		const startTime = Date.now();

		try {
			const generateScript = path.resolve(__dirname, 'generate-data.js');
			execSync(`node "${generateScript}"`, {
				encoding: 'utf8',
				timeout: 120000,
				stdio: 'pipe',
			});

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ ok: true, message: `数据已更新 (${elapsed}s)` }));
		} catch (err) {
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ ok: false, message: err.message }));
		} finally {
			isRefreshing = false;
		}
		return;
	}

	if (req.url === '/api/status' && req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ ok: true, refreshing: isRefreshing }));
		return;
	}

	res.writeHead(404, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ ok: false, message: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
	process.stdout.write(`API server listening on http://127.0.0.1:${PORT}\n`);
});
