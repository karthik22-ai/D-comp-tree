import type { KPIData, DateRange } from '../types';
import { getMonthsInRange } from './dateRange';

/**
 * Calculates monthly KPI values using bidirectional propagation with locking awareness.
 * Returns an object with final results and a set of KPI IDs that were changed from baseline.
 */
export const calculateAllValues = (kpis: Record<string, KPIData>, dateRange: DateRange): {
    results: Record<string, number[]>,
    impactedKpis: Set<string>
} => {
    const months = getMonthsInRange(dateRange.startMonth, dateRange.startYear, dateRange.endMonth, dateRange.endYear);
    const periodCount = months.length;
    const results: Record<string, number[]> = {};
    const monthlyOverridesSet = new Set<string>();
    const impactedKpis = new Set<string>();

    const evalFormula = (formula: string, monthIdx: number): number => {
        try {
            let expression = formula.substring(1).trim();
            expression = expression.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (match) => {
                const reserved = ['Math', 'sin', 'cos', 'tan', 'max', 'min', 'abs', 'pow', 'sqrt', 'log', 'PI', 'E', 'round', 'floor', 'ceil'];
                if (reserved.includes(match)) return match;

                const matchedKpi = Object.values(kpis).find(k =>
                    k.label.replace(/\s+/g, '').toLowerCase() === match.toLowerCase() || k.id === match
                );
                if (matchedKpi) {
                    // results[matchedKpi.id] is relative to the range, so monthIdx is still correct here
                    return (results[matchedKpi.id]?.[monthIdx] ?? 0).toString();
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
            const rangeMonthIndex = months[m].month; // 0-11
            // Use the data point that matches this specific month (Jan..Dec)
            // This ensures different date ranges still pull the correct month data.
            results[id][m] = kpi.data[rangeMonthIndex]?.actual ?? 0;
        }

        // Apply simulation
        if (kpi.simulationValue !== 0 && kpi.simulationValue !== undefined) {
            const simVal = kpi.simulationValue;
            impactedKpis.add(id);
            for (let m = 0; m < periodCount; m++) {
                results[id][m] = kpi.simulationType === 'PERCENT'
                    ? results[id][m] * (1 + simVal / 100)
                    : results[id][m] + simVal;
            }
        }
    });

    const distributeTopDown = (id: string, monthIdx: number, targetValue: number) => {
        const kpi = kpis[id];
        if (!kpi || kpi.children.length === 0) return;

        const mutableChildren = kpi.children.filter(cid => {
            const child = kpis[cid];
            const isManualOverride = monthlyOverridesSet.has(`${cid}-${monthIdx}`);
            const IsKpiLocked = child.isLocked;
            const isCellLocked = child.lockedMonths?.[monthIdx];
            return !isManualOverride && !IsKpiLocked && !isCellLocked;
        });

        if (mutableChildren.length === 0) return;

        if (kpi.formula === 'PRODUCT') {
            const fixedChildren = kpi.children.filter(cid => !mutableChildren.includes(cid));
            const fixedProduct = fixedChildren.reduce((acc: number, cid: string) => acc * results[cid][monthIdx], 1);
            const neededProductForMutables = fixedProduct !== 0 ? targetValue / fixedProduct : targetValue;

            const childValues = mutableChildren.map(cid => results[cid][monthIdx]);
            const zeros = childValues.filter(v => Math.abs(v) < 1e-8).length;
            const nonZerosProduct = childValues.filter(v => Math.abs(v) >= 1e-8).reduce((a, b: number) => a * b, 1);
            let signAbsorbed = false;

            mutableChildren.forEach((childId) => {
                const prevVal = results[childId][monthIdx];
                let newVal = prevVal;

                if (Math.abs(prevVal) < 1e-8) {
                    const sign = (!signAbsorbed && Math.sign(neededProductForMutables) < 0) ? -1 : 1;
                    if (sign < 0) signAbsorbed = true;
                    newVal = Math.pow(Math.abs(neededProductForMutables / (nonZerosProduct || 1)), 1 / (zeros || 1)) * sign;
                } else {
                    const currentMutablesProduct = mutableChildren.reduce((acc: number, cid: string) => acc * results[cid][monthIdx], 1);
                    const ratio = currentMutablesProduct !== 0 ? neededProductForMutables / currentMutablesProduct : neededProductForMutables;
                    const magnitude = Math.pow(Math.abs(ratio), 1 / mutableChildren.length);
                    const sign = (!signAbsorbed && Math.sign(ratio) < 0) ? -1 : 1;
                    if (sign < 0) signAbsorbed = true;
                    newVal = prevVal * magnitude * sign;
                }

                if (Math.abs(newVal - prevVal) > 1e-9) {
                    results[childId][monthIdx] = newVal;
                    impactedKpis.add(childId);
                    distributeTopDown(childId, monthIdx, newVal);
                }
            });
        } else if (kpi.formula === 'AVERAGE') {
            const totalTargetForChildren = targetValue * kpi.children.length;
            const fixedSum = kpi.children
                .filter(cid => !mutableChildren.includes(cid))
                .reduce((acc: number, cid: string) => acc + results[cid][monthIdx], 0);

            const neededSumForMutables = totalTargetForChildren - fixedSum;
            const currentMutableSum = mutableChildren.reduce((acc: number, cid: string) => acc + results[cid][monthIdx], 0);
            const diff = (neededSumForMutables - currentMutableSum) / mutableChildren.length;

            mutableChildren.forEach(childId => {
                const prevVal = results[childId][monthIdx];
                const newVal = prevVal + diff;
                if (Math.abs(newVal - prevVal) > 1e-9) {
                    results[childId][monthIdx] = newVal;
                    impactedKpis.add(childId);
                    distributeTopDown(childId, monthIdx, newVal);
                }
            });
        } else {
            const fixedSum = kpi.children
                .filter(cid => !mutableChildren.includes(cid))
                .reduce((acc: number, cid: string) => acc + results[cid][monthIdx], 0);

            const neededSumForMutables = targetValue - fixedSum;
            const currentMutableSum = mutableChildren.reduce((acc: number, cid: string) => acc + results[cid][monthIdx], 0);

            if (Math.abs(currentMutableSum) < 1e-8) {
                const addDiff = neededSumForMutables / mutableChildren.length;
                mutableChildren.forEach(childId => {
                    const prevVal = results[childId][monthIdx];
                    const newVal = prevVal + addDiff;
                    results[childId][monthIdx] = newVal;
                    impactedKpis.add(childId);
                    distributeTopDown(childId, monthIdx, newVal);
                });
            } else {
                const ratio = neededSumForMutables / currentMutableSum;
                mutableChildren.forEach(childId => {
                    const prevVal = results[childId][monthIdx];
                    const newVal = prevVal * ratio;
                    results[childId][monthIdx] = newVal;
                    impactedKpis.add(childId);
                    distributeTopDown(childId, monthIdx, newVal);
                });
            }
        }
    };

    const computeNode = (id: string) => {
        const kpi = kpis[id];
        if (!kpi) return;

        kpi.children.forEach(computeNode);
        const preOverrideValues = [...results[id]];

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
                impactedKpis.add(id);
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

                if (Math.abs(results[id][m] - preOverrideValues[m]) > 1e-9) {
                    impactedKpis.add(id);
                }
            }
        }

        if (kpi.fullYearOverride !== undefined && kpi.fullYearOverride !== null) {
            const currentTotal = results[id].slice(0, periodCount).reduce((a, b) => a + b, 0);
            if (Math.abs(currentTotal - kpi.fullYearOverride) > 0.01) {
                impactedKpis.add(id);
                const mutableMonths: number[] = [];
                for (let m = 0; m < periodCount; m++) {
                    if (!monthlyOverridesSet.has(`${id}-${m}`)) mutableMonths.push(m);
                }

                if (mutableMonths.length > 0) {
                    const currentMutableSum = mutableMonths.reduce((acc, m) => acc + results[id][m], 0);
                    const currentFixedSum = currentTotal - currentMutableSum;
                    const neededMutableSum = kpi.fullYearOverride - currentFixedSum;

                    if (Math.abs(currentMutableSum) < 1e-8) {
                        const diff = neededMutableSum / mutableMonths.length;
                        mutableMonths.forEach(m => { results[id][m] += diff; });
                    } else {
                        const ratio = neededMutableSum / currentMutableSum;
                        mutableMonths.forEach(m => { results[id][m] *= ratio; });
                    }
                }
            }
        }

        for (let m = 0; m < periodCount; m++) {
            if (Math.abs(results[id][m] - preOverrideValues[m]) > 1e-9) {
                distributeTopDown(id, m, results[id][m]);
            }
        }
    };

    Object.keys(kpis).forEach(id => {
        if (!kpis[id].parentId) computeNode(id);
    });

    Object.keys(results).forEach(id => {
        results[id][periodCount] = results[id].slice(0, periodCount).reduce((a, b) => a + b, 0);
    });

    return { results, impactedKpis };
};

export const calculateValues = calculateAllValues;
