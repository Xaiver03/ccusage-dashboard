import { useState, useEffect, useCallback } from 'react';

// 内置默认价格（per 1M tokens，USD）
// 来源：Anthropic 官方定价（作为 LiteLLM 加载失败时的兜底）
const DEFAULT_PRICES = {
	// Claude 4 系列
	'claude-opus-4': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
	'claude-sonnet-4': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-sonnet-4-5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
	// Claude 3.x 系列
	'claude-opus-3-5': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
	'claude-sonnet-3-5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-haiku-3-5': { input: 0.8, output: 4.0, cacheWrite: 1.0, cacheRead: 0.08 },
	'claude-opus-3': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
	'claude-sonnet-3': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-haiku-3': { input: 0.25, output: 1.25, cacheWrite: 0.3, cacheRead: 0.03 },
	// GLM 系列（智谱 AI，市场参考价）
	'glm-4.5': { input: 0.6, output: 2.2, cacheWrite: 0.0, cacheRead: 0.0 },
	'glm-4.5-air': { input: 0.13, output: 0.85, cacheWrite: 0.0, cacheRead: 0.0 },
	'glm-5-turbo': { input: 1.2, output: 4.0, cacheWrite: 0.0, cacheRead: 0.0 },
	'glm-5.1': { input: 1.26, output: 3.96, cacheWrite: 0.0, cacheRead: 0.0 },
	// DeepSeek 系列（市场参考价）
	'deepseek-v4-pro': { input: 0.145, output: 3.48, cacheWrite: 0.0, cacheRead: 0.0 },
	'deepseek-v4-flash': { input: 0.135, output: 0.28, cacheWrite: 0.0, cacheRead: 0.0 },
	// MiniMax 系列（市场参考价）
	'MiniMax-M2.7-highspeed': { input: 0.3, output: 1.2, cacheWrite: 0.0, cacheRead: 0.0 },
	// Kimi 系列（月之暗面，市场参考价）
	'kimi-for-coding': { input: 0.6, output: 3.0, cacheWrite: 0.0, cacheRead: 0.0 },
	// MiMo 系列（小米，市场参考价）
	'mimo-v2.5-pro': { input: 1.0, output: 3.0, cacheWrite: 0.0, cacheRead: 0.0 },
};

const STORAGE_KEY = 'ccusage_pricing_overrides';

function loadOverrides() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveOverrides(overrides) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

const translations = {
	zh: {
		title: '模型定价配置',
		subtitle: '自定义各模型的 token 价格（每百万 token，USD）',
		model: '模型',
		inputPrice: '输入价格',
		outputPrice: '输出价格',
		cacheWritePrice: '缓存写入',
		cacheReadPrice: '缓存读取',
		actions: '操作',
		reset: '重置',
		resetAll: '全部重置',
		save: '保存',
		saved: '已保存',
		addCustom: '添加自定义模型',
		addBtn: '添加',
		modelName: '模型名称',
		customModels: '自定义模型',
		builtinModels: '内置模型',
		detectedModels: '已检测到的模型',
		overrideNote: '已覆盖',
		defaultNote: '默认',
		perMillion: '/百万 token',
		deleteModel: '删除',
		info: '价格覆盖将用于仪表盘的费用估算。未配置的模型使用 claude-sonnet-4-6 价格估算。',
		noData: '暂无数据，请先刷新数据',
		cancel: '取消',
		litellmLoading: '正在从 LiteLLM 加载最新定价...',
		litellmLoaded: '已从 LiteLLM 加载最新定价',
		litellmError: '无法加载 LiteLLM 定价，使用内置默认值',
		litellmSource: 'LiteLLM 数据源',
	},
	en: {
		title: 'Model Pricing Config',
		subtitle: 'Customize token prices per model (per 1M tokens, USD)',
		model: 'Model',
		inputPrice: 'Input',
		outputPrice: 'Output',
		cacheWritePrice: 'Cache Write',
		cacheReadPrice: 'Cache Read',
		actions: 'Actions',
		reset: 'Reset',
		resetAll: 'Reset All',
		save: 'Save',
		saved: 'Saved',
		addCustom: 'Add Custom Model',
		addBtn: 'Add',
		modelName: 'Model Name',
		customModels: 'Custom Models',
		builtinModels: 'Built-in Models',
		detectedModels: 'Detected Models',
		overrideNote: 'Overridden',
		defaultNote: 'Default',
		perMillion: '/1M tokens',
		deleteModel: 'Delete',
		info: 'Price overrides are used for cost estimation in the dashboard. Unknown models fall back to claude-sonnet-4-6 pricing.',
		noData: 'No data yet. Please refresh data first.',
		cancel: 'Cancel',
		litellmLoading: 'Loading latest pricing from LiteLLM...',
		litellmLoaded: 'Loaded latest pricing from LiteLLM',
		litellmError: 'Could not load LiteLLM pricing, using built-in defaults',
		litellmSource: 'LiteLLM source',
	},
};

