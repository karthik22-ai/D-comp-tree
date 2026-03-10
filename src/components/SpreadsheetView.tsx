import React, { useMemo, useState, useRef, useCallback } from 'react';
import type { KPIData, Scenario, DateRange } from '../types';
import { Save, Layers, Database, Calculator, Download, Upload, Lock, Unlock, Plus } from 'lucide-react';
import { getMonthsInRange } from '../utils/dateRange';
import { parseFileToKPIs } from '../utils/fileImport';
import * as XLSX from 'xlsx';

interface SpreadsheetViewProps {
    kpis: Record<string, KPIData>;
    calculatedValues: Record<string, number[]>;
    onMonthlyOverrideChange: (id: string, monthIdx: number, value: string | number | undefined) => void;
    onFullYearOverrideChange: (id: string, value: number | undefined) => void;
    scenarios: Record<string, Scenario>;
    activeScenarioId: string;
    onScenarioSelect: (id: string) => void;
    onScenarioAdd: (name: string) => void;
    onToggleExpand?: (id: string) => void;
    onExpandAll?: () => void;
    onCollapseAll?: () => void;
    onCustomDataImport?: (kpis: Record<string, KPIData>) => void;
    onRowLockToggle?: (id: string) => void;
    onCellLockToggle?: (id: string, monthIdx: number) => void;
    onColumnLockChange?: (idx: number) => void;
    dateRange: DateRange;
    onDateRangeChange?: (range: DateRange) => void;
}

