export type FormulaType = 'SUM' | 'PRODUCT' | 'NONE' | 'AVERAGE' | 'CUSTOM';

export interface TimeSeriesValue {
  month: string;
  actual: number;
  forecast?: number;
  simulated?: number;
}

export interface SemanticAttributes {
  businessOwner?: string;
  dataSource?: string;
  lastUpdated?: string;
  tags?: string[];
}

export interface KPIData {
  id: string;
  label: string;
  data: TimeSeriesValue[];
  unit: string;
  formula: FormulaType;
  customFormula?: string;
  children: string[];
  parentId?: string;
  isExpanded: boolean;
  simulationValue?: number;
  simulationType?: 'PERCENT' | 'ABSOLUTE';
  color?: string;
  desiredTrend?: 'INCREASE' | 'DECREASE';
  semantic?: SemanticAttributes;
  monthlyOverrides?: (number | string | undefined)[]; // For Excel-like overrides or formulas
  fullYearOverride?: number; // Total year override
  isLocked?: boolean; // If true, inputs are disabled
  lockedMonths?: boolean[]; // Array matching months data, true if cell is locked
}

export interface Scenario {
  id: string;
  name: string;
  kpis: Record<string, KPIData>;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  lastAccessed: string;
  createdAt: string;
}

export interface DateRange {
  startMonth: number; // 0-11
  startYear: number;
  endMonth: number;   // 0-11
  endYear: number;
}

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string for better formatting
  action: string;
  details: string;
  oldValue?: string | number;
  newValue?: string | number;
  kpiId?: string;
  impactedKpis?: string[]; // IDs of KPIs that were recalculated
}

export interface AppState {
  scenarios: Record<string, Scenario>;
  activeScenarioId: string;
  dateRange: DateRange;
  activityLog: LogEntry[];
  lockMonthIdx?: number;
  isSyncEnabled: boolean;
  valueDisplayType?: 'absolute' | 'variance';
}

export interface SimulationState {
  kpis: Record<string, KPIData>;
  rootId: string;
}
