import React, { useState, useMemo } from 'react';
import type { Scenario, DateRange, KPIData } from '../types';
import { calculateValues } from '../utils/calc';
import { BarChart3 } from 'lucide-react';

interface ComparisonViewProps {
    scenarios: Record<string, Scenario>;
    dateRange: DateRange;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ scenarios, dateRange }) => {
    const scenarioKeys = Object.keys(scenarios);
    const [baseId, setBaseId] = useState<string>(scenarioKeys[0] || '');
    const [compId, setCompId] = useState<string>(scenarioKeys.length > 1 ? scenarioKeys[1] : scenarioKeys[0] || '');

    const baseData = scenarios[baseId];
    const compData = scenarios[compId];

    const baseCalculated = useMemo(() => {
        if (!baseData) return {};
        return calculateValues(baseData.kpis, dateRange).results;
    }, [baseData, dateRange]);

    const compCalculated = useMemo(() => {
        if (!compData) return {};
        return calculateValues(compData.kpis, dateRange).results;
    }, [compData, dateRange]);

    const kpiList = useMemo(() => {
        if (!baseData) return [];
        const kpis = baseData.kpis;
        const roots = Object.values(kpis).filter(k => !k.parentId);
        const ordered: { kpi: KPIData, depth: number }[] = [];

        const traverse = (node: KPIData, depth: number) => {
            ordered.push({ kpi: node, depth });
            if (node.isExpanded) {
                node.children.forEach(childId => {
                    if (kpis[childId]) traverse(kpis[childId], depth + 1);
                });
            }
        };

        roots.forEach(root => traverse(root, 0));
        return ordered;
    }, [baseData]);

    const periodCount = (dateRange.endYear - dateRange.startYear) * 12 + (dateRange.endMonth - dateRange.startMonth) + 1;

    return (
        <div className="flex flex-col h-full bg-white shadow-sm border border-slate-200 m-4 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-purple-500" />
                    <h2 className="font-semibold text-slate-800 m-0">Variance Analysis</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Base Scenario:</span>
                        <select
                            value={baseId}
                            onChange={(e) => setBaseId(e.target.value)}
                            className="bg-white border border-slate-300 rounded-md text-sm py-1 pl-2 pr-6 text-slate-700 outline-none focus:border-purple-500"
                        >
                            {Object.values(scenarios).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Comparison:</span>
                        <select
                            value={compId}
                            onChange={(e) => setCompId(e.target.value)}
                            className="bg-white border border-slate-300 rounded-md text-sm py-1 pl-2 pr-6 text-slate-700 outline-none focus:border-purple-500"
                        >
                            {Object.values(scenarios).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white p-2">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th className="sticky top-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 text-sm w-[300px]">KPI Name</th>
                            <th className="sticky top-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 text-sm min-w-[80px]">Unit</th>
                            <th className="sticky top-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 text-sm text-right min-w-[120px]">Base FY</th>
                            <th className="sticky top-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 text-sm text-right min-w-[120px]">Comp FY</th>
                            <th className="sticky top-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 text-sm text-right min-w-[120px]">Variance (Abs)</th>
                            <th className="sticky top-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 text-sm text-right min-w-[120px]">Variance (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kpiList.map(({ kpi, depth }) => {
                            const baseVal = baseCalculated[kpi.id]?.[periodCount] ?? 0;
                            const compVal = compCalculated[kpi.id]?.[periodCount] ?? 0;
                            const varianceAbs = compVal - baseVal;
                            const variancePct = baseVal !== 0 ? (varianceAbs / Math.abs(baseVal)) * 100 : 0;

                            const isPositive = varianceAbs > 0;
                            const isNegative = varianceAbs < 0;

                            return (
                                <tr key={kpi.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2">
                                        <div style={{ paddingLeft: `${depth * 20}px` }} className={`text-sm ${kpi.children.length > 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                            {kpi.label}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-500">
                                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{kpi.unit}</span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-medium text-slate-700">{baseVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                    <td className="px-4 py-2 text-sm text-right font-medium text-slate-700">{compVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                    <td className={`px-4 py-2 text-sm text-right font-semibold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-500'}`}>
                                        {varianceAbs > 0 ? '+' : ''}{varianceAbs.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                    <td className={`px-4 py-2 text-sm text-right font-semibold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-500'}`}>
                                        {varianceAbs > 0 ? '+' : ''}{variancePct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ComparisonView;
