import { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Panel,
    useNodesState,
    useEdgesState,
    useReactFlow,
    type Connection,
    ReactFlowProvider
} from 'reactflow';
import type { Edge, Node } from 'reactflow';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import * as XLSX from 'xlsx';
import 'reactflow/dist/style.css';
import { Plus, X, Trash2, Layers, TrendingUp } from 'lucide-react';
import { generateForecast, type ForecastMethod } from '../utils/forecast';
import { initialKPIs } from '../data';
import { calculateValues } from '../utils/calc';
import { getMonthsInRange } from '../utils/dateRange';
import KPINode from './KPINode';
import MainLayout from './MainLayout';
import SpreadsheetView from './SpreadsheetView';
import LogView from './LogView';
import ComparisonView from './ComparisonView';
import { WelcomeScreen } from './WelcomeScreen';
import type { KPIData, FormulaType, AppState, Scenario, LogEntry } from '../types';
import dagre from 'dagre';

const nodeTypes = {
    kpiNode: KPINode,
};

const SimulationCanvasInner = ({
    kpis,
    setKpis,
    calculatedValues,
    baseValues,
    monthLabels,
    onToggleExpand,
    onSimulationChange,
    onSimulationTypeToggle,
    onAddChild,
    onSettings,
    onResetKPI,
    onFullYearOverrideChange,
    isScenarioMode,
    onAddRoot,
    scenarios,
    activeScenarioId,
    onScenarioSelect,
    onScenarioAdd,
    valueDisplayType
}: any) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { fitView } = useReactFlow();
    const [newScenarioName, setNewScenarioName] = useState('');
    const [showAddScenario, setShowAddScenario] = useState(false);

    const memoizedNodeTypes = useMemo(() => nodeTypes, []);

    const handleAddScenario = () => {
        if (newScenarioName.trim()) {
            onScenarioAdd(newScenarioName.trim());
            setNewScenarioName('');
            setShowAddScenario(false);
        }
    };

    useEffect(() => {
        if (fitView) fitView({ duration: 800, padding: 0.2 });
    }, [kpis, fitView]);

    const onConnect = useCallback((params: Connection) => {
        const { source, target } = params;
        if (!source || !target || source === target) return;

        setKpis((prev: any) => {
            const next = { ...prev };
            const oldParentId = next[target].parentId;
            if (oldParentId && next[oldParentId]) {
                next[oldParentId].children = next[oldParentId].children.filter((id: string) => id !== target);
            }
            next[source].children = [...new Set([...next[source].children, target])];
            next[target].parentId = source;
            return next;
        });
    }, [setKpis]);

    const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
        edgesToDelete.forEach(edge => {
            const source = edge.source;
            const target = edge.target;
            setKpis((prev: any) => {
                if (!prev[source] || !prev[target]) return prev;
                return {
                    ...prev,
                    [source]: { ...prev[source], children: prev[source].children.filter((id: string) => id !== target) },
                    [target]: { ...prev[target], parentId: undefined }
                };
            });
        });
    }, [setKpis]);

    useEffect(() => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));

        // Configuration for the tree layout
        const nodeWidth = 280;
        const nodeHeight = 300;
        dagreGraph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 });

        // Build edges and raw nodes only for visible items
        const rawNodes: Node[] = [];
        const newEdges: Edge[] = [];

        const roots = Object.values(kpis).filter((k: any) => !k.parentId);
        const visited = new Set<string>();

        const traverse = (kpi: any) => {
            if (visited.has(kpi.id)) return;
            visited.add(kpi.id);

            rawNodes.push({
                id: kpi.id,
                type: 'kpiNode',
                position: { x: 0, y: 0 },
                data: {
                    ...kpi,
                    onToggleExpand,
                    onSimulationChange,
                    onSimulationTypeToggle,
                    onAddChild,
                    onSettings,
                    onResetKPI,
                    onFullYearOverrideChange,
                    calculatedValue: calculatedValues[kpi.id] ?? [],
                    baselineData: baseValues[kpi.id] ?? [],
                    monthLabels,
                    isScenarioMode,
                    desiredTrend: kpi.desiredTrend,
                    valueDisplayType: valueDisplayType || 'absolute'
                }
            });

            // Set node in dagre graph
            dagreGraph.setNode(kpi.id, { width: nodeWidth, height: nodeHeight });

            if (kpi.isExpanded) {
                kpi.children.forEach((childId: string) => {
                    const child = kpis[childId];
                    if (child) {
                        newEdges.push({
                            id: `e-${kpi.id}-${childId}`,
                            source: kpi.id,
                            target: childId,
                            type: 'smoothstep',
                            animated: false,
                            style: { strokeWidth: 2, stroke: kpi.color || '#cbd5e1' }
                        });
                        // Set edge in dagre graph
                        dagreGraph.setEdge(kpi.id, childId);
                        traverse(child);
                    }
                });
            }
        };

        roots.forEach(root => traverse(root));

        // Compute layout
        dagre.layout(dagreGraph);

        // Apply coordinates
        const newNodes = rawNodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            if (nodeWithPosition) {
                // Adjust position so the top-left is correct for React Flow nodes
                node.position = {
                    x: nodeWithPosition.x - nodeWidth / 2,
                    y: nodeWithPosition.y - nodeHeight / 2,
                };
            }
            return node;
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [kpis, calculatedValues, baseValues, valueDisplayType, monthLabels, onToggleExpand, onSimulationChange, onSimulationTypeToggle, onFullYearOverrideChange, onAddChild, onSettings, onResetKPI, isScenarioMode, setNodes, setEdges]);

    return (
        <div className="canvas-wrapper">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgesDelete={onEdgesDelete}
                nodeTypes={memoizedNodeTypes}
                fitView
            >
                <Background />
                <Controls />
                <Panel position="top-right" className="canvas-panel">
                    <div className="scenario-controls-mini">
                        <Layers size={14} />
                        <select
                            value={activeScenarioId}
                            onChange={(e) => onScenarioSelect(e.target.value)}
                            className="scenario-select-mini"
                        >
                            {Object.values(scenarios as Record<string, Scenario>).map((s: Scenario) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        {!showAddScenario ? (
                            <button className="icon-btn-sm" onClick={() => setShowAddScenario(true)} title="Save As New Scenario">
                                <Plus size={14} />
                            </button>
                        ) : (
                            <div className="mini-popover">
                                <input
                                    autoFocus
                                    className="mini-input"
                                    value={newScenarioName}
                                    onChange={(e) => setNewScenarioName(e.target.value)}
                                    placeholder="New Scenario..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddScenario()}
                                />
                                <button className="mini-save-btn" onClick={handleAddScenario}>Save</button>
                            </div>
                        )}
                    </div>

                </Panel>
                <Panel position="top-left" className="canvas-panel">
                    <button className="add-root-btn" onClick={onAddRoot}>
                        <Plus size={16} /> Add Root KPI
                    </button>
                </Panel>
                <Panel position="bottom-right" className="header-panel horizontal">
                    <div className="toggle-group" title="Comparison Mode">
                        <button className={`toggle-btn-wide ${!isScenarioMode ? 'active' : ''}`} onClick={() => { }}>Actuals</button>
                        <button className={`toggle-btn-wide ${isScenarioMode ? 'active' : ''}`} onClick={() => { }}>Scenario</button>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
};

interface SimulationCanvasProps {
    projectId: string;
    isSampleMode: boolean;
    onBack: () => void;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ projectId, isSampleMode, onBack }) => {
    const months = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);

    const storageKey = `forecasting-app-state-v2-${projectId}`;

    const [appState, setAppState] = useState<AppState>(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (!parsed.dateRange) {
                    parsed.dateRange = {
                        startMonth: 0,
                        startYear: parsed.selectedYear || new Date().getFullYear(),
                        endMonth: 11,
                        endYear: parsed.selectedYear || new Date().getFullYear()
                    };
                }
                if (parsed.valueDisplayType === undefined) {
                    parsed.valueDisplayType = 'absolute';
                }
                return parsed as AppState;
            } catch (e) {
                console.warn('Failed to parse app state from local storage, falling back to default.');
            }
        }
        return {
            scenarios: {
                'base': { id: 'base', name: 'Base Scenario', kpis: isSampleMode ? initialKPIs : {}, createdAt: new Date().toISOString() }
            },
            activeScenarioId: 'base',
            dateRange: {
                startMonth: 0,
                startYear: new Date().getFullYear(),
                endMonth: 11,
                endYear: new Date().getFullYear()
            },
            activityLog: [],
            isSyncEnabled: true,
            valueDisplayType: 'absolute'
        };
    });

    const initialCalculatedValues = useMemo(() => {
        const activeScenario = appState.scenarios[appState.activeScenarioId];
        return calculateValues(activeScenario.kpis, appState.dateRange).results;
    }, []);

    const [treeCalculatedValues, setTreeCalculatedValues] = useState<Record<string, number[]>>(initialCalculatedValues);

    const logActivity = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        setAppState(prev => {
            const newLog: LogEntry = {
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                timestamp: new Date().toISOString(),
                ...entry
            };
            return {
                ...prev,
                activityLog: [newLog, ...(prev.activityLog || [])].slice(0, 100)
            };
        });
    }, []);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [isScenarioMode] = useState(true);
    const [showForecastModal, setShowForecastModal] = useState(false);
    const [forecastConfig, setForecastConfig] = useState<{ method: ForecastMethod, growthRate: number }>({ method: 'LINEAR_TREND', growthRate: 5 });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(appState));
        } catch (e) {
            console.warn('Local storage quota exceeded. The application state will not persist across reloads.');
        }
    }, [appState, storageKey]);

    const activeScenario = appState.scenarios[appState.activeScenarioId];
    const kpis = activeScenario.kpis;

    const setKpis = useCallback((updater: (prev: Record<string, KPIData>) => Record<string, KPIData>) => {
        setAppState(prev => {
            const activeId = prev.activeScenarioId;
            if (activeId === 'base') {
                const newId = `scenario-${Date.now()}`;
                const baseName = "Scenario";
                const existingCount = Object.values(prev.scenarios).filter(s => s.name.startsWith(baseName)).length;
                const newName = `${baseName} ${existingCount + 1}`;
                
                return {
                    ...prev,
                    scenarios: {
                        ...prev.scenarios,
                        [newId]: { 
                            id: newId, 
                            name: newName, 
                            kpis: updater(JSON.parse(JSON.stringify(prev.scenarios['base'].kpis))), 
                            createdAt: new Date().toISOString() 
                        }
                    },
                    activeScenarioId: newId
                };
            }
            
            return {
                ...prev,
                scenarios: {
                    ...prev.scenarios,
                    [activeId]: {
                        ...prev.scenarios[activeId],
                        kpis: updater(prev.scenarios[activeId].kpis)
                    }
                }
            };
        });
    }, []);

    const monthLabels = useMemo(() => {
        const monthsInRange = getMonthsInRange(
            appState.dateRange.startMonth,
            appState.dateRange.startYear,
            appState.dateRange.endMonth,
            appState.dateRange.endYear
        );
        return monthsInRange.map(m => m.label.split(' ')[0]); // Get 'Jan', 'Feb', etc.
    }, [appState.dateRange]);

    const baseValues = useMemo(() => calculateValues(appState.scenarios['base'].kpis, appState.dateRange).results, [appState.scenarios['base'].kpis, appState.dateRange]);
    const calculatedValues = useMemo(() => calculateValues(kpis, appState.dateRange).results, [kpis, appState.dateRange]);

    useEffect(() => {
        if (appState.isSyncEnabled) {
            setTreeCalculatedValues(calculatedValues);
        }
    }, [calculatedValues, appState.isSyncEnabled]);

    const onSyncToggle = useCallback(() => {
        setAppState(prev => ({ ...prev, isSyncEnabled: !prev.isSyncEnabled }));
    }, []);

    const onValueDisplayTypeChange = useCallback((type: 'absolute' | 'variance') => {
        setAppState(prev => ({ ...prev, valueDisplayType: type }));
    }, []);

    const onScenarioAdd = useCallback((name: string, snapshot?: Record<string, KPIData>) => {
        const id = `scenario-${Date.now()}`;
        setAppState(prev => ({
            ...prev,
            scenarios: {
                ...prev.scenarios,
                [id]: { id, name, kpis: snapshot ? JSON.parse(JSON.stringify(snapshot)) : JSON.parse(JSON.stringify(kpis)), createdAt: new Date().toISOString() }
            },
            activeScenarioId: id
        }));
    }, [kpis]);

    const onScenarioSelect = useCallback((id: string) => {
        setAppState(prev => ({ ...prev, activeScenarioId: id }));
    }, []);

    const handleToggleExpand = useCallback((id: string) => {
        setKpis(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                isExpanded: !prev[id].isExpanded
            }
        }));
    }, []);

    const handleExpandAll = useCallback(() => {
        setKpis(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                next[id] = { ...next[id], isExpanded: true };
            });
            return next;
        });
    }, []);

    const handleCollapseAll = useCallback(() => {
        setKpis(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                next[id] = { ...next[id], isExpanded: false };
            });
            return next;
        });
    }, []);

    const handleCustomDataImport = useCallback((newKpis: Record<string, KPIData>) => {
        setAppState(prev => {
            const activeId = prev.activeScenarioId;
            if (activeId === 'base') {
                const newId = `scenario-${Date.now()}`;
                const baseName = "Scenario";
                const existingCount = Object.values(prev.scenarios).filter(s => s.name.startsWith(baseName)).length;
                const newName = `${baseName} ${existingCount + 1}`;
                
                return {
                    ...prev,
                    scenarios: {
                        ...prev.scenarios,
                        [newId]: { id: newId, name: newName, kpis: newKpis, createdAt: new Date().toISOString() }
                    },
                    activeScenarioId: newId
                };
            }
            return {
                ...prev,
                scenarios: {
                    ...prev.scenarios,
                    [activeId]: {
                        ...prev.scenarios[activeId],
                        kpis: newKpis
                    }
                }
            };
        });
    }, []);

    const onSimulationChange = useCallback((id: string, value: number) => {
        const kpiName = kpis[id]?.label || id;
        const oldVal = kpis[id]?.simulationValue ?? 0;

        // Predetermine impact
        const nextKpis = { ...kpis, [id]: { ...kpis[id], simulationValue: value } };
        const { impactedKpis } = calculateValues(nextKpis, appState.dateRange);

        logActivity({
            action: 'Simulation Changed',
            details: `Adjusted simulation on "${kpiName}" to ${value}`,
            oldValue: oldVal,
            newValue: value,
            kpiId: id,
            impactedKpis: Array.from(impactedKpis)
        });

        setKpis(prev => ({
            ...prev,
            [id]: { ...prev[id], simulationValue: value }
        }));
    }, [setKpis, kpis, appState.dateRange, logActivity]);

    const onMonthlyOverrideChange = useCallback((id: string, monthIdx: number, value: number | string | undefined) => {
        const kpiName = kpis[id]?.label || id;
        // Use the actual displayed calculated value as old value, not raw data
        const oldVal = calculatedValues[id]?.[monthIdx] ?? 0;

        // Predetermine impact
        const kpi = kpis[id];
        const nextOverrides = [...(kpi?.monthlyOverrides || Array(12).fill(undefined))];
        nextOverrides[monthIdx] = value;
        const nextKpis = { ...kpis, [id]: { ...kpis[id], monthlyOverrides: nextOverrides, fullYearOverride: undefined } };
        const { impactedKpis } = calculateValues(nextKpis, appState.dateRange);

        logActivity({
            action: 'Monthly Override',
            details: `Override on "${kpiName}" for month index ${monthIdx}`,
            oldValue: oldVal,
            newValue: value,
            kpiId: id,
            impactedKpis: Array.from(impactedKpis)
        });

        setKpis(prev => {
            const kpi = prev[id];
            const overrides = [...(kpi.monthlyOverrides || Array(12).fill(undefined))];
            overrides[monthIdx] = value;
            return {
                ...prev,
                [id]: { ...prev[id], monthlyOverrides: overrides, fullYearOverride: undefined }
            };
        });
    }, [setKpis, kpis, calculatedValues, appState.dateRange, logActivity]);

    const onFullYearOverrideChange = useCallback((id: string, value: number | undefined) => {
        const kpiName = kpis[id]?.label || id;
        // Use the displayed total from calculated values as old value
        const months = calculatedValues[id]?.slice(0, -1) || [];
        const oldVal = kpis[id]?.fullYearOverride ?? months.reduce((a: number, b: number) => a + b, 0);

        const nextKpis = { ...kpis, [id]: { ...kpis[id], fullYearOverride: value } };
        const { impactedKpis } = calculateValues(nextKpis, appState.dateRange);

        logActivity({
            action: 'Full Year Override',
            details: `Full year override set to ${value} on "${kpiName}"`,
            oldValue: oldVal,
            newValue: value,
            kpiId: id,
            impactedKpis: Array.from(impactedKpis)
        });

        setKpis(prev => ({
            ...prev,
            [id]: { ...prev[id], fullYearOverride: value }
        }));
    }, [setKpis, kpis, appState.dateRange, logActivity]);

    const onSimulationTypeToggle = useCallback((id: string) => {
        setKpis(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                simulationType: prev[id].simulationType === 'PERCENT' ? 'ABSOLUTE' : 'PERCENT',
                simulationValue: 0
            }
        }));
    }, [setKpis]);

    const onAddChild = useCallback((parentId: string) => {
        const parent = kpis[parentId];
        const newId = `kpi-${Date.now()}`;
        const baseVal = parent?.formula === 'PRODUCT' ? 1 : 100;
        const newNode: KPIData = {
            id: newId,
            label: 'New Node',
            data: months.map(m => ({ month: m, actual: baseVal })),
            unit: parent?.unit || '',
            formula: 'NONE',
            children: [],
            parentId: parentId,
            isExpanded: false,
            simulationValue: 0,
            simulationType: 'PERCENT',
        };

        setKpis(prev => ({
            ...prev,
            [newId]: newNode,
            [parentId]: { ...prev[parentId], children: [...prev[parentId].children, newId], isExpanded: true }
        }));
    }, [kpis, months, setKpis]);

    const onAddRoot = useCallback(() => {
        const newId = `kpi-${Date.now()}`;
        const newNode: KPIData = {
            id: newId,
            label: 'New Root KPI',
            data: months.map(m => ({ month: m, actual: 1000 })),
            unit: '$',
            formula: 'NONE',
            children: [],
            isExpanded: false,
            simulationValue: 0,
            simulationType: 'PERCENT',
        };
        setKpis(prev => ({ ...prev, [newId]: newNode }));
    }, [months, setKpis]);

    const onRowLockToggle = useCallback((id: string) => {
        const kpiName = kpis[id]?.label || id;
        const willLock = !kpis[id]?.isLocked;
        logActivity({
            action: willLock ? 'Row Locked' : 'Row Unlocked',
            details: `${willLock ? 'Locked' : 'Unlocked'} all cells for "${kpiName}"`,
            kpiId: id
        });
        setKpis(prev => {
            const kpi = prev[id];
            if (willLock) {
                // Snapshot current calculated values as overrides so they persist after unlock
                const currentCalc = calculatedValues[id];
                const months = currentCalc ? currentCalc.slice(0, -1) : []; // exclude total
                const overrides = months.map((v: number, i: number) => kpi.monthlyOverrides?.[i] ?? v);
                return {
                    ...prev,
                    [id]: { ...kpi, isLocked: true, monthlyOverrides: overrides }
                };
            } else {
                // Unlock — keep the snapshotted overrides so values don't drift
                return {
                    ...prev,
                    [id]: { ...kpi, isLocked: false }
                };
            }
        });
    }, [setKpis, kpis, calculatedValues, logActivity]);

    const onCellLockToggle = useCallback((id: string, monthIdx: number) => {
        const kpiName = kpis[id]?.label || id;
        setKpis(prev => {
            const kpi = prev[id];
            const locks = [...(kpi.lockedMonths || Array(12).fill(false))];
            const isNowLocked = !locks[monthIdx];
            locks[monthIdx] = isNowLocked;

            logActivity({
                action: isNowLocked ? 'Cell Locked' : 'Cell Unlocked',
                details: `${isNowLocked ? 'Locked' : 'Unlocked'} month index ${monthIdx} for "${kpiName}"`,
                kpiId: id
            });

            // Snapshot this cell's value as an override so it persists
            if (isNowLocked) {
                const currentVal = calculatedValues[id]?.[monthIdx] ?? 0;
                const overrides = [...(kpi.monthlyOverrides || Array(12).fill(undefined))];
                if (overrides[monthIdx] === undefined) {
                    overrides[monthIdx] = currentVal;
                }
                return {
                    ...prev,
                    [id]: { ...kpi, lockedMonths: locks, monthlyOverrides: overrides }
                };
            }

            return {
                ...prev,
                [id]: { ...kpi, lockedMonths: locks }
            };
        });
    }, [setKpis, kpis, calculatedValues, logActivity]);

    const onColumnLockChange = useCallback((idx: number) => {
        logActivity({
            action: 'Column Locked',
            details: `Locked actuals up to month index ${idx}`
        });
        setAppState(prev => ({ ...prev, lockMonthIdx: idx }));
    }, [setAppState, logActivity]);

    const onSettings = useCallback((id: string) => {
        setEditingId(id);
    }, []);

    const onReset = useCallback(() => {
        logActivity({
            action: 'Reset Scenario',
            details: 'Cleared all overrides, simulations, and locks'
        });
        setKpis(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                next[id].simulationValue = 0;
                next[id].monthlyOverrides = undefined;
                next[id].fullYearOverride = undefined;
                next[id].isLocked = false;
                next[id].lockedMonths = undefined;
            });
            return next;
        });
    }, [setKpis, logActivity]);

    const onResetKPI = useCallback((id: string) => {
        const kpiName = kpis[id]?.label || id;
        logActivity({
            action: 'Reset KPI',
            details: `Cleared all overrides and locks for "${kpiName}"`,
            kpiId: id
        });
        setKpis(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                simulationValue: 0,
                monthlyOverrides: undefined,
                fullYearOverride: undefined,
                isLocked: false,
                lockedMonths: undefined
            }
        }));
    }, [setKpis, kpis, logActivity]);

    const onDeleteKPI = useCallback((id: string) => {
        if (!confirm('Delete this KPI and its entire branch?')) return;
        setKpis(prev => {
            const next = { ...prev };
            const toDelete = new Set<string>();
            const collect = (tid: string) => {
                toDelete.add(tid);
                next[tid].children.forEach(collect);
            };
            if (next[id]) collect(id);
            const pId = next[id]?.parentId;
            if (pId && next[pId]) {
                next[pId].children = next[pId].children.filter(i => i !== id);
            }
            toDelete.forEach(tid => delete next[tid]);
            return next;
        });
        setEditingId(null);
    }, [setKpis]);

    const onForecast = useCallback(() => {
        setKpis(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                const forecastedArray = generateForecast({
                    method: forecastConfig.method,
                    growthRate: forecastConfig.growthRate / 100, // percentage to decimal
                    periodsData: next[id].data, // Passing the full TimeSeriesData[]
                    forecastPeriods: 12 // Keeping 12 for now since dynamic range affects this later
                });

                next[id].data = forecastedArray.map((val, i) => ({
                    month: months[i % 12],
                    actual: val
                }));
            });
            return next;
        });
        setShowForecastModal(false);
    }, [setKpis, forecastConfig, months]);

    const handleUploadData = (file: File) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                let data: Record<string, KPIData> = {};

                if (isExcel) {
                    const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(buffer, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json<any>(firstSheet);

                    let lastAtDepth: Record<number, string> = {};
                    let kpiIndex = 0;

                    rows.forEach(row => {
                        const idCand = String(row.id || row.Id || row.ID || '');
                        if (idCand && idCand !== 'undefined') {
                            const id = idCand;
                            data[id] = {
                                id,
                                label: String(row.label || row.Label || id),
                                unit: String(row.unit || row.Unit || 'M'),
                                parentId: row.parentId || row.ParentId || null,
                                children: [],
                                formula: String(row.formula || row.Formula || 'SUM') as 'SUM' | 'AVERAGE' | 'CUSTOM',
                                data: [],
                                isExpanded: true,
                                simulationValue: parseFloat(row.simulationValue || row.SimulationValue || 0) || 0,
                                simulationType: (row.simulationType || row.SimulationType || 'PERCENT') as 'PERCENT' | 'ABSOLUTE',
                                desiredTrend: (row.desiredTrend || row.DesiredTrend || 'INCREASE') as 'INCREASE' | 'DECREASE',
                                monthlyOverrides: []
                            };

                            const moRaw = String(row.monthlyOverrides || row.MonthlyOverrides || '');
                            if (moRaw) {
                                const moArr = moRaw.split(',').map(s => {
                                    const trimmed = s.trim();
                                    if (trimmed === '') return undefined;
                                    if (trimmed.startsWith('=')) return trimmed;
                                    const n = parseFloat(trimmed);
                                    return isNaN(n) ? undefined : n;
                                });
                                data[id].monthlyOverrides = moArr;
                            }

                            const fyoRaw = row.fullYearOverride || row.FullYearOverride;
                            if (fyoRaw !== undefined) {
                                const fyoNum = parseFloat(fyoRaw);
                                if (!isNaN(fyoNum)) data[id].fullYearOverride = fyoNum;
                            }
                        } else {
                            // Support fallback format (e.g., from SpreadsheetView Export) or ANY generic file
                            const keys = Object.keys(row);
                            const firstCol = keys.length > 0 ? row[keys[0]] : undefined;
                            const kpiNameRaw = row['KPI Name'] || row.KPIName || row.kpiName || row.name || row.Name || row.label || row.Label || row['KPI label'] || firstCol;
                            if (kpiNameRaw) {
                                const rawStr = String(kpiNameRaw);
                                // The export indents with 2 spaces per depth level.
                                const spaces = rawStr.match(/^(\s*)/)?.[0].length || 0;
                                const depth = Math.floor(spaces / 2);
                                const cleanLabel = rawStr.trim();
                                const newId = `kpi-imported-${Date.now()}-${kpiIndex++}`;

                                let parentId: string | undefined = undefined;
                                if (depth > 0 && lastAtDepth[depth - 1]) {
                                    parentId = lastAtDepth[depth - 1];
                                }

                                data[newId] = {
                                    id: newId,
                                    label: cleanLabel,
                                    unit: String(row.Unit || row.unit || row.UNIT || 'M'),
                                    parentId,
                                    children: [],
                                    formula: 'SUM',
                                    data: [],
                                    isExpanded: true,
                                    simulationValue: parseFloat(row.simulationValue || row.SimulationValue || 0) || 0,
                                    simulationType: 'PERCENT',
                                    desiredTrend: 'INCREASE',
                                    monthlyOverrides: []
                                };

                                lastAtDepth[depth] = newId;
                            }
                        }
                    });

                    // Re-link children based on parentId
                    Object.values(data).forEach(kpi => {
                        if (kpi.parentId && data[kpi.parentId]) {
                            data[kpi.parentId].children.push(kpi.id);
                        }
                    });

                } else {
                    const text = e.target?.result as string;
                    data = JSON.parse(text);
                }

                if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                    setAppState(prev => ({
                        ...prev,
                        scenarios: {
                            'base': { id: 'base', name: 'Base Scenario', kpis: data, createdAt: new Date().toISOString() }
                        },
                        activeScenarioId: 'base'
                    }));
                } else {
                    alert('Parsed data model is empty or invalid.');
                }
            } catch (err) {
                alert('Invalid file format for Data Model. Please upload a valid JSON or Excel file.');
            }
        };

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    return (
        <BrowserRouter>
            <MainLayout
                onReset={onReset}
                onForecast={() => setShowForecastModal(true)}
                dateRange={appState.dateRange}
                onDateRangeChange={(range) => setAppState(prev => ({ ...prev, dateRange: range }))}
                onUploadData={handleUploadData}
                onBack={onBack}
                isSyncEnabled={appState.isSyncEnabled}
                onSyncToggle={onSyncToggle}
                valueDisplayType={appState.valueDisplayType}
                onValueDisplayTypeChange={onValueDisplayTypeChange}
            >
                {Object.keys(kpis).length === 0 ? (
                    <WelcomeScreen
                        onImportData={handleCustomDataImport}
                        onLoadSample={() => setKpis(() => initialKPIs)}
                        monthsCount={appState.dateRange.endMonth - appState.dateRange.startMonth + 1}
                    />
                ) : (
                    <Routes>
                        <Route path="/" element={
                            <ReactFlowProvider>
                                <SimulationCanvasInner
                                    kpis={kpis}
                                    setKpis={setKpis}
                                    calculatedValues={treeCalculatedValues}
                                    baseValues={baseValues}
                                    monthLabels={monthLabels}
                                    isSyncEnabled={appState.isSyncEnabled}
                                    onSyncToggle={onSyncToggle}
                                    onToggleExpand={handleToggleExpand}
                                    onSimulationChange={onSimulationChange}
                                    onSimulationTypeToggle={onSimulationTypeToggle}
                                    onAddChild={onAddChild}
                                    onSettings={onSettings}
                                    onResetKPI={onResetKPI}
                                    onFullYearOverrideChange={onFullYearOverrideChange}
                                    isScenarioMode={isScenarioMode}
                                    onAddRoot={onAddRoot}
                                    scenarios={appState.scenarios}
                                    activeScenarioId={appState.activeScenarioId}
                                    onScenarioSelect={onScenarioSelect}
                                    onScenarioAdd={onScenarioAdd}
                                    valueDisplayType={appState.valueDisplayType}
                                />
                            </ReactFlowProvider>
                        } />
                        <Route path="/tabular" element={
                            <SpreadsheetView
                                kpis={kpis}
                                calculatedValues={calculatedValues}
                                onMonthlyOverrideChange={onMonthlyOverrideChange}
                                onFullYearOverrideChange={onFullYearOverrideChange}
                                scenarios={appState.scenarios}
                                activeScenarioId={appState.activeScenarioId}
                                onScenarioSelect={onScenarioSelect}
                                onScenarioAdd={onScenarioAdd}
                                dateRange={appState.dateRange}
                                onToggleExpand={handleToggleExpand}
                                onExpandAll={handleExpandAll}
                                onCollapseAll={handleCollapseAll}
                                onCustomDataImport={handleCustomDataImport}
                                onRowLockToggle={onRowLockToggle}
                                onCellLockToggle={onCellLockToggle}
                                onColumnLockChange={onColumnLockChange}
                                onDateRangeChange={(range: any) => setAppState((prev: any) => ({ ...prev, dateRange: range }))}
                            />
                        } />
                        <Route path="/compare" element={<ComparisonView scenarios={appState.scenarios} dateRange={appState.dateRange} />} />
                        <Route path="/log" element={
                            <LogView
                                logs={appState.activityLog}
                                kpiNames={Object.fromEntries(Object.values(kpis).map(k => [k.id, k.label]))}
                            />
                        } />
                    </Routes>
                )}
            </MainLayout>

            {editingId && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>KPI Settings</h2>
                            <button className="close-btn" onClick={() => setEditingId(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Label</label>
                                <input
                                    value={kpis[editingId].label}
                                    onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], label: e.target.value } }))}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Unit</label>
                                    <input
                                        value={kpis[editingId].unit}
                                        onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], unit: e.target.value } }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Calculation Formula</label>
                                    <select
                                        value={kpis[editingId].formula}
                                        onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], formula: e.target.value as FormulaType } }))}
                                    >
                                        <option value="NONE">None (Leaf Node)</option>
                                        <option value="SUM">Sum of Children (+)</option>
                                        <option value="PRODUCT">Product of Children (×)</option>
                                        <option value="AVERAGE">Average of Children (avg)</option>
                                        <option value="CUSTOM">Semantic Formula (custom)</option>
                                    </select>
                                </div>
                            </div>
                            {kpis[editingId].formula === 'CUSTOM' && (
                                <div className="form-group">
                                    <label>Custom Logic (e.g. Revenue - TotalCosts)</label>
                                    <input
                                        value={kpis[editingId].customFormula || ''}
                                        placeholder="e.g. A - (B + C)"
                                        onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], customFormula: e.target.value } }))}
                                    />
                                </div>
                            )}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Business Owner</label>
                                    <input
                                        value={kpis[editingId].semantic?.businessOwner || ''}
                                        onChange={e => setKpis(prev => ({
                                            ...prev,
                                            [editingId]: {
                                                ...prev[editingId],
                                                semantic: { ...prev[editingId].semantic, businessOwner: e.target.value }
                                            }
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Data Source</label>
                                    <input
                                        value={kpis[editingId].semantic?.dataSource || ''}
                                        onChange={e => setKpis(prev => ({
                                            ...prev,
                                            [editingId]: {
                                                ...prev[editingId],
                                                semantic: { ...prev[editingId].semantic, dataSource: e.target.value }
                                            }
                                        }))}
                                    />
                                </div>
                            </div>

                        </div>
                        <div className="modal-footer">
                            <button className="danger-btn" onClick={() => onDeleteKPI(editingId)}>
                                <Trash2 size={16} /> Delete Branch
                            </button>
                            <button className="primary-btn" onClick={() => setEditingId(null)}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForecastModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Generate Scenario Forecast</h2>
                            <button className="close-btn" onClick={() => setShowForecastModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-slate-600 text-sm mb-4">Select an algorithmic method to project the next 12 months for this scenario based on historical actuals.</p>
                            <div className="form-group">
                                <label>Forecasting Method</label>
                                <select
                                    value={forecastConfig.method}
                                    onChange={e => setForecastConfig(prev => ({ ...prev, method: e.target.value as ForecastMethod }))}
                                >
                                    <option value="LINEAR_TREND">Linear Trend (Regression)</option>
                                    <option value="MOVING_AVERAGE">Moving Average (3-Period)</option>
                                    <option value="FLAT_GROWTH">Compound Growth (%)</option>
                                    <option value="SEASONAL_NAIVE">Seasonal Naive</option>
                                </select>
                            </div>
                            {forecastConfig.method === 'FLAT_GROWTH' && (
                                <div className="form-group">
                                    <label>Annual Growth Rate (%)</label>
                                    <input
                                        type="number"
                                        value={forecastConfig.growthRate}
                                        onChange={e => setForecastConfig(prev => ({ ...prev, growthRate: Number(e.target.value) }))}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="ghost-btn" onClick={() => setShowForecastModal(false)}>Cancel</button>
                            <button className="primary-btn flex-center gap-2" onClick={onForecast}>
                                <TrendingUp size={16} /> Execute Forecast
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </BrowserRouter>
    );
};

export default SimulationCanvas;
