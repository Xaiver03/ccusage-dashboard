import { useState, useEffect, useMemo } from 'react';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	ArcElement,
	BarElement,
	Filler,
} from 'chart.js';
import { IconTokens, IconCost, IconCalendar, IconCpu, IconRefresh } from './Icons';
import './App.css';

ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	ArcElement,
	BarElement,
	Filler,
);

// i18n translations
const translations = {
	zh: {
		title: 'Claude Code 综合面板',
		subtitle: '基于 ccusage 的词元使用分析',
		refresh: '刷新数据',
		refreshing: '生成中...',
		timeRange: '时间范围:',
		today: '今日',
		yesterday: '昨天',
		threeDays: '近三天',
		week: '本周',
		month: '本月',
		all: '全部',
		custom: '自定义',
		to: '至',
		totalTokens: '词元总量',
		totalCost: '总费用',
		estimated: '(估算)',
		activeDays: '活跃天数',
		days: '天',
		modelsUsed: '使用模型数',
		count: '个',
		inputTokens: '输入词元',
		outputTokens: '输出词元',
		cacheWrite: '缓存写入',
		cacheRead: '缓存读取',
		tokenTrend: '词元使用趋势',
		hourlyTokenTrend: '词元使用分布（按小时）',
		costTrend: '费用趋势',
		hourlyCostTrend: '费用分布（按小时）',
		modelDistribution: '模型使用分布',
		modelStats: '模型使用详细统计',
		model: '模型',
		input: '输入',
		output: '输出',
		cacheWriteShort: '缓存写',
		cacheReadShort: '缓存读',
		total: '合计',
		cost: '费用',
		requests: '请求次数',
		requestsShort: '请求',
		totalRequests: '总请求数',
		recentUsage: '最近每日使用记录',
		hourlyRecentUsage: '小时使用记录',
		time: '时间',
		date: '日期',
		tokenCount: '词元数',
		models: '使用模型',
		noData: '暂无数据',
		loading: '加载数据中...',
		loadError: '加载失败',
		retry: '重试',
		compactTooltip: '紧凑格式 (1.2M, 3.4K)',
		fullTooltip: '完整格式 (1,234,567)',
		breakdownView: '分类视图',
		totalView: '总计视图',
	},
	en: {
		title: 'Claude Code Dashboard',
		subtitle: 'Token usage analysis powered by ccusage',
		refresh: 'Refresh',
		refreshing: 'Generating...',
		timeRange: 'Time Range:',
		today: 'Today',
		yesterday: 'Yesterday',
		threeDays: '3 Days',
		week: 'Week',
		month: 'Month',
		all: 'All',
		custom: 'Custom',
		to: 'to',
		totalTokens: 'Total Tokens',
		totalCost: 'Total Cost',
		estimated: '(est.)',
		activeDays: 'Active Days',
		days: 'days',
		modelsUsed: 'Models Used',
		count: '',
		inputTokens: 'Input Tokens',
		outputTokens: 'Output Tokens',
		cacheWrite: 'Cache Write',
		cacheRead: 'Cache Read',
		tokenTrend: 'Token Usage Trend',
		hourlyTokenTrend: 'Token Breakdown (by Hour)',
		costTrend: 'Cost Trend',
		hourlyCostTrend: 'Cost Breakdown (by Hour)',
		modelDistribution: 'Model Distribution',
		modelStats: 'Model Usage Details',
		model: 'Model',
		input: 'Input',
		output: 'Output',
		cacheWriteShort: 'Cache W.',
		cacheReadShort: 'Cache R.',
		total: 'Total',
		cost: 'Cost',
		requests: 'Requests',
		requestsShort: 'Req.',
		totalRequests: 'Total Requests',
		recentUsage: 'Recent Daily Usage',
		hourlyRecentUsage: 'Hourly Usage',
		time: 'Time',
		date: 'Date',
		tokenCount: 'Tokens',
		models: 'Models',
		noData: 'No data',
		loading: 'Loading...',
		loadError: 'Load Failed',
		retry: 'Retry',
		compactTooltip: 'Compact (1.2M, 3.4K)',
		fullTooltip: 'Full (1,234,567)',
		breakdownView: 'Breakdown',
		totalView: 'Total',
	},
};

