import React, { useMemo, useState, useRef } from 'react';
import type { KPIData, Scenario, DateRange } from '../types';
import { Save, Layers, Database, Calculator, Download, Upload } from 'lucide-react';
import { getMonthsInRange } from '../utils/dateRange';
import * as XLSX from 'xlsx';

interface SpreadsheetViewProps {
    kpis: Record<string, KPIData>;
    calculatedValues: Record<string, number[]>;
    onMonthlyOverrideChange: (id: string, monthIdx: number, value: string | number) => void;
    onFullYearOverrideChange: (id: string, value: number) => void;
    scenarios: Record<string, Scenario>;
    activeScenarioId: string;
    onScenarioSelect: (id: string) => void;
    onScenarioAdd: (name: string) => void;
    onToggleExpand?: (id: string) => void;
    dateRange: DateRange;
}

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
    dateRange
}) => {
    const monthObjects = useMemo(() => getMonthsInRange(dateRange.startMonth, dateRange.startYear, dateRange.endMonth, dateRange.endYear), [dateRange]);
    const months = useMemo(() => monthObjects.map(m => m.label), [monthObjects]);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [showAddScenario, setShowAddScenario] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const kpiList = useMemo(() => {
        // Build a hierarchical ordered list
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

    const handleCellBlur = (id: string, monthIndex: number, value: string) => {
        if (value.startsWith('=')) {
            onMonthlyOverrideChange(id, monthIndex, value);
        } else {
            const num = parseFloat(value.replace(/,/g, ''));
            if (!isNaN(num)) {
                onMonthlyOverrideChange(id, monthIndex, num);
            }
        }
    };

    const handleFullYearBlur = (id: string, value: string) => {
        const num = parseFloat(value.replace(/,/g, ''));
        if (!isNaN(num)) {
            onFullYearOverrideChange(id, num);
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

    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const reader = new FileReader();

        reader.onload = (e) => {
            // Map KPI labels to IDs
            const labelToId: Record<string, string> = {};
            Object.values(kpis).forEach(kpi => {
                labelToId[kpi.label] = kpi.id;
            });

            if (isExcel) {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

                    for (let i = 1; i < rows.length; i++) {
                        const currentRow = rows[i];
                        if (!currentRow || currentRow.length < months.length + 2) continue;

                        const label = String(currentRow[0] || '').trim();
                        const id = labelToId[label];
                        if (!id) continue;

                        for (let m = 0; m < months.length; m++) {
                            const valRaw = currentRow[2 + m];
                            if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
                                const valStr = String(valRaw);
                                if (valStr.startsWith('=')) {
                                    onMonthlyOverrideChange(id, m, valStr);
                                } else {
                                    const num = parseFloat(valStr.replace(/,/g, ''));
                                    if (!isNaN(num)) onMonthlyOverrideChange(id, m, num);
                                }
                            }
                        }

                        const fyRaw = currentRow[2 + months.length];
                        if (fyRaw !== undefined && fyRaw !== null && fyRaw !== '') {
                            const fyStr = String(fyRaw);
                            const num = parseFloat(fyStr.replace(/,/g, ''));
                            if (!isNaN(num)) onFullYearOverrideChange(id, num);
                        }
                    }
                } catch (err) {
                    alert('Failed to parse Excel file.');
                }
            } else {
                const text = e.target?.result as string;
                if (!text) return;

                const lines = text.split('\n');
                if (lines.length < 2) return;

                // Start from line 1 to skip header
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // Parse CSV line handling potential quotes around KPI Name
                    let currentRow: string[] = [];
                    let currentWord = '';
                    let insideQuotes = false;

                    for (let char of line) {
                        if (char === '"') {
                            insideQuotes = !insideQuotes;
                        } else if (char === ',' && !insideQuotes) {
                            currentRow.push(currentWord);
                            currentWord = '';
                        } else {
                            currentWord += char;
                        }
                    }
                    currentRow.push(currentWord);

                    if (currentRow.length < months.length + 2) continue; // Not enough columns

                    const label = currentRow[0].trim();
                    const id = labelToId[label];
                    if (!id) continue;

                    // Process months
                    for (let m = 0; m < months.length; m++) {
                        const valStr = currentRow[2 + m];
                        if (valStr) {
                            if (valStr.startsWith('=')) {
                                onMonthlyOverrideChange(id, m, valStr);
                            } else {
                                const num = parseFloat(valStr.replace(/,/g, ''));
                                if (!isNaN(num)) onMonthlyOverrideChange(id, m, num);
                            }
                        }
                    }

                    // Process full year
                    const fyStr = currentRow[2 + months.length];
                    if (fyStr) {
                        const num = parseFloat(fyStr.replace(/,/g, ''));
                        if (!isNaN(num)) onFullYearOverrideChange(id, num);
                    }
                }
            }
        };

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="spreadsheet-container">
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

            <div className="table-scroll">
                <table className="sheet-table">
                    <thead>
                        <tr>
                            <th className="kpi-name-cell">KPI Name</th>
                            <th>Unit</th>
                            {months.map(m => <th key={m}>{m}</th>)}
                            <th className="total-head">Full Year</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kpiList.map(({ kpi, depth }) => (
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
                                <td><span className="unit-badge">{kpi.unit}</span></td>
                                {calculatedValues[kpi.id]?.slice(0, 12).map((val, idx) => {
                                    const override = kpi.monthlyOverrides?.[idx];
                                    const isFormula = typeof override === 'string' && override.startsWith('=');

                                    return (
                                        <td key={idx} className={override !== undefined ? 'has-override' : ''}>
                                            <input
                                                key={`cell-${kpi.id}-${idx}-${val}-${override}`}
                                                className={`sheet-cell-input ${isFormula ? 'formula-cell' : ''} ${kpi.children.length > 0 ? 'parent-val' : 'leaf-val'}`}
                                                defaultValue={override !== undefined ? override : (val ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 }).replace(/,/g, '')}
                                                onBlur={(e) => handleCellBlur(kpi.id, idx, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                }}
                                                title={isFormula ? override : undefined}
                                            />
                                        </td>
                                    );
                                })}
                                <td className={`total-cell ${kpi.fullYearOverride !== undefined ? 'has-override' : ''}`}>
                                    <input
                                        key={`total-${kpi.id}-${calculatedValues[kpi.id]?.[12]}-${kpi.fullYearOverride}`}
                                        className="sheet-cell-input total-input"
                                        defaultValue={kpi.fullYearOverride !== undefined ? kpi.fullYearOverride : (calculatedValues[kpi.id]?.[12] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 }).replace(/,/g, '')}
                                        onBlur={(e) => handleFullYearBlur(kpi.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        }}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


export default SpreadsheetView;
