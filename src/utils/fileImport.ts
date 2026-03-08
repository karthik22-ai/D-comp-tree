import * as XLSX from 'xlsx';
import type { KPIData } from '../types';

export const parseFileToKPIs = async (file: File, monthsCount: number = 12): Promise<Record<string, KPIData>> => {
    return new Promise((resolve, reject) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                let rows: any[][] = [];
                if (isExcel) {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, raw: true });
                } else {
                    const text = e.target?.result as string;
                    if (!text) return resolve({});

                    const lines = text.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (!line.trim()) continue;

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
                        rows.push(currentRow);
                    }
                }

                const newKpis: Record<string, KPIData> = {};
                const stack: { id: string, indent: number }[] = [];

                const extractNumber = (val: any): number | undefined => {
                    if (val === undefined || val === null || val === '') return undefined;
                    if (typeof val === 'number') return isNaN(val) ? undefined : val;

                    let s = String(val).trim();
                    if (s.startsWith('(') && s.endsWith(')')) {
                        s = '-' + s.substring(1, s.length - 1);
                    }
                    s = s.replace(/[^0-9.\-eE]/g, '');
                    const num = parseFloat(s);
                    return isNaN(num) ? undefined : num;
                };

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length < 2) continue;

                    const rawLabel = String(row[0] || '');
                    if (!rawLabel.trim()) continue;

                    const leadingSpacesMatch = rawLabel.match(/^(\s*)/);
                    const spaces = leadingSpacesMatch ? leadingSpacesMatch[1].length : 0;
                    const indentLevel = Math.floor(spaces / 2);
                    const label = rawLabel.trim().replace(/^\[-\]\s*/, '').replace(/^\[\+\]\s*/, '');

                    const unit = String(row[1] || '').trim();
                    const id = `custom_${Date.now()}_${i}`;

                    while (stack.length > 0 && stack[stack.length - 1].indent >= indentLevel) {
                        stack.pop();
                    }

                    const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;

                    const newNode: KPIData = {
                        id,
                        label,
                        unit: unit || '$',
                        color: '#cbd5e1',
                        parentId,
                        children: [],
                        data: [],
                        formula: 'NONE',
                        simulationValue: 0,
                        simulationType: 'PERCENT',
                        isExpanded: true,
                        monthlyOverrides: [],
                        fullYearOverride: undefined
                    };

                    for (let m = 0; m < monthsCount; m++) {
                        const valRaw = row[2 + m];
                        if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
                            if (typeof valRaw === 'string' && valRaw.startsWith('=')) {
                                newNode.monthlyOverrides![m] = valRaw;
                            } else {
                                const num = extractNumber(valRaw);
                                if (num !== undefined) newNode.monthlyOverrides![m] = num;
                            }
                        }
                    }

                    const fyStr = row[2 + monthsCount];
                    const fyNum = extractNumber(fyStr);
                    if (fyNum !== undefined) newNode.fullYearOverride = fyNum;

                    newKpis[id] = newNode;

                    if (parentId && newKpis[parentId]) {
                        newKpis[parentId].children.push(id);
                    }

                    stack.push({ id, indent: indentLevel });
                }

                resolve(newKpis);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
};
