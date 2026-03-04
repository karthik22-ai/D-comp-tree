import type { KPIData, DateRange } from '../types';
import { getMonthsInRange } from './dateRange';

/**
 * Calculates monthly KPI values using bidirectional propagation.
 * Now returns a Record where each key is a KPI ID and value is an array of N numbers (+ 1 for total).
 */
export const calculateValues = (kpis: Record<string, KPIData>, dateRange: DateRange): Record<string, number[]> => {
    const months = getMonthsInRange(dateRange.startMonth, dateRange.startYear, dateRange.endMonth, dateRange.endYear);
    const periodCount = months.length;
    const results: Record<string, number[]> = {};
    const monthlyOverridesSet = new Set<string>();

    const evalFormula = (formula: string, monthIdx: number): number => {
        try {
            let expression = formula.substring(1).trim();
            expression = expression.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (match) => {
                const matchedKpi = Object.values(kpis).find(k =>
                    k.label.replace(/\s+/g, '').toLowerCase() === match.toLowerCase() || k.id === match
                );
                if (matchedKpi) {
                    return (results[matchedKpi.id]?.[monthIdx] ?? matchedKpi.data[monthIdx].actual).toString();
                }
                return match;
            });
            return Function(`"use strict"; return (${expression})`)();
        } catch (e) {
            console.error(`Error evaluating formula ${formula}:`, e);
            return 0;
        }
    };

    // Phase 1: Initialize
    Object.keys(kpis).forEach(id => {
        const kpi = kpis[id];
        results[id] = Array(periodCount + 1).fill(0);
        for (let m = 0; m < periodCount; m++) {
            results[id][m] = kpi.data[m]?.actual ?? 0;
        }

        // Apply simulation
        if (kpi.simulationValue !== 0 && kpi.simulationValue !== undefined) {
            const simVal = kpi.simulationValue;
            for (let m = 0; m < periodCount; m++) {
                results[id][m] = kpi.simulationType === 'PERCENT'
                    ? results[id][m] * (1 + simVal / 100)
                    : results[id][m] + simVal;
            }
        }
    });

    const distributeTopDown = (id: string, monthIdx: number, targetValue: number, oldValue: number) => {
        const kpi = kpis[id];
        if (!kpi || kpi.children.length === 0) return;

        // Even if results[id][monthIdx] === targetValue, we might need to push down 
        // if this was triggered by a change that haven't reached children yet.
        // But we need the OLD value to calculate the ratio correctly.

        const ratio = oldValue !== 0 ? targetValue / oldValue : (targetValue / kpi.children.length);
        if (ratio === 1) return; // No change needed

        kpi.children.forEach(childId => {
            if (!monthlyOverridesSet.has(`${childId}-${monthIdx}`)) {
                const prevChildVal = results[childId][monthIdx];
                if (kpi.formula === 'PRODUCT') {
                    results[childId][monthIdx] *= Math.pow(ratio, 1 / kpi.children.length);
                } else {
                    results[childId][monthIdx] *= ratio;
                }
                // Recurse with the actual change made to child
                distributeTopDown(childId, monthIdx, results[childId][monthIdx], prevChildVal);
            }
        });
    };

    const computeNode = (id: string) => {
        const kpi = kpis[id];
        if (!kpi) return;

        // 1. Recursive bottom-up first
        kpi.children.forEach(computeNode);

        // Store original values for this month before applying parent-level changes
        const preOverrideValues = [...results[id]];

        // 2. Aggregate monthly values from children
        for (let m = 0; m < periodCount; m++) {
            const override = kpi.monthlyOverrides?.[m];
            if (override !== undefined && override !== null && override !== '') {
                if (typeof override === 'string' && override.startsWith('=')) {
                    results[id][m] = evalFormula(override, m);
                } else if (typeof override === 'number') {
                    results[id][m] = override;
                } else {
                    const parsed = parseFloat(override as string);
                    if (!isNaN(parsed)) results[id][m] = parsed;
                }
                monthlyOverridesSet.add(`${id}-${m}`);
            } else if (kpi.children.length > 0) {
                const childVals = kpi.children.map(cid => results[cid][m]);
                if (kpi.formula === 'SUM') {
                    results[id][m] = childVals.reduce((a, b) => a + b, 0);
                } else if (kpi.formula === 'PRODUCT') {
                    results[id][m] = childVals.reduce((a, b) => a * b, 1);
                } else if (kpi.formula === 'AVERAGE') {
                    results[id][m] = childVals.length > 0 ? childVals.reduce((a, b) => a + b, 0) / childVals.length : 0;
                } else if (kpi.formula === 'CUSTOM' && kpi.customFormula) {
                    try {
                        let formula = kpi.customFormula;
                        kpi.children.forEach(cid => {
                            const childRef = kpis[cid].label.replace(/\s+/g, '');
                            formula = formula.replace(new RegExp(childRef, 'g'), results[cid][m].toString());
                        });
                        results[id][m] = Function(`"use strict"; return (${formula})`)();
                    } catch (e) { results[id][m] = 0; }
                }
            }
        }

        // 3. Handle Annual Override (Disaggregation)
        if (kpi.fullYearOverride !== undefined && kpi.fullYearOverride !== null) {
            const currentAnnual = results[id].slice(0, periodCount).reduce((a, b) => a + b, 0);
            if (Math.abs(currentAnnual - kpi.fullYearOverride) > 0.01) {
                const ratio = currentAnnual !== 0 ? kpi.fullYearOverride / currentAnnual : (kpi.fullYearOverride / periodCount);
                for (let m = 0; m < periodCount; m++) {
                    if (!monthlyOverridesSet.has(`${id}-${m}`)) {
                        results[id][m] *= ratio;
                    }
                }
            }
        }

        // 4. Propagate this node's final monthly state to children ONLY IF this node had an explicit override
        // Top-down allocation should not happen just because bottom-up aggregation changed the node's value.
        const hasMonthlyOverride = kpi.monthlyOverrides?.some(o => o !== undefined && o !== null && o !== '');
        const hasSimulation = kpi.simulationValue !== 0 && kpi.simulationValue !== undefined;

        if (kpi.fullYearOverride !== undefined || hasMonthlyOverride || hasSimulation) {
            for (let m = 0; m < periodCount; m++) {
                if (results[id][m] !== preOverrideValues[m]) {
                    distributeTopDown(id, m, results[id][m], preOverrideValues[m]);
                }
            }
        }
    };

    // Run computation starting from roots
    Object.keys(kpis).forEach(id => {
        if (!kpis[id].parentId) computeNode(id);
    });

    // Final pass for total sums (using periodCount for dynamic range)
    Object.keys(results).forEach(id => {
        results[id][periodCount] = results[id].slice(0, periodCount).reduce((a, b) => a + b, 0);
    });

    return results;
};
