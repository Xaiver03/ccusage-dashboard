#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ccusage 路径 (相对 monorepo 根目录)
// ccusage 路径 (基于 monorepo 结构: apps/dashboard/scripts/ -> apps/ccusage/dist/)
const ccusagePath = path.resolve(__dirname, '../../ccusage/dist/index.js');

// Claude 数据目录(支持多个)
const claudeDirs = [
	path.join(os.homedir(), '.claude/projects'),
	path.join(os.homedir(), '.config/claude/projects'),
].filter((p) => fs.existsSync(p));

// 递归找所有 .jsonl 文件
function findJsonlFiles(dir) {
	const results = [];
	if (!fs.existsSync(dir)) return results;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findJsonlFiles(full));
		} else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
			results.push(full);
		}
	}
	return results;
}

// 按小时聚合今日数据
function generateHourlyData() {
	const today = new Date();
	const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD (本地时区)

	// 24 小时桶
	const hourlyBuckets = {};
	for (let h = 0; h < 24; h++) {
		hourlyBuckets[h] = {
			hour: h,
			label: `${String(h).padStart(2, '0')}:00`,
			inputTokens: 0,
			outputTokens: 0,
			cacheCreationTokens: 0,
			cacheReadTokens: 0,
			totalTokens: 0,
			totalCost: 0,
			modelsUsed: new Set(),
			modelBreakdowns: {},
		};
	}

	let totalEntries = 0;
	let todayEntries = 0;

	for (const dir of claudeDirs) {
		const files = findJsonlFiles(dir);
		for (const file of files) {
			// 只读今天可能有数据的文件 (修改时间是今天)
			const stat = fs.statSync(file);
			if (stat.mtime.toLocaleDateString('en-CA') !== todayStr) continue;

			const content = fs.readFileSync(file, 'utf8');
			const lines = content.split('\n');
			for (const line of lines) {
				if (!line.trim()) continue;
				totalEntries++;
				let obj;
				try {
					obj = JSON.parse(line);
				} catch {
					continue;
				}

				const ts = obj.timestamp;
				const usage = obj.message?.usage;
				const model = obj.message?.model;
				if (!ts || !usage || !model) continue;

				const date = new Date(ts);
				const dateStr = date.toLocaleDateString('en-CA');
				if (dateStr !== todayStr) continue;

				todayEntries++;
				const hour = date.getHours();
				const bucket = hourlyBuckets[hour];

				const input = usage.input_tokens || 0;
				const output = usage.output_tokens || 0;
				const cacheCreate = usage.cache_creation_input_tokens || 0;
				const cacheRead = usage.cache_read_input_tokens || 0;
				const total = input + output + cacheCreate + cacheRead;

				bucket.inputTokens += input;
				bucket.outputTokens += output;
				bucket.cacheCreationTokens += cacheCreate;
				bucket.cacheReadTokens += cacheRead;
				bucket.totalTokens += total;
				bucket.modelsUsed.add(model);

				// 简单费用估算 - 用 sonnet-4-6 价格 ($3/$15 per 1M)
				const cost =
					(input / 1_000_000) * 3 +
					(output / 1_000_000) * 15 +
					(cacheCreate / 1_000_000) * 3.75 +
					(cacheRead / 1_000_000) * 0.3;
				bucket.totalCost += cost;

				if (!bucket.modelBreakdowns[model]) {
					bucket.modelBreakdowns[model] = {
						modelName: model,
						inputTokens: 0,
						outputTokens: 0,
						cacheCreationTokens: 0,
						cacheReadTokens: 0,
						cost: 0,
					};
				}
				const mb = bucket.modelBreakdowns[model];
				mb.inputTokens += input;
				mb.outputTokens += output;
				mb.cacheCreationTokens += cacheCreate;
				mb.cacheReadTokens += cacheRead;
				mb.cost += cost;
			}
		}
	}

	// 转换 Set 为 Array, 转换 modelBreakdowns 为数组
	const hourly = Object.values(hourlyBuckets).map((b) => ({
		...b,
		modelsUsed: Array.from(b.modelsUsed),
		modelBreakdowns: Object.values(b.modelBreakdowns),
	}));

	return {
		date: todayStr,
		hourly,
		scannedEntries: totalEntries,
		todayEntries,
	};
}

function runCusage(args) {
	const cmd = `node "${ccusagePath}" ${args}`;
	console.log(`  > ${cmd}`);
	return execSync(cmd, {
		encoding: 'utf8',
		maxBuffer: 50 * 1024 * 1024,
		timeout: 60000,
	});
}

function generateData() {
	try {
		console.log('获取每日数据...');
		const dailyOutput = runCusage('daily --json --offline');
		const dailyData = JSON.parse(dailyOutput);

		console.log('获取每月数据...');
		const monthlyOutput = runCusage('monthly --json --offline');
		const monthlyData = JSON.parse(monthlyOutput);

		console.log('获取会话数据...');
		const sessionOutput = runCusage('session --json --offline');
		const sessionData = JSON.parse(sessionOutput);

		console.log('获取近三天小时级数据...');
		const hourlyOutput = runCusage('hourly --json --offline --last3d');
		const hourlyData = JSON.parse(hourlyOutput);
		console.log(`  小时数据: ${hourlyData.hourly?.length || 0} 条`);

		const data = {
			daily: dailyData,
			monthly: monthlyData,
			session: sessionData,
			hourly: hourlyData,
			generatedAt: new Date().toISOString(),
		};

		const outputPath = path.join(__dirname, '../public/data.json');
		fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

		console.log('数据生成成功');
		console.log('输出:', outputPath);
		console.log(`  每日: ${dailyData.daily?.length || 0} 条`);
		console.log(`  每月: ${monthlyData.monthly?.length || 0} 条`);
		console.log(`  会话: ${sessionData.sessions?.length || 0} 条`);
		console.log(`  今日小时桶: 24`);
	} catch (error) {
		console.error('数据生成失败:', error.message);
		process.exit(1);
	}
}

generateData();