function App() {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [timeRange, setTimeRange] = useState('month');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [numberFormat, setNumberFormat] = useState('compact');
	const [lang, setLang] = useState('zh');
	const [tokenViewMode, setTokenViewMode] = useState('total'); // 'total' | 'breakdown'
	const [refreshing, setRefreshing] = useState(false);
	const [refreshMsg, setRefreshMsg] = useState('');

	const t = translations[lang];
	const isHourlyView =
		timeRange === 'today' || timeRange === 'yesterday' || timeRange === 'threeDays';

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			const response = await fetch('/data.json?t=' + Date.now());
			if (!response.ok) throw new Error('Failed to load data');
			const jsonData = await response.json();
			setData(jsonData);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleRefresh = async () => {
		if (refreshing) return;
		setRefreshing(true);
		setRefreshMsg(lang === 'zh' ? '开始生成数据...' : 'Starting...');
		try {
			// 触发后台生成，立即返回
			const res = await fetch('/api/refresh', { method: 'POST' });
			const json = await res.json();
			if (!json.ok) {
				setRefreshMsg(json.message || (lang === 'zh' ? '刷新失败' : 'Failed'));
				setRefreshing(false);
				setTimeout(() => setRefreshMsg(''), 3000);
				return;
			}

			// 轮询状态直到完成
			let dots = 0;
			const poll = setInterval(async () => {
				dots = (dots + 1) % 4;
				const dotStr = '.'.repeat(dots + 1);
				setRefreshMsg(lang === 'zh' ? `生成中${dotStr}` : `Generating${dotStr}`);
				try {
					const statusRes = await fetch('/api/status');
					const status = await statusRes.json();
					if (!status.running) {
						clearInterval(poll);
						const result = status.lastResult;
						if (result?.ok) {
							setRefreshMsg(result.message);
							await loadData();
						} else {
							setRefreshMsg(result?.message || (lang === 'zh' ? '生成失败' : 'Failed'));
						}
						setRefreshing(false);
						setTimeout(() => setRefreshMsg(''), 3000);
					}
				} catch {
					clearInterval(poll);
					setRefreshing(false);
					setRefreshMsg('');
				}
			}, 800);
		} catch {
			// API server not running, just reload data.json
			await loadData();
			setRefreshMsg(lang === 'zh' ? '已重新加载' : 'Reloaded');
			setRefreshing(false);
			setTimeout(() => setRefreshMsg(''), 3000);
		}
	};

	// Filter daily data by time range
	const filteredDailyData = useMemo(() => {
		if (!data) return [];
		const dailyData = data.daily.daily || [];
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		switch (timeRange) {
			case 'today':
				return dailyData.filter((day) => {
					const dayDate = new Date(day.date);
					return dayDate >= today;
				});
			case 'yesterday': {
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);
				return dailyData.filter((day) => {
					const d = new Date(day.date);
					return d >= yesterday && d < today;
				});
			}
			case 'threeDays': {
				const threeDaysAgo = new Date(today);
				threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
				return dailyData.filter((day) => new Date(day.date) >= threeDaysAgo);
			}
			case 'week': {
				const weekAgo = new Date(today);
				weekAgo.setDate(weekAgo.getDate() - 7);
				return dailyData.filter((day) => new Date(day.date) >= weekAgo);
			}
			case 'month': {
				const monthAgo = new Date(today);
				monthAgo.setDate(monthAgo.getDate() - 30);
				return dailyData.filter((day) => new Date(day.date) >= monthAgo);
			}
			case 'all':
				return dailyData;
			case 'custom': {
				if (!startDate || !endDate) return dailyData;
				const start = new Date(startDate);
				const end = new Date(endDate);
				end.setDate(end.getDate() + 1);
				return dailyData.filter((day) => {
					const d = new Date(day.date);
					return d >= start && d < end;
				});
			}
			default:
				return dailyData;
		}
	}, [data, timeRange, startDate, endDate]);

	// Hourly data - fill missing hours with zeros for consistent display
	const hourlyData = useMemo(() => {
		if (!data) return [];
		const raw = data.hourly.hourly || [];

		// Determine date range from raw data
		const dates = new Set();
		for (const item of raw) {
			if (item.hour && item.hour.length >= 10) {
				dates.add(item.hour.substring(0, 10));
			}
		}
		const sortedDates = Array.from(dates).sort();

		// Create hour buckets for all dates in range
		const buckets = {};
		if (sortedDates.length > 0) {
			for (const dateStr of sortedDates) {
				for (let h = 0; h < 24; h++) {
					const hourKey = `${dateStr}T${String(h).padStart(2, '0')}`;
					buckets[hourKey] = {
						hour: hourKey,
						inputTokens: 0,
						outputTokens: 0,
						cacheCreationTokens: 0,
						cacheReadTokens: 0,
						totalTokens: 0,
						totalCost: 0,
						modelsUsed: [],
						modelBreakdowns: [],
					};
				}
			}
		} else {
			// Fallback: create buckets for today only
			const todayStr = new Date().toLocaleDateString('en-CA');
			for (let h = 0; h < 24; h++) {
				const hourKey = `${todayStr}T${String(h).padStart(2, '0')}`;
				buckets[hourKey] = {
					hour: hourKey,
					inputTokens: 0,
					outputTokens: 0,
					cacheCreationTokens: 0,
					cacheReadTokens: 0,
					totalTokens: 0,
					totalCost: 0,
					modelsUsed: [],
					modelBreakdowns: [],
				};
			}
		}

		// Fill in actual data
		for (const item of raw) {
			if (buckets[item.hour]) {
				buckets[item.hour] = item;
			}
		}

		return Object.values(buckets).sort((a, b) => a.hour.localeCompare(b.hour));
	}, [data]);

	// Filter hourly data by selected time range
	const filteredHourlyData = useMemo(() => {
		if (!data) return [];
		const raw = data.hourly.hourly || [];
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const todayStr = today.toLocaleDateString('en-CA');

		switch (timeRange) {
			case 'today':
				return raw.filter((item) => item.hour && item.hour.startsWith(todayStr));
			case 'yesterday': {
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);
				const yestStr = yesterday.toLocaleDateString('en-CA');
				return raw.filter((item) => item.hour && item.hour.startsWith(yestStr));
			}
			case 'threeDays': {
				const threeDaysAgo = new Date(today);
				threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
				return raw.filter((item) => {
					if (!item.hour) return false;
					const d = new Date(item.hour.substring(0, 10));
					return d >= threeDaysAgo;
				});
			}
			default:
				return raw;
		}
	}, [data, timeRange]);

	// Build display buckets for hourly view (fills missing hours)
	const displayHourlyData = useMemo(() => {
		if (!isHourlyView) return [];
		const raw = filteredHourlyData;
		if (raw.length === 0) return [];

		// Get all unique dates from filtered data
		const dates = new Set();
		for (const item of raw) {
			if (item.hour && item.hour.length >= 10) {
				dates.add(item.hour.substring(0, 10));
			}
		}
		const sortedDates = Array.from(dates).sort();

		// Create buckets for all dates
		const buckets = {};
		for (const dateStr of sortedDates) {
			for (let h = 0; h < 24; h++) {
				const hourKey = `${dateStr}T${String(h).padStart(2, '0')}`;
				buckets[hourKey] = {
					hour: hourKey,
					inputTokens: 0,
					outputTokens: 0,
					cacheCreationTokens: 0,
					cacheReadTokens: 0,
					totalTokens: 0,
					totalCost: 0,
					modelsUsed: [],
					modelBreakdowns: [],
				};
			}
		}

		// Fill in actual data
		for (const item of raw) {
			if (buckets[item.hour]) {
				buckets[item.hour] = item;
			}
		}

		return Object.values(buckets).sort((a, b) => a.hour.localeCompare(b.hour));
	}, [filteredHourlyData, isHourlyView]);

	if (loading) {
		return (
			<div className="loading">
				<div className="spinner"></div>
				<p>{t.loading}</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="error">
				<h2>{t.loadError}</h2>
				<p>{error}</p>
				<button onClick={loadData}>{t.retry}</button>
			</div>
		);
	}

	if (!data) {
		return <div className="no-data">{t.noData}</div>;
	}

	const sourceData = isHourlyView ? displayHourlyData : filteredDailyData;
	const totalTokens = sourceData.reduce((sum, item) => sum + (item.totalTokens || 0), 0);
	const totalCost = sourceData.reduce((sum, item) => sum + (item.totalCost || 0), 0);
	const activeDays = isHourlyView
		? new Set(filteredHourlyData.map((item) => item.hour?.substring(0, 10))).size
		: filteredDailyData.length;

	const totalInput = sourceData.reduce((s, item) => s + (item.inputTokens || 0), 0);
	const totalOutput = sourceData.reduce((s, item) => s + (item.outputTokens || 0), 0);
	const totalCacheWrite = sourceData.reduce((s, item) => s + (item.cacheCreationTokens || 0), 0);
	const totalCacheRead = sourceData.reduce((s, item) => s + (item.cacheReadTokens || 0), 0);

	// Total request count from model breakdowns in source data
	const totalRequests = sourceData.reduce((sum, item) => {
		if (!item.modelBreakdowns) return sum;
		return sum + item.modelBreakdowns.reduce((s, b) => s + (b.requestCount || 0), 0);
	}, 0);

	// Chart data
	const tokenTrendData = isHourlyView
		? {
				labels: displayHourlyData.map((h) => {
					const parts = h.hour.split('T');
					return `${parts[0]} ${parts[1]}:00`;
				}),
				datasets: [
					{
						label: t.inputTokens,
						data: displayHourlyData.map((h) => h.inputTokens),
						backgroundColor: 'rgba(88, 166, 255, 0.8)',
						borderColor: '#58a6ff',
						borderWidth: 1,
						borderRadius: 2,
						stack: 'stack1',
					},
					{
						label: t.outputTokens,
						data: displayHourlyData.map((h) => h.outputTokens),
						backgroundColor: 'rgba(63, 185, 80, 0.8)',
						borderColor: '#3fb950',
						borderWidth: 1,
						borderRadius: 2,
						stack: 'stack1',
					},
					{
						label: t.cacheWrite,
						data: displayHourlyData.map((h) => h.cacheCreationTokens),
						backgroundColor: 'rgba(210, 153, 34, 0.8)',
						borderColor: '#d29922',
						borderWidth: 1,
						borderRadius: 2,
						stack: 'stack1',
					},
					{
						label: t.cacheRead,
						data: displayHourlyData.map((h) => h.cacheReadTokens),
						backgroundColor: 'rgba(188, 140, 255, 0.8)',
						borderColor: '#bc8cff',
						borderWidth: 1,
						borderRadius: 2,
						stack: 'stack1',
					},
				],
			}
		: {
				labels: filteredDailyData.map((day) => day.date),
				datasets: [
					{
						label: t.totalTokens,
						data: filteredDailyData.map((day) => day.totalTokens),
						borderColor: '#58a6ff',
						backgroundColor: 'rgba(88, 166, 255, 0.1)',
						tension: 0.4,
						fill: true,
						pointBackgroundColor: '#58a6ff',
						pointBorderColor: '#58a6ff',
						pointRadius: 3,
						pointHoverRadius: 6,
					},
				],
			};

	const costTrendData = isHourlyView
		? {
				labels: displayHourlyData.map((h) => {
					const parts = h.hour.split('T');
					return `${parts[0]} ${parts[1]}:00`;
				}),
				datasets: [
					{
						label: t.totalCost,
						data: displayHourlyData.map((h) => h.totalCost),
						backgroundColor: 'rgba(63, 185, 80, 0.6)',
						borderColor: '#3fb950',
						borderWidth: 1,
						borderRadius: 4,
					},
				],
			}
		: {
				labels: filteredDailyData.map((day) => day.date),
				datasets: [
					{
						label: t.totalCost,
						data: filteredDailyData.map((day) => day.totalCost),
						borderColor: '#3fb950',
						backgroundColor: 'rgba(63, 185, 80, 0.1)',
						tension: 0.4,
						fill: true,
						pointBackgroundColor: '#3fb950',
						pointBorderColor: '#3fb950',
						pointRadius: 3,
						pointHoverRadius: 6,
					},
				],
			};

	// Model stats
	const modelStats = {};
	sourceData.forEach((item) => {
		if (item.modelBreakdowns) {
			item.modelBreakdowns.forEach((breakdown) => {
				const name = breakdown.modelName;
				const shortName = name
					.replace('anthropic/', '')
					.replace('claude-', '')
					.replace(/-\d{8}$/, '');
				const tokens =
					(breakdown.inputTokens || 0) +
					(breakdown.outputTokens || 0) +
					(breakdown.cacheCreationTokens || 0) +
					(breakdown.cacheReadTokens || 0);
				if (!modelStats[shortName]) {
					modelStats[shortName] = {
						tokens: 0,
						cost: 0,
						fullName: name,
						input: 0,
						output: 0,
						cacheWrite: 0,
						cacheRead: 0,
						requestCount: 0,
					};
				}
				modelStats[shortName].tokens += tokens;
				modelStats[shortName].cost += breakdown.cost || 0;
				modelStats[shortName].input += breakdown.inputTokens || 0;
				modelStats[shortName].output += breakdown.outputTokens || 0;
				modelStats[shortName].cacheWrite += breakdown.cacheCreationTokens || 0;
				modelStats[shortName].cacheRead += breakdown.cacheReadTokens || 0;
				modelStats[shortName].requestCount += breakdown.requestCount || 0;
			});
		}
	});

	const sortedModels = Object.entries(modelStats).sort((a, b) => b[1].tokens - a[1].tokens);
	const modelLabels = sortedModels.map(([name]) => name);
	const modelValues = sortedModels.map(([, v]) => v.tokens);
	const modelColors = [
		'#58a6ff',
		'#3fb950',
		'#d29922',
		'#f85149',
		'#bc8cff',
		'#79c0ff',
		'#56d364',
		'#e3b341',
		'#ff7b72',
		'#d2a8ff',
		'#a5d6ff',
		'#7ee787',
		'#ffd33d',
		'#ffa198',
		'#d2a8ff',
		'#80ccff',
	];

	const modelChartData = {
		labels: modelLabels,
		datasets: [
			{
				data: modelValues,
				backgroundColor: modelColors.slice(0, modelLabels.length),
				borderColor: 'transparent',
				borderWidth: 0,
			},
		],
	};

	const recentData = [...filteredDailyData].reverse().slice(0, 10);

	const formatNumber = (num) => {
		if (num == null) return '0';
		if (numberFormat === 'full') {
			return Math.round(num).toLocaleString('en-US');
		}
		if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
		if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
		return num.toString();
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: isHourlyView,
				position: 'top',
				labels: {
					color: '#8b949e',
					font: { size: 11 },
					usePointStyle: true,
					pointStyle: 'rectRounded',
					padding: 16,
				},
			},
			tooltip: {
				backgroundColor: '#1c2128',
				titleColor: '#e6edf3',
				bodyColor: '#8b949e',
				borderColor: '#30363d',
				borderWidth: 1,
				padding: 12,
				cornerRadius: 8,
				callbacks: {
					label: function (context) {
						const label = context.dataset.label || '';
						const value = context.parsed?.y ?? context.parsed;
						return `${label}: ${formatNumber(value)}`;
					},
				},
			},
		},
		scales: {
			x: {
				grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
				ticks: { color: '#8b949e', maxRotation: 0, font: { size: 11 } },
			},
			y: {
				grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
				ticks: { color: '#8b949e', font: { size: 11 } },
			},
		},
	};

	const tokenChartOptions = {
		...chartOptions,
		scales: {
			...chartOptions.scales,
			y: {
				...chartOptions.scales.y,
				ticks: {
					...chartOptions.scales.y.ticks,
					callback: (value) => formatNumber(value),
				},
			},
		},
	};

	const costChartOptions = {
		...chartOptions,
		scales: {
			...chartOptions.scales,
			y: {
				...chartOptions.scales.y,
				ticks: {
					...chartOptions.scales.y.ticks,
					callback: (value) => '$' + value.toFixed(2),
				},
			},
		},
	};

	const pieOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				backgroundColor: '#1c2128',
				titleColor: '#e6edf3',
				bodyColor: '#8b949e',
				borderColor: '#30363d',
				borderWidth: 1,
				padding: 12,
				cornerRadius: 8,
				callbacks: {
					label: function (context) {
						const label = context.label || '';
						const value = context.parsed || 0;
						const total = context.dataset.data.reduce((a, b) => a + b, 0);
						const percentage = ((value / total) * 100).toFixed(1);
						return `${label}: ${formatNumber(value)} tokens (${percentage}%)`;
					},
				},
			},
		},
	};

	return (
		<div className="app">
			{/* Header */}
			<header className="header">
				<div className="header-left">
					<h1>{t.title}</h1>
					<p className="subtitle">{t.subtitle}</p>
				</div>
				<div className="header-right">
					{/* Language Toggle */}
					<div className="format-toggle">
						<button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>
							中
						</button>
						<button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
							EN
						</button>
					</div>
					<div className="format-toggle">
						<button
							className={numberFormat === 'compact' ? 'active' : ''}
							onClick={() => setNumberFormat('compact')}
							title={t.compactTooltip}
						>
							1.2M
						</button>
						<button
							className={numberFormat === 'full' ? 'active' : ''}
							onClick={() => setNumberFormat('full')}
							title={t.fullTooltip}
						>
							1,234
						</button>
					</div>
					<button onClick={handleRefresh} className="refresh-btn" disabled={refreshing}>
						<IconRefresh size={14} className={refreshing ? 'spinning' : ''} />
						<span>{refreshing ? t.refreshing : t.refresh}</span>
					</button>
					{refreshMsg && <span className="refresh-msg">{refreshMsg}</span>}
					<span className="data-time">
						{data.generatedAt
							? new Date(data.generatedAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')
							: ''}
					</span>
				</div>
			</header>

			{/* Time Range Selector */}
			<div className="time-range">
				<label>{t.timeRange}</label>
				<button
					className={timeRange === 'today' ? 'active' : ''}
					onClick={() => setTimeRange('today')}
				>
					{t.today}
				</button>
				<button
					className={timeRange === 'yesterday' ? 'active' : ''}
					onClick={() => setTimeRange('yesterday')}
				>
					{t.yesterday}
				</button>
				<button
					className={timeRange === 'threeDays' ? 'active' : ''}
					onClick={() => setTimeRange('threeDays')}
				>
					{t.threeDays}
				</button>
				<button
					className={timeRange === 'week' ? 'active' : ''}
					onClick={() => setTimeRange('week')}
				>
					{t.week}
				</button>
				<button
					className={timeRange === 'month' ? 'active' : ''}
					onClick={() => setTimeRange('month')}
				>
					{t.month}
				</button>
				<button className={timeRange === 'all' ? 'active' : ''} onClick={() => setTimeRange('all')}>
					{t.all}
				</button>
				<div className="custom-range">
					<button
						className={timeRange === 'custom' ? 'active' : ''}
						onClick={() => setTimeRange('custom')}
					>
						{t.custom}
					</button>
					{timeRange === 'custom' && (
						<>
							<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
							<span style={{ color: 'var(--text-secondary)' }}>{t.to}</span>
							<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
						</>
					)}
				</div>
			</div>

			{/* Stats Grid */}
			<div className="stats-grid">
				{/* Total Tokens with toggle */}
				<div className="stat-card">
					<div className="stat-label" style={{ justifyContent: 'space-between' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<span className="stat-icon">
								<IconTokens size={14} />
							</span>
							<span>{t.totalTokens}</span>
						</div>
						<div className="format-toggle" style={{ margin: 0 }}>
							<button
								className={tokenViewMode === 'total' ? 'active' : ''}
								onClick={() => setTokenViewMode('total')}
								title={t.totalView}
								style={{ padding: '4px 8px', fontSize: '0.7rem' }}
							>
								∑
							</button>
							<button
								className={tokenViewMode === 'breakdown' ? 'active' : ''}
								onClick={() => setTokenViewMode('breakdown')}
								title={t.breakdownView}
								style={{ padding: '4px 8px', fontSize: '0.7rem' }}
							>
								≡
							</button>
						</div>
					</div>
					{tokenViewMode === 'total' ? (
						<div className="stat-value">{formatNumber(totalTokens)}</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
								<span style={{ color: '#58a6ff' }}>{t.input}</span>
								<span style={{ color: 'var(--text-primary)' }}>{formatNumber(totalInput)}</span>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
								<span style={{ color: '#3fb950' }}>{t.output}</span>
								<span style={{ color: 'var(--text-primary)' }}>{formatNumber(totalOutput)}</span>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
								<span style={{ color: '#d29922' }}>{t.cacheWriteShort}</span>
								<span style={{ color: 'var(--text-primary)' }}>
									{formatNumber(totalCacheWrite)}
								</span>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
								<span style={{ color: '#bc8cff' }}>{t.cacheReadShort}</span>
								<span style={{ color: 'var(--text-primary)' }}>{formatNumber(totalCacheRead)}</span>
							</div>
							<div
								style={{
									borderTop: '1px solid var(--border-color)',
									marginTop: 2,
									paddingTop: 4,
									display: 'flex',
									justifyContent: 'space-between',
									fontSize: '0.85rem',
									fontWeight: 600,
								}}
							>
								<span style={{ color: 'var(--text-primary)' }}>{t.total}</span>
								<span style={{ color: 'var(--text-primary)' }}>{formatNumber(totalTokens)}</span>
							</div>
						</div>
					)}
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon">
							<IconCost size={14} />
						</span>
						<span>{t.totalCost}</span>
						<span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 4 }}>
							{t.estimated}
						</span>
					</div>
					<div className="stat-value">${totalCost.toFixed(2)}</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon">
							<IconCalendar size={14} />
						</span>
						<span>{t.activeDays}</span>
					</div>
					<div className="stat-value">
						{activeDays}
						<span className="stat-unit"> {t.days}</span>
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon">
							<IconCpu size={14} />
						</span>
						<span>{t.modelsUsed}</span>
					</div>
					<div className="stat-value">
						{sortedModels.length}
						<span className="stat-unit"> {t.count}</span>
					</div>
				</div>
			</div>

			{/* Token Category Breakdown */}
			<div className="stats-grid stats-grid-5" style={{ marginBottom: 24 }}>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon" style={{ color: '#58a6ff' }}>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
							</svg>
						</span>
						<span>{t.inputTokens}</span>
					</div>
					<div className="stat-value" style={{ fontSize: '1.5rem' }}>
						{formatNumber(totalInput)}
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon" style={{ color: '#3fb950' }}>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
								<polyline points="16 17 22 17 22 11" />
							</svg>
						</span>
						<span>{t.outputTokens}</span>
					</div>
					<div className="stat-value" style={{ fontSize: '1.5rem' }}>
						{formatNumber(totalOutput)}
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon" style={{ color: '#d29922' }}>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="7 10 12 15 17 10" />
								<line x1="12" y1="15" x2="12" y2="3" />
							</svg>
						</span>
						<span>{t.cacheWrite}</span>
					</div>
					<div className="stat-value" style={{ fontSize: '1.5rem' }}>
						{formatNumber(totalCacheWrite)}
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon" style={{ color: '#bc8cff' }}>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
								<line x1="16" y1="13" x2="8" y2="13" />
								<line x1="16" y1="17" x2="8" y2="17" />
							</svg>
						</span>
						<span>{t.cacheRead}</span>
					</div>
					<div className="stat-value" style={{ fontSize: '1.5rem' }}>
						{formatNumber(totalCacheRead)}
					</div>
				</div>
				<div className="stat-card">
					<div className="stat-label">
						<span className="stat-icon" style={{ color: '#58a6ff' }}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
							</svg>
						</span>
						<span>{t.totalRequests}</span>
					</div>
					<div className="stat-value" style={{ fontSize: '1.5rem' }}>
						{totalRequests.toLocaleString()}
					</div>
				</div>
			</div>

			{/* Charts */}
			<div className="charts-container">
				<div className="chart-card">
					<h3>{isHourlyView ? t.hourlyTokenTrend : t.tokenTrend}</h3>
					<div className="chart-wrapper">
						{isHourlyView ? (
							<Bar data={tokenTrendData} options={tokenChartOptions} />
						) : (
							<Line data={tokenTrendData} options={tokenChartOptions} />
						)}
					</div>
				</div>
				<div className="chart-card">
					<h3>{isHourlyView ? t.hourlyCostTrend : t.costTrend}</h3>
					<div className="chart-wrapper">
						{isHourlyView ? (
							<Bar data={costTrendData} options={costChartOptions} />
						) : (
							<Line data={costTrendData} options={costChartOptions} />
						)}
					</div>
				</div>
			</div>

			{/* Bottom Section */}
			<div className="bottom-section">
				<div className="model-card">
					<h3>{t.modelDistribution}</h3>
					<div className="pie-wrapper">
						{modelLabels.length > 0 ? (
							<Pie data={modelChartData} options={pieOptions} />
						) : (
							<p style={{ color: 'var(--text-secondary)' }}>{t.noData}</p>
						)}
					</div>
					{modelLabels.length > 0 && (
						<div className="model-legend">
							{modelLabels.map((label, index) => {
								const totalTk = modelValues.reduce((a, b) => a + b, 0);
								const pct = totalTk > 0 ? ((modelValues[index] / totalTk) * 100).toFixed(1) : 0;
								return (
									<div key={label} className="legend-item">
										<div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
											<span
												className="legend-color"
												style={{ backgroundColor: modelColors[index % modelColors.length] }}
											/>
											<span className="legend-name" title={label}>
												{label}
											</span>
										</div>
										<span className="legend-value">
											{formatNumber(modelValues[index])} ({pct}%)
										</span>
									</div>
								);
							})}
						</div>
					)}
				</div>

				<div className="recent-card">
					<h3>{t.modelStats}</h3>
					<table className="recent-table">
						<thead>
							<tr>
								<th>{t.model}</th>
								<th>{t.requestsShort}</th>
								<th>{t.input}</th>
								<th>{t.output}</th>
								<th>{t.cacheWriteShort}</th>
								<th>{t.cacheReadShort}</th>
								<th>{t.total}</th>
								<th>{t.cost}</th>
							</tr>
						</thead>
						<tbody>
							{sortedModels.map(([name, stats], index) => {
								const totalTk = modelValues.reduce((a, b) => a + b, 0);
								const pct = totalTk > 0 ? ((stats.tokens / totalTk) * 100).toFixed(1) : 0;
								return (
									<tr key={name}>
										<td>
											<span
												style={{
													display: 'inline-block',
													width: 10,
													height: 10,
													borderRadius: 2,
													backgroundColor: modelColors[index % modelColors.length],
													marginRight: 8,
													verticalAlign: 'middle',
												}}
											/>
											{name}
										</td>
										<td style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>
											{(stats.requestCount || 0).toLocaleString()}
										</td>
										<td>{formatNumber(stats.input)}</td>
										<td>{formatNumber(stats.output)}</td>
										<td>{formatNumber(stats.cacheWrite)}</td>
										<td>{formatNumber(stats.cacheRead)}</td>
										<td style={{ fontWeight: 600 }}>{formatNumber(stats.tokens)}</td>
										<td>${stats.cost.toFixed(2)}</td>
									</tr>
								);
							})}
							{sortedModels.length === 0 && (
								<tr>
									<td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
										{t.noData}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Recent Usage */}
			<div className="recent-card" style={{ marginBottom: 24 }}>
				<h3>{isHourlyView ? t.hourlyRecentUsage : t.recentUsage}</h3>
				<table className="recent-table">
					<thead>
						<tr>
							<th>{isHourlyView ? t.time : t.date}</th>
							<th>{t.tokenCount}</th>
							<th>{t.cost}</th>
							<th>{t.models}</th>
						</tr>
					</thead>
					<tbody>
						{isHourlyView
							? [...displayHourlyData].reverse().map((h, index) => (
									<tr key={index}>
										<td>{h.hour.replace('T', ' ')}</td>
										<td>{formatNumber(h.totalTokens)}</td>
										<td>${(h.totalCost || 0).toFixed(2)}</td>
										<td title={h.modelsUsed?.join(', ')}>
											{h.modelsUsed
												?.map((m) =>
													m
														.replace('anthropic/', '')
														.replace('claude-', '')
														.replace(/-\d{8}$/, ''),
												)
												.join(', ') || '-'}
										</td>
									</tr>
								))
							: recentData.map((day, index) => (
									<tr key={index}>
										<td>{day.date}</td>
										<td>{formatNumber(day.totalTokens)}</td>
										<td>${(day.totalCost || 0).toFixed(2)}</td>
										<td title={day.modelsUsed?.join(', ')}>
											{day.modelsUsed
												?.map((m) =>
													m
														.replace('anthropic/', '')
														.replace('claude-', '')
														.replace(/-\d{8}$/, ''),
												)
												.join(', ') || '-'}
										</td>
									</tr>
								))}
						{(isHourlyView ? displayHourlyData.length === 0 : recentData.length === 0) && (
							<tr>
								<td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
									{t.noData}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default App;
