#!/usr/bin/env node
/**
 * 轻量 API 服务器，提供 /api/refresh 接口触发数据重新生成
 * 由 start-dashboard.command 在后台启动，Vite dev server 通过代理转发请求
 */

import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5174;
const dataJsonPath = path.resolve(__dirname, '../public/data.json');

// 刷新状态
let refreshState = {
	running: false,
	startTime: null,
	lastResult: null, // { ok, message, elapsed }
	lastUpdated: null, // mtime of data.json when last refresh completed
};

function startRefresh() {
	if (refreshState.running) return false;

	refreshState.running = true;
	refreshState.startTime = Date.now();
	refreshState.lastResult = null;

	const generateScript = path.resolve(__dirname, 'generate-data.js');
	const child = spawn('node', [generateScript], {
		stdio: 'pipe',
		timeout: 120000,
	});

	child.on('close', (code) => {
		const elapsed = ((Date.now() - refreshState.startTime) / 1000).toFixed(1);
		refreshState.running = false;
		if (code === 0) {
			// Record the mtime of the freshly written data.json
			try {
				const stat = fs.statSync(dataJsonPath);
				refreshState.lastUpdated = stat.mtimeMs;
			} catch {
				refreshState.lastUpdated = Date.now();
			}
			refreshState.lastResult = { ok: true, message: `数据已更新 (${elapsed}s)` };
		} else {
			refreshState.lastResult = { ok: false, message: `生成失败 (exit ${code})` };
		}
	});

	child.on('error', (err) => {
		refreshState.running = false;
		refreshState.lastResult = { ok: false, message: err.message };
	});

	return true;
}

const server = http.createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		res.end();
		return;
	}

	// POST /api/refresh — 立即返回，后台异步生成
	if (req.url === '/api/refresh' && req.method === 'POST') {
		if (refreshState.running) {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ ok: true, running: true, message: '数据正在生成中...' }));
			return;
		}
		startRefresh();
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ ok: true, running: true, message: '开始生成数据...' }));
		return;
	}

	// GET /api/status — 查询当前刷新状态
	if (req.url === '/api/status' && req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(
			JSON.stringify({
				ok: true,
				running: refreshState.running,
				lastResult: refreshState.lastResult,
				lastUpdated: refreshState.lastUpdated,
			}),
		);
		return;
	}

	res.writeHead(404, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ ok: false, message: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
	process.stdout.write(`API server listening on http://127.0.0.1:${PORT}\n`);
});