// Format a number for display
const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
    kpis,
    calculatedValues,
    onMonthlyOverrideChange,
    onFullYearOverrideChange,
    scenarios,
    activeScenarioId,
    onScenarioSelect,
    onScenarioAdd,
    onToggleExpand,
    onExpandAll,
    onCollapseAll,
    onCustomDataImport,
    onRowLockToggle,
    onCellLockToggle: _onCellLockToggle,
    onColumnLockChange: _onColumnLockChange,
    dateRange,
    onDateRangeChange
}) => {
    const monthObjects = useMemo(() => getMonthsInRange(dateRange.startMonth, dateRange.startYear, dateRange.endMonth, dateRange.endYear), [dateRange]);
    const months = useMemo(() => monthObjects.map(m => m.label), [monthObjects]);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [showAddScenario, setShowAddScenario] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Editing state: track which cell is actively being edited ---
    const [editingCell, setEditingCell] = useState<{ kpiId: string; monthIdx: number | 'total' } | null>(null);
    const [editText, setEditText] = useState('');

    // --- Drag-to-fill state (2D: both row and column) ---
    const [isDragging, setIsDragging] = useState(false);
    const [dragSource, setDragSource] = useState<{ kpiId: string; monthIdx: number } | null>(null);
    const [dragTarget, setDragTarget] = useState<{ kpiId: string; monthIdx: number } | null>(null);

    const kpiList = useMemo(() => {
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
    }, [kpis]);

    // Build a flat list of visible kpi IDs for row index lookup
    const visibleKpiIds = useMemo(() => kpiList.map(item => item.kpi.id), [kpiList]);

    // --- Cell display value helper ---
    const getCellDisplayValue = (kpiId: string, monthIdx: number): string => {
        const kpi = kpis[kpiId];
        const override = kpi?.monthlyOverrides?.[monthIdx];
        if (override != null) {
            return typeof override === 'number' ? fmt(override) : String(override);
        }
        return fmt(calculatedValues[kpiId]?.[monthIdx] ?? 0);
    };

    const getFullYearDisplayValue = (kpiId: string): string => {
        const kpi = kpis[kpiId];
        if (kpi?.fullYearOverride != null) {
            return fmt(kpi.fullYearOverride);
        }
        return fmt(calculatedValues[kpiId]?.[months.length] ?? 0);
    };

    // --- Cell edit handlers ---
    const handleCellFocus = (kpiId: string, monthIdx: number | 'total') => {
        if (monthIdx === 'total') {
            const kpi = kpis[kpiId];
            const raw = kpi?.fullYearOverride != null
                ? kpi.fullYearOverride
                : (calculatedValues[kpiId]?.[months.length] ?? 0);
            setEditText(String(raw));
        } else {
            const kpi = kpis[kpiId];
            const override = kpi?.monthlyOverrides?.[monthIdx];
            if (override != null) {
                setEditText(typeof override === 'number' ? String(override) : String(override));
            } else {
                setEditText(String(calculatedValues[kpiId]?.[monthIdx] ?? 0));
            }
        }
        setEditingCell({ kpiId, monthIdx });
    };

    const handleCellBlur = (kpiId: string, monthIdx: number | 'total') => {
        setEditingCell(null);
        const value = editText.trim();

        if (monthIdx === 'total') {
            if (!value) {
                onFullYearOverrideChange(kpiId, undefined);
            } else {
                const num = parseFloat(value.replace(/,/g, '').replace(/"/g, ''));
                if (!isNaN(num)) onFullYearOverrideChange(kpiId, num);
            }
        } else {
            if (!value) {
                onMonthlyOverrideChange(kpiId, monthIdx, undefined);
            } else if (value.startsWith('=')) {
                onMonthlyOverrideChange(kpiId, monthIdx, value);
            } else {
                const num = parseFloat(value.replace(/,/g, '').replace(/"/g, ''));
                if (!isNaN(num)) onMonthlyOverrideChange(kpiId, monthIdx, num);
            }
        }
    };

    const handleCellKeyDown = (e: React.KeyboardEvent, _kpiId: string, _monthIdx: number | 'total') => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        } else if (e.key === 'Tab') {
            // Allow natural tab behavior
        }
    };

    const handleAddScenario = () => {
        if (newScenarioName.trim()) {
            onScenarioAdd(newScenarioName.trim());
            setNewScenarioName('');
            setShowAddScenario(false);
        }
    };

    const handleExportData = () => {
        const headerRow = ['KPI Name', 'Unit', ...months, 'Full Year'];
        const aoa: any[][] = [headerRow];

        kpiList.forEach(({ kpi, depth }) => {
            const indent = ' '.repeat(depth * 2);
            const monthlyValues = months.map((_, idx) => {
                const override = kpi.monthlyOverrides?.[idx];
                if (override !== undefined) return override;
                return calculatedValues[kpi.id]?.[idx] ?? 0;
            });
            const fullYearValue = kpi.fullYearOverride !== undefined
                ? kpi.fullYearOverride
                : (calculatedValues[kpi.id]?.[months.length] ?? 0);

            aoa.push([
                `${indent}${kpi.label}`,
                kpi.unit,
                ...monthlyValues,
                fullYearValue
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Spreadsheet");
        XLSX.writeFile(wb, `${scenarios[activeScenarioId]?.name || 'Scenario'}_export.xlsx`);
    };

    const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const newKpis = await parseFileToKPIs(file, months.length);
            if (onCustomDataImport && Object.keys(newKpis).length > 0) {
                onCustomDataImport(newKpis);
            }
        } catch (err) {
            console.error('Failed to parse file', err);
            alert('Failed to parse file.');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- 2D Drag-to-Fill Logic ---
    const handleFillHandleMouseDown = useCallback((kpiId: string, monthIdx: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragSource({ kpiId, monthIdx });
        setDragTarget({ kpiId, monthIdx });
    }, []);

    const handleCellMouseEnter = useCallback((kpiId: string, monthIdx: number) => {
        if (isDragging && dragSource) {
            setDragTarget({ kpiId, monthIdx });
        }
    }, [isDragging, dragSource]);

    const handleMouseUp = useCallback(() => {
        if (isDragging && dragSource && dragTarget) {
            const { kpiId: srcKpiId, monthIdx: srcMonthIdx } = dragSource;
            const { kpiId: tgtKpiId, monthIdx: tgtMonthIdx } = dragTarget;

            // Get source value
            const srcKpi = kpis[srcKpiId];
            const srcOverride = srcKpi?.monthlyOverrides?.[srcMonthIdx];
            const sourceValue = srcOverride !== undefined ? srcOverride : (calculatedValues[srcKpiId]?.[srcMonthIdx] ?? 0);

            // Get row range
            const srcRowIdx = visibleKpiIds.indexOf(srcKpiId);
            const tgtRowIdx = visibleKpiIds.indexOf(tgtKpiId);
            const rowStart = Math.min(srcRowIdx, tgtRowIdx);
            const rowEnd = Math.max(srcRowIdx, tgtRowIdx);

            // Get column range
            const colStart = Math.min(srcMonthIdx, tgtMonthIdx);
            const colEnd = Math.max(srcMonthIdx, tgtMonthIdx);

            // Fill all cells in the rectangular selection
            for (let r = rowStart; r <= rowEnd; r++) {
                const targetKpiId = visibleKpiIds[r];
                if (!targetKpiId) continue;
                const targetKpi = kpis[targetKpiId];
                if (targetKpi?.isLocked) continue;

                for (let c = colStart; c <= colEnd; c++) {
                    // Skip the source cell
                    if (targetKpiId === srcKpiId && c === srcMonthIdx) continue;
                    if (targetKpi?.lockedMonths?.[c]) continue;
                    onMonthlyOverrideChange(targetKpiId, c, sourceValue);
                }
            }
        }
        setIsDragging(false);
        setDragSource(null);
        setDragTarget(null);
    }, [isDragging, dragSource, dragTarget, kpis, calculatedValues, onMonthlyOverrideChange, visibleKpiIds]);

    // --- Add Period Logic ---
    const handleAddPeriod = useCallback(() => {
        if (!onDateRangeChange) return;
        let newEndMonth = dateRange.endMonth + 1;
        let newEndYear = dateRange.endYear;
        if (newEndMonth > 11) {
            newEndMonth = 0;
            newEndYear++;
        }
        onDateRangeChange({
            ...dateRange,
            endMonth: newEndMonth,
            endYear: newEndYear
        });
    }, [dateRange, onDateRangeChange]);

    // Determine if a cell is in the 2D drag-fill rectangle
    const isDragSelected = (kpiId: string, monthIdx: number) => {
        if (!isDragging || !dragSource || !dragTarget) return false;

        const srcRowIdx = visibleKpiIds.indexOf(dragSource.kpiId);
        const tgtRowIdx = visibleKpiIds.indexOf(dragTarget.kpiId);
        const cellRowIdx = visibleKpiIds.indexOf(kpiId);

        const rowStart = Math.min(srcRowIdx, tgtRowIdx);
        const rowEnd = Math.max(srcRowIdx, tgtRowIdx);
        const colStart = Math.min(dragSource.monthIdx, dragTarget.monthIdx);
        const colEnd = Math.max(dragSource.monthIdx, dragTarget.monthIdx);

        return cellRowIdx >= rowStart && cellRowIdx <= rowEnd && monthIdx >= colStart && monthIdx <= colEnd;
    };

    return (
        <div className="spreadsheet-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="spreadsheet-toolbar">
                <div className="toolbar-left">
                    <Database size={18} className="toolbar-icon" />
                    <h2>Value Driver Grid</h2>
                </div>

                <div className="toolbar-right">
                    <div className="scenario-selector">
                        <Layers size={16} />
                        <span className="label">Scenario:</span>
                        <select
                            value={activeScenarioId}
                            onChange={(e) => onScenarioSelect(e.target.value)}
                            className="scenario-select"
                        >
                            {Object.values(scenarios).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px' }} />

                    {onExpandAll && (
                        <button className="toolbar-btn secondary" onClick={onExpandAll} title="Expand All Rows">
                            <span>Expand All</span>
                        </button>
                    )}
                    {onCollapseAll && (
                        <button className="toolbar-btn secondary" onClick={onCollapseAll} title="Collapse All Rows">
                            <span>Collapse All</span>
                        </button>
                    )}

                    <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px' }} />

                    <button className="toolbar-btn secondary" onClick={() => fileInputRef.current?.click()} title="Import Data">
                        <Upload size={14} /> <span>Import</span>
                    </button>
                    <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImportCSV}
                    />

                    <button className="toolbar-btn secondary" onClick={handleExportData} title="Export to Excel">
                        <Download size={14} /> <span>Export</span>
                    </button>

                    {!showAddScenario ? (
                        <button className="toolbar-btn secondary" onClick={() => setShowAddScenario(true)}>
                            <Save size={14} /> <span>Save As...</span>
                        </button>
                    ) : (
                        <div className="add-scenario-popover">
                            <input
                                autoFocus
                                value={newScenarioName}
                                onChange={(e) => setNewScenarioName(e.target.value)}
                                placeholder="Scenario Name"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddScenario()}
                            />
                            <button className="primary-btn sm" onClick={handleAddScenario}>Save</button>
                            <button className="ghost-btn sm" onClick={() => setShowAddScenario(false)}>Cancel</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="table-scroll" style={{ overflow: 'auto' }}>
                <table className="sheet-table" style={{ borderCollapse: 'separate', borderSpacing: 0, userSelect: isDragging ? 'none' : undefined }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                        <tr>
                            <th className="kpi-name-cell">KPI Name</th>
                            <th className="unit-column">Unit</th>
                            <th className="lock-column"><Lock size={14} /></th>
                            {months.map(m => <th key={m} className="month-column" style={{ borderBottom: '2px solid #cbd5e1' }}>{m}</th>)}
                            <th className="total-head month-column" style={{ borderBottom: '2px solid #cbd5e1' }}>Full Year</th>
                            {onDateRangeChange && (
                                <th style={{ borderBottom: '2px solid #cbd5e1', width: '40px', padding: 0 }}>
                                    <button
                                        className="add-period-btn"
                                        onClick={handleAddPeriod}
                                        title="Add next month column"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {kpiList.map(({ kpi, depth }) => {
                            const isEditing = (idx: number | 'total') =>
                                editingCell?.kpiId === kpi.id && editingCell?.monthIdx === idx;

                            return (
                                <tr key={kpi.id} className={kpi.children.length > 0 ? 'parent-row' : 'leaf-row'}>
                                    <td className="kpi-name-cell">
                                        <div className="label-wrapper" style={{ paddingLeft: `${depth * 24}px` }}>
                                            {kpi.children.length > 0 && (
                                                <span
                                                    className="row-expander cursor-pointer text-slate-400 hover:text-blue-500 transition-colors select-none"
                                                    onClick={() => onToggleExpand?.(kpi.id)}
                                                >
                                                    {kpi.isExpanded ? '▼' : '▶'}
                                                </span>
                                            )}
                                            {kpi.children.length > 0 && <Calculator size={14} className="calc-indicator" />}
                                            <span className={`kpi-label-text ${kpi.children.length > 0 ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                                                {kpi.label}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="unit-column"><span className="unit-badge">{kpi.unit}</span></td>
                                    <td className="lock-column">
                                        <button className="icon-btn-sm" onClick={() => onRowLockToggle?.(kpi.id)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                                            {kpi.isLocked ? <Lock size={14} className="text-red-500" /> : <Unlock size={14} className="text-slate-400" />}
                                        </button>
                                    </td>

                                    {/* Monthly cells */}
                                    {months.map((_, idx) => {
                                        const override = kpi.monthlyOverrides?.[idx];
                                        const isFormula = typeof override === 'string' && override.startsWith('=');
                                        const inDrag = isDragSelected(kpi.id, idx);
                                        const cellEditing = isEditing(idx);

                                        return (
                                            <td
                                                key={idx}
                                                className={`month-column ${override != null ? 'has-override' : ''} ${inDrag ? 'drag-selected' : ''}`}
                                                onMouseEnter={() => handleCellMouseEnter(kpi.id, idx)}
                                                style={{ position: 'relative' }}
                                            >
                                                <input
                                                    className={`sheet-cell-input ${isFormula ? 'formula-cell' : ''} ${kpi.children.length > 0 ? 'parent-val' : 'leaf-val'}`}
                                                    value={cellEditing ? editText : getCellDisplayValue(kpi.id, idx)}
                                                    onChange={(e) => cellEditing && setEditText(e.target.value)}
                                                    onFocus={() => handleCellFocus(kpi.id, idx)}
                                                    onBlur={() => handleCellBlur(kpi.id, idx)}
                                                    onKeyDown={(e) => handleCellKeyDown(e, kpi.id, idx)}
                                                    title={isFormula ? String(override) : undefined}
                                                    disabled={kpi.isLocked || kpi.lockedMonths?.[idx]}
                                                    readOnly={!cellEditing && !kpi.isLocked}
                                                />
                                                {/* Fill Handle */}
                                                {!kpi.isLocked && !kpi.lockedMonths?.[idx] && (
                                                    <div
                                                        className="fill-handle"
                                                        onMouseDown={(e) => handleFillHandleMouseDown(kpi.id, idx, e)}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}

                                    {/* Full Year cell */}
                                    <td className={`total-cell month-column ${kpi.fullYearOverride != null ? 'has-override' : ''}`}>
                                        <input
                                            className="sheet-cell-input total-input"
                                            value={isEditing('total') ? editText : getFullYearDisplayValue(kpi.id)}
                                            onChange={(e) => isEditing('total') && setEditText(e.target.value)}
                                            onFocus={() => handleCellFocus(kpi.id, 'total')}
                                            onBlur={() => handleCellBlur(kpi.id, 'total')}
                                            onKeyDown={(e) => handleCellKeyDown(e, kpi.id, 'total')}
                                            disabled={kpi.isLocked}
                                            readOnly={!isEditing('total') && !kpi.isLocked}
                                        />
                                    </td>
                                    {onDateRangeChange && <td style={{ width: '40px' }} />}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


export default SpreadsheetView;
