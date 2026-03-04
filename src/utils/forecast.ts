import type { TimeSeriesValue } from '../types';

export type ForecastMethod = 'LINEAR_TREND' | 'MOVING_AVERAGE' | 'FLAT_GROWTH' | 'SEASONAL_NAIVE';

export interface ForecastOptions {
    method: ForecastMethod;
    growthRate?: number; // For FLAT_GROWTH (e.g. 0.05 for 5%)
    periodsData?: TimeSeriesValue[]; // Historical data to base the forecast on
    forecastPeriods?: number; // How many periods to forecast
}

export const generateForecast = (options: ForecastOptions): number[] => {
    const { method, growthRate = 0.05, periodsData = [], forecastPeriods = 12 } = options;
    const historicalValues = periodsData.map(d => d.actual || 0);
    const n = historicalValues.length;
    const results: number[] = [];

    if (n === 0) {
        return Array(forecastPeriods).fill(0);
    }

    const lastValue = historicalValues[n - 1];

    switch (method) {
        case 'FLAT_GROWTH':
            for (let i = 1; i <= forecastPeriods; i++) {
                results.push(lastValue * Math.pow(1 + growthRate, i));
            }
            break;

        case 'MOVING_AVERAGE':
            const windowSize = Math.min(3, n); // 3-month moving avg
            let currentWindow = historicalValues.slice(-windowSize);
            for (let i = 0; i < forecastPeriods; i++) {
                const avg = currentWindow.reduce((a, b) => a + b, 0) / currentWindow.length;
                results.push(avg);
                currentWindow.shift();
                currentWindow.push(avg);
            }
            break;

        case 'LINEAR_TREND':
            if (n < 2) {
                // Fallback to flat
                for (let i = 1; i <= forecastPeriods; i++) results.push(lastValue);
                break;
            }
            // Simple Linear Regression
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += historicalValues[i];
                sumXY += i * historicalValues[i];
                sumXX += i * i;
            }
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            for (let i = 0; i < forecastPeriods; i++) {
                // Project forward starting from x = n
                results.push(intercept + slope * (n + i));
            }
            break;

        case 'SEASONAL_NAIVE':
            // Assumes annual seasonality (look back 12 periods)
            // If we don't have 12 periods, fallback to last value
            for (let i = 0; i < forecastPeriods; i++) {
                const lookbackIndex = n - 12 + (i % 12);
                if (lookbackIndex >= 0 && lookbackIndex < n) {
                    results.push(historicalValues[lookbackIndex]);
                } else {
                    results.push(lastValue);
                }
            }
            break;

        default:
            for (let i = 0; i < forecastPeriods; i++) results.push(lastValue);
    }

    return results;
};
