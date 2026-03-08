import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
    Plus,
    Settings,
    ChevronDown,
    TrendingUp,
    TrendingDown,
    RefreshCcw,
    User,
    Search
} from 'lucide-react';
import type { SemanticAttributes } from '../types';

const formatValue = (val: number) => {
    if (val === undefined || val === null) return '0';
    if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val.toFixed(0);
};

interface KPINodeProps {
    id: string;
    label: string;
    unit: string;
    formula: string;
    isExpanded: boolean;
    children: string[];
    simulationValue: number;
    simulationType: 'PERCENT' | 'ABSOLUTE';
    calculatedValue: number[];
    baselineData: number[];
    monthLabels: string[];
    isScenarioMode: boolean;
    color?: string;
    desiredTrend?: 'INCREASE' | 'DECREASE';
    fullYearOverride?: number;
    onToggleExpand: (id: string) => void;
    onSimulationChange: (id: string, value: number) => void;
    onSimulationTypeToggle: (id: string) => void;
    onFullYearOverrideChange: (id: string, value: number | undefined) => void;
    onAddChild: (id: string) => void;
    onSettings: (id: string) => void;
    onResetKPI: (id: string) => void;
    semantic?: SemanticAttributes;
}

const Sparkline = ({ values, baseline, labels, color = '#3b82f6', showScenario = true }: { values: number[], baseline: number[], labels: string[], color?: string, showScenario?: boolean }) => {
    if (!values || values.length === 0) return null;

    const periodCount = values.length - 1; // Exclude total
    const monthlyValues = values.slice(0, periodCount);
    const monthlyBaseline = baseline.slice(0, periodCount);
    const allPlotValues = [...monthlyValues, ...monthlyBaseline];
    const min = Math.min(...allPlotValues);
    const max = Math.max(...allPlotValues);
    const range = max - min || 1;
    const width = 200;
    const height = 45;

    const getPoints = (data: number[]) => data.map((v, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - ((v - min) / range) * height
    }));

    const baselinePoints = getPoints(monthlyBaseline);
    const scenarioPoints = getPoints(monthlyValues);

    const baselineD = `M ${baselinePoints.map(p => `${p.x},${p.y}`).join(' L ')}`;
    const scenarioD = `M ${scenarioPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;

    return (
        <div className="sparkline-wrapper">
            <svg width={width} height={height} className="sparkline-svg">
                {/* Baseline Guide */}
                <path d={baselineD} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 2" />

                {/* Scenario Path */}
                {showScenario && (
                    <path d={scenarioD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Interactive Points */}
                {labels.map((m, i) => (
                    <g key={`${m}-${i}`} className="spark-point-group">
                        <rect
                            x={(i / (labels.length - 1)) * width - 10}
                            y={0}
                            width={20}
                            height={height}
                            fill="transparent"
                        />
                        <circle
                            cx={(i / (labels.length - 1)) * width}
                            cy={height - ((monthlyValues[i] - min) / range) * height}
                            r="3"
                            className="spark-point"
                            fill={color}
                        />
                        <foreignObject x={(i / (labels.length - 1)) * width - 40} y={-30} width="80" height="25" className="spark-tooltip">
                            <div className="tooltip-content">
                                {m}: {monthlyValues[i]?.toLocaleString()}
                            </div>
                        </foreignObject>
                    </g>
                ))}
            </svg>
        </div>
    );
};

const KPINode = ({ data }: NodeProps<KPINodeProps>) => {
    const {
        id,
        label,
        unit,
        formula,
        isExpanded,
        simulationValue,
        simulationType,
        calculatedValue,
        baselineData,
        monthLabels,
        isScenarioMode,
        color,
        onToggleExpand,
        onAddChild,
        onSettings,
        onResetKPI,
        semantic // Added semantic to destructuring
    } = data;

    const periodCount = calculatedValue.length - 1;
    const currentVal = calculatedValue[periodCount] ?? 0;
    const baselineVal = baselineData[periodCount] ?? calculatedValue[periodCount] ?? 0;

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [editMode, setEditMode] = useState<'VALUE' | 'PERCENT'>('VALUE');
    const inputRef = useRef<HTMLInputElement>(null);

    // Variance is annual now
    const variance = ((currentVal - baselineVal) / (Math.abs(baselineVal) || 1)) * 100;

    const isPositiveImpact = data.desiredTrend === 'DECREASE' ? variance <= 0 : variance >= 0;
    const varianceClass = Math.abs(variance) < 0.01 ? 'neutral' : (isPositiveImpact ? 'pos' : 'neg');

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleEditStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isScenarioMode) return;
        // Default to VALUE mode, populate with the actual current full-year value
        setEditMode('VALUE');
        setEditValue(Math.round(currentVal).toString());
        setIsEditing(true);
    };

    const handleEditCommit = () => {
        setIsEditing(false);
        const num = parseFloat(editValue);
        if (isNaN(num)) return;

        if (editMode === 'PERCENT') {
            // % mode: apply as simulation percentage change
            if (simulationType !== 'PERCENT') {
                data.onSimulationTypeToggle(id);
            }
            data.onSimulationChange(id, num);
        } else {
            // VALUE mode: set the full year override to the exact number
            data.onFullYearOverrideChange(id, num);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditCommit();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    return (
        <div
            className={`kpi-node valq-style ${isExpanded ? 'expanded' : ''} ${simulationValue !== 0 || data.fullYearOverride !== undefined ? 'simulated' : ''}`}
            style={{ '--node-accent': color } as React.CSSProperties}
            onClick={() => onToggleExpand(id)}
        >
            <div className="node-category-strip" style={{ background: color }} />

            <Handle type="target" position={Position.Left} />

            <div className="node-main-content">
                <div className="node-top-row">
                    <span className="node-label">{label}</span>
                    <span className="node-formula">{formula !== 'NONE' ? formula : ''}</span>
                </div>

                {isEditing ? (
                    <div className="node-value-center editing" onClick={e => e.stopPropagation()}>
                        <div className="inline-editor-wrapper">
                            <input
                                ref={inputRef}
                                type="number"
                                className="inline-val-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleEditCommit}
                                onKeyDown={handleKeyDown}
                                placeholder="0"
                            />
                            <button
                                className="inline-type-toggle"
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur when clicking toggle
                                    setEditMode(prev => prev === 'PERCENT' ? 'VALUE' : 'PERCENT');
                                    // When switching modes, update the displayed value
                                    if (editMode === 'VALUE') {
                                        // Switching to %: clear the value so user can type percentage
                                        setEditValue('');
                                    } else {
                                        // Switching to VALUE: populate with current full-year value
                                        setEditValue(Math.round(currentVal).toString());
                                    }
                                }}
                            >
                                {editMode === 'PERCENT' ? '%' : unit}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className={`node-value-center ${isScenarioMode ? 'editable-hover' : ''}`}
                        onClick={handleEditStart}
                        title={isScenarioMode ? "Click to quick-edit simulation value" : undefined}
                    >
                        <span className="node-unit">{unit}</span>
                        <span className="node-value">{formatValue(currentVal)}</span>
                        <div className="node-trend-indicator" title="Annual variance vs Baseline">
                            {variance >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(variance).toFixed(1)}%
                        </div>
                    </div>
                )}

                <div className="node-footer">
                    <div className="footer-stat">
                        <span className="stat-label">Baseline</span>
                        <span className="stat-value">{formatValue(baselineVal)}</span>
                    </div>
                    {isScenarioMode && (
                        <div className={`footer-stat variance ${varianceClass}`}>
                            <span className="stat-label">Scenario Delta</span>
                            <span className="stat-value">
                                {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Actions */}
            <div className="card-controls" onClick={e => e.stopPropagation()}>
                {semantic?.businessOwner && (
                    <div className="semantic-pill owner" title={`Business Owner: ${semantic.businessOwner}`}>
                        <User size={10} /> {semantic.businessOwner.split(' ')[0]}
                    </div>
                )}
                {semantic?.dataSource && (
                    <div className="semantic-pill source" title={`Source: ${semantic.dataSource}`}>
                        <Search size={10} /> {semantic.dataSource}
                    </div>
                )}
                <div className="spacer" />
                <button className="icon-btn-sm" onClick={() => onSettings(id)}><Settings size={12} /></button>
                <button className="icon-btn-sm" onClick={() => onAddChild(id)}><Plus size={12} /></button>
                <button className="icon-btn-sm danger" onClick={() => onResetKPI(id)}><RefreshCcw size={12} /></button>
            </div>

            <div className="sparkline-mini">
                <Sparkline
                    values={isScenarioMode ? calculatedValue : baselineData}
                    baseline={baselineData}
                    labels={monthLabels}
                    color={color}
                    showScenario={isScenarioMode}
                />
            </div>

            {/* Monthly Values Mini-Bar */}
            <div className="node-monthly-bar">
                {monthLabels.map((m, i) => (
                    <div key={i} className="monthly-mini-cell" title={`${m}: ${(calculatedValue[i] ?? 0).toLocaleString()}`}>
                        <span className="mini-month">{m[0]}</span>
                        <span className="mini-val">{formatValue(calculatedValue[i] ?? 0)}</span>
                    </div>
                ))}
            </div>

            <div className="node-expansion-toggle" onClick={(e) => { e.stopPropagation(); onToggleExpand(id); }}>
                {isExpanded ? <ChevronDown size={14} /> : <div style={{ transform: 'rotate(-90deg)' }}><ChevronDown size={14} /></div>}
            </div>

            <Handle type="source" position={Position.Right} />
        </div>
    );
};

export default memo(KPINode);
