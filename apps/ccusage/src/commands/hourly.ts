import type { UsageReportConfig } from '@ccusage/terminal/table';
import process from 'node:process';
import {
	addEmptySeparatorRow,
	createUsageReportTable,
	formatTotalsRow,
	formatUsageDataRow,
	pushBreakdownRows,
} from '@ccusage/terminal/table';
import { Result } from '@praha/byethrow';
import { define } from 'gunshi';
import { loadConfig, mergeConfigWithArgs } from '../_config-loader-tokens.ts';
import { processWithJq } from '../_jq-processor.ts';
import { sharedCommandConfig } from '../_shared-args.ts';
import { calculateTotals, createTotalsObject, getTotalTokens } from '../calculate-cost.ts';
import { loadHourlyUsageData } from '../data-loader.ts';
import { log, logger } from '../logger.ts';

export const hourlyCommand = define({
	name: 'hourly',
	description: 'Show usage report grouped by hour (YYYY-MM-DDTHH)',
	...sharedCommandConfig,
	async run(ctx) {
		// Load configuration and merge with CLI arguments
		const config = loadConfig(ctx.values.config, ctx.values.debug);
		const mergedOptions = { ...mergeConfigWithArgs(ctx, config, ctx.values.debug) };

		// Handle convenience time range flags
		const today = new Date();
		const todayStr = today.toLocaleDateString('en-CA').replace(/-/g, '');

		if (mergedOptions.today) {
			mergedOptions.since = todayStr;
			mergedOptions.until = todayStr;
		} else if (mergedOptions.yesterday) {
			const yesterday = new Date(today);
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayStr = yesterday.toLocaleDateString('en-CA').replace(/-/g, '');
			mergedOptions.since = yesterdayStr;
			mergedOptions.until = yesterdayStr;
		} else if (mergedOptions.last3d) {
			const threeDaysAgo = new Date(today);
			threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
			mergedOptions.since = threeDaysAgo.toLocaleDateString('en-CA').replace(/-/g, '');
			mergedOptions.until = todayStr;
		} else if (mergedOptions.last7d) {
			const sevenDaysAgo = new Date(today);
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
			mergedOptions.since = sevenDaysAgo.toLocaleDateString('en-CA').replace(/-/g, '');
			mergedOptions.until = todayStr;
		} else if (mergedOptions.last30d) {
			const thirtyDaysAgo = new Date(today);
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
			mergedOptions.since = thirtyDaysAgo.toLocaleDateString('en-CA').replace(/-/g, '');
			mergedOptions.until = todayStr;
		} else if (mergedOptions.since == null) {
			// Default to today's data only for hourly command
			mergedOptions.since = todayStr;
			mergedOptions.until = todayStr;
		}

		// --jq implies --json
		const useJson = Boolean(mergedOptions.json) || mergedOptions.jq != null;
		if (useJson) {
			logger.level = 0;
		}

		const hourlyData = await loadHourlyUsageData(mergedOptions);

		if (hourlyData.length === 0) {
			if (useJson) {
				log(JSON.stringify([]));
			} else {
				logger.warn('No Claude usage data found.');
			}
			process.exit(0);
		}

		// Calculate totals
		const totals = calculateTotals(hourlyData);

		if (useJson) {
			const jsonOutput = {
				hourly: hourlyData.map((data) => ({
					hour: data.hour,
					inputTokens: data.inputTokens,
					outputTokens: data.outputTokens,
					cacheCreationTokens: data.cacheCreationTokens,
					cacheReadTokens: data.cacheReadTokens,
					totalTokens: getTotalTokens(data),
					totalCost: data.totalCost,
					modelsUsed: data.modelsUsed,
					modelBreakdowns: data.modelBreakdowns,
				})),
				totals: createTotalsObject(totals),
			};

			if (mergedOptions.jq != null) {
				const jqResult = await processWithJq(jsonOutput, mergedOptions.jq);
				if (Result.isFailure(jqResult)) {
					logger.error(jqResult.error.message);
					process.exit(1);
				}
				log(jqResult.value);
			} else {
				log(JSON.stringify(jsonOutput, null, 2));
			}
		} else {
			logger.box('Claude Code Token Usage Report - Hourly');

			const tableConfig: UsageReportConfig = {
				firstColumnName: 'Hour',
				dateFormatter: (hourStr: string) => hourStr,
				forceCompact: ctx.values.compact,
			};
			const table = createUsageReportTable(tableConfig);

			for (const data of hourlyData) {
				const row = formatUsageDataRow(data.hour, {
					inputTokens: data.inputTokens,
					outputTokens: data.outputTokens,
					cacheCreationTokens: data.cacheCreationTokens,
					cacheReadTokens: data.cacheReadTokens,
					totalCost: data.totalCost,
					modelsUsed: data.modelsUsed,
				});
				table.push(row);

				if (mergedOptions.breakdown) {
					pushBreakdownRows(table, data.modelBreakdowns);
				}
			}

			addEmptySeparatorRow(table, 8);

			const totalsRow = formatTotalsRow({
				inputTokens: totals.inputTokens,
				outputTokens: totals.outputTokens,
				cacheCreationTokens: totals.cacheCreationTokens,
				cacheReadTokens: totals.cacheReadTokens,
				totalCost: totals.totalCost,
			});
			table.push(totalsRow);

			log(table.toString());

			if (table.isCompactMode()) {
				logger.info('\nRunning in Compact Mode');
				logger.info('Expand terminal width to see cache metrics and total tokens');
			}
		}
	},
});