function PriceInput({ value, onChange, disabled }) {
	return (
		<input
			type="number"
			min="0"
			step="0.01"
			value={value}
			onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
			disabled={disabled}
			className="price-input"
		/>
	);
}

export function PricingConfig({ lang = 'zh', detectedModels = [] }) {
	const t = translations[lang];
	const [overrides, setOverrides] = useState(loadOverrides);
	const [editingModel, setEditingModel] = useState(null);
	const [editValues, setEditValues] = useState({});
	const [savedModels, setSavedModels] = useState({});
	const [newModelName, setNewModelName] = useState('');
	const [showAddForm, setShowAddForm] = useState(false);
	const [litellmPrices, setLitellmPrices] = useState(null);
	const [litellmLoading, setLitellmLoading] = useState(false);
	const [litellmError, setLitellmError] = useState(null);

	// Fetch LiteLLM prices from API server
	useEffect(() => {
		setLitellmLoading(true);
		fetch('/api/pricing')
			.then((res) => res.json())
			.then((data) => {
				if (data.ok && data.prices) {
					setLitellmPrices(data.prices);
				} else {
					setLitellmError(data.message || 'Failed to load');
				}
			})
			.catch((err) => setLitellmError(err.message))
			.finally(() => setLitellmLoading(false));
	}, []);

	// Build effective default prices: LiteLLM prices take precedence over built-in defaults
	const effectiveDefaults = useCallback(() => {
		const base = { ...DEFAULT_PRICES };
		if (litellmPrices) {
			for (const [key, val] of Object.entries(litellmPrices)) {
				if (val && (val.input != null || val.output != null)) {
					base[key] = {
						input: val.input ?? 3.0,
						output: val.output ?? 15.0,
						cacheWrite: val.cacheWrite ?? 3.75,
						cacheRead: val.cacheRead ?? 0.3,
					};
				}
			}
		}
		return base;
	}, [litellmPrices]);

	// Merge detected models with built-in defaults
	const allModels = useCallback(() => {
		const models = effectiveDefaults();
		for (const m of detectedModels) {
			if (!models[m]) {
				// Try to find a matching default by prefix
				const matchKey = Object.keys(models).find((k) => m.includes(k) || k.includes(m));
				models[m] = matchKey
					? { ...models[matchKey] }
					: { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 };
			}
		}
		return models;
	}, [detectedModels, effectiveDefaults]);

	const getEffectivePrice = (modelKey) => {
		return (
			overrides[modelKey] ||
			allModels()[modelKey] || { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 }
		);
	};

	const startEdit = (modelKey) => {
		setEditingModel(modelKey);
		setEditValues({ ...getEffectivePrice(modelKey) });
	};

	const cancelEdit = () => {
		setEditingModel(null);
		setEditValues({});
	};

	const saveEdit = (modelKey) => {
		const newOverrides = { ...overrides, [modelKey]: { ...editValues } };
		setOverrides(newOverrides);
		saveOverrides(newOverrides);
		setEditingModel(null);
		setSavedModels((prev) => ({ ...prev, [modelKey]: true }));
		setTimeout(() => setSavedModels((prev) => ({ ...prev, [modelKey]: false })), 2000);
	};

	const resetModel = (modelKey) => {
		const newOverrides = { ...overrides };
		delete newOverrides[modelKey];
		setOverrides(newOverrides);
		saveOverrides(newOverrides);
		if (editingModel === modelKey) cancelEdit();
	};

	const resetAll = () => {
		setOverrides({});
		saveOverrides({});
		cancelEdit();
	};

	const addCustomModel = () => {
		const name = newModelName.trim();
		if (!name) return;
		const newOverrides = {
			...overrides,
			[name]: { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
		};
		setOverrides(newOverrides);
		saveOverrides(newOverrides);
		setNewModelName('');
		setShowAddForm(false);
		startEdit(name);
	};

	const deleteCustomModel = (modelKey) => {
		// Only allow deleting models not in DEFAULT_PRICES and not detected
		const newOverrides = { ...overrides };
		delete newOverrides[modelKey];
		setOverrides(newOverrides);
		saveOverrides(newOverrides);
	};

	const models = allModels();
	// Custom models: in overrides but not in DEFAULT_PRICES and not in detectedModels
	const customModelKeys = Object.keys(overrides).filter(
		(k) => !DEFAULT_PRICES[k] && !detectedModels.includes(k),
	);

	// Detected models not in DEFAULT_PRICES
	const detectedOnlyKeys = detectedModels.filter((m) => !DEFAULT_PRICES[m]);

	const renderRow = (modelKey, isCustom = false) => {
		const isEditing = editingModel === modelKey;
		const hasOverride = !!overrides[modelKey];
		const price = getEffectivePrice(modelKey);
		const isSaved = savedModels[modelKey];

		return (
			<tr key={modelKey} className={hasOverride ? 'pricing-row overridden' : 'pricing-row'}>
				<td className="model-name-cell">
					<span className="model-name-text" title={modelKey}>
						{modelKey}
					</span>
					{hasOverride && <span className="override-badge">{t.overrideNote}</span>}
				</td>
				{isEditing ? (
					<>
						<td>
							<PriceInput
								value={editValues.input}
								onChange={(v) => setEditValues((p) => ({ ...p, input: v }))}
							/>
						</td>
						<td>
							<PriceInput
								value={editValues.output}
								onChange={(v) => setEditValues((p) => ({ ...p, output: v }))}
							/>
						</td>
						<td>
							<PriceInput
								value={editValues.cacheWrite}
								onChange={(v) => setEditValues((p) => ({ ...p, cacheWrite: v }))}
							/>
						</td>
						<td>
							<PriceInput
								value={editValues.cacheRead}
								onChange={(v) => setEditValues((p) => ({ ...p, cacheRead: v }))}
							/>
						</td>
						<td className="actions-cell">
							<button className="btn-save" onClick={() => saveEdit(modelKey)}>
								{t.save}
							</button>
							<button className="btn-cancel" onClick={cancelEdit}>
								{t.cancel}
							</button>
						</td>
					</>
				) : (
					<>
						<td className="price-cell">${price.input.toFixed(2)}</td>
						<td className="price-cell">${price.output.toFixed(2)}</td>
						<td className="price-cell">${(price.cacheWrite || 0).toFixed(2)}</td>
						<td className="price-cell">${(price.cacheRead || 0).toFixed(2)}</td>
						<td className="actions-cell">
							{isSaved ? (
								<span className="saved-indicator">✓ {t.saved}</span>
							) : (
								<button className="btn-edit" onClick={() => startEdit(modelKey)}>
									✏️ {t.save}
								</button>
							)}
							{hasOverride && (
								<button className="btn-reset" onClick={() => resetModel(modelKey)}>
									{t.reset}
								</button>
							)}
							{isCustom && !DEFAULT_PRICES[modelKey] && !detectedModels.includes(modelKey) && (
								<button className="btn-delete" onClick={() => deleteCustomModel(modelKey)}>
									{t.deleteModel}
								</button>
							)}
						</td>
					</>
				)}
			</tr>
		);
	};

	const hasAnyOverride = Object.keys(overrides).length > 0;

	return (
		<div className="pricing-config">
			<div className="pricing-header">
				<div>
					<h2>{t.title}</h2>
					<p className="pricing-subtitle">{t.subtitle}</p>
				</div>
				<div className="pricing-header-actions">
					{hasAnyOverride && (
						<button className="btn-reset-all" onClick={resetAll}>
							{t.resetAll}
						</button>
					)}
					<button className="btn-add-model" onClick={() => setShowAddForm((v) => !v)}>
						+ {t.addCustom}
					</button>
				</div>
			</div>

			<div className="pricing-info-banner">ℹ️ {t.info}</div>

			{showAddForm && (
				<div className="add-model-form">
					<input
						type="text"
						placeholder={t.modelName}
						value={newModelName}
						onChange={(e) => setNewModelName(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && addCustomModel()}
						className="model-name-input"
						autoFocus
					/>
					<button className="btn-save" onClick={addCustomModel}>
						{t.addBtn}
					</button>
					<button
						className="btn-cancel"
						onClick={() => {
							setShowAddForm(false);
							setNewModelName('');
						}}
					>
						{t.cancel}
					</button>
				</div>
			)}

			{/* Custom models section */}
			{customModelKeys.length > 0 && (
				<div className="pricing-section">
					<h3 className="pricing-section-title">{t.customModels}</h3>
					<table className="pricing-table">
						<thead>
							<tr>
								<th>{t.model}</th>
								<th>
									{t.inputPrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>
									{t.outputPrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>
									{t.cacheWritePrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>
									{t.cacheReadPrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>{t.actions}</th>
							</tr>
						</thead>
						<tbody>{customModelKeys.map((k) => renderRow(k, true))}</tbody>
					</table>
				</div>
			)}

			{/* Detected models not in defaults */}
			{detectedOnlyKeys.length > 0 && (
				<div className="pricing-section">
					<h3 className="pricing-section-title">{t.detectedModels}</h3>
					<table className="pricing-table">
						<thead>
							<tr>
								<th>{t.model}</th>
								<th>
									{t.inputPrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>
									{t.outputPrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>
									{t.cacheWritePrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>
									{t.cacheReadPrice} <span className="per-million">{t.perMillion}</span>
								</th>
								<th>{t.actions}</th>
							</tr>
						</thead>
						<tbody>{detectedOnlyKeys.map((k) => renderRow(k, false))}</tbody>
					</table>
				</div>
			)}

			{/* Built-in models */}
			<div className="pricing-section">
				<h3 className="pricing-section-title">{t.builtinModels}</h3>
				<table className="pricing-table">
					<thead>
						<tr>
							<th>{t.model}</th>
							<th>
								{t.inputPrice} <span className="per-million">{t.perMillion}</span>
							</th>
							<th>
								{t.outputPrice} <span className="per-million">{t.perMillion}</span>
							</th>
							<th>
								{t.cacheWritePrice} <span className="per-million">{t.perMillion}</span>
							</th>
							<th>
								{t.cacheReadPrice} <span className="per-million">{t.perMillion}</span>
							</th>
							<th>{t.actions}</th>
						</tr>
					</thead>
					<tbody>{Object.keys(DEFAULT_PRICES).map((k) => renderRow(k, false))}</tbody>
				</table>
			</div>
		</div>
	);
}

// Export the hook for use in App.jsx to get effective prices
export function usePricingOverrides() {
	const [overrides, setOverrides] = useState(loadOverrides);

	useEffect(() => {
		const handler = () => setOverrides(loadOverrides());
		window.addEventListener('storage', handler);
		return () => window.removeEventListener('storage', handler);
	}, []);

	return overrides;
}

export { DEFAULT_PRICES, STORAGE_KEY };
