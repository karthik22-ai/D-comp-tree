import React, { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Share2, Calendar, RefreshCcw, TrendingUp, Upload, ArrowLeft } from 'lucide-react';
import type { DateRange } from '../types';

interface HeaderProps {
    onReset: () => void;
    onForecast: () => void;
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    onUploadData: (file: File) => void;
    onBack?: () => void;
    isSyncEnabled?: boolean;
    onSyncToggle?: () => void;
    valueDisplayType: 'absolute' | 'variance';
    onValueDisplayTypeChange: (type: 'absolute' | 'variance') => void;
}

const Header: React.FC<HeaderProps> = ({ onReset, onForecast, dateRange, onDateRangeChange, onUploadData, onBack, isSyncEnabled, onSyncToggle, valueDisplayType, onValueDisplayTypeChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUploadData(e.target.files[0]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    return (
        <header className="app-header">
            <div className="header-left">
                {onBack && (
                    <button
                        onClick={onBack}
                        style={{
                            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px',
                            marginRight: 12
                        }}
                        title="Back to Projects"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="logo-section">
                    <Share2 className="logo-icon" size={20} />
                    <span className="logo-text">Strategic Forecast</span>
                </div>
                <nav className="header-nav">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Tree View
                    </NavLink>
                    <NavLink to="/tabular" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Tabular View
                    </NavLink>
                    <NavLink to="/compare" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Compare
                    </NavLink>
                    <NavLink to="/log" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Activity Log
                    </NavLink>
                </nav>
            </div>

            <div className="header-center">
                <div className="date-picker-bar">
                    <Calendar size={14} className="calendar-icon" />
                    <span className="date-label">From:</span>
                    <select
                        className="date-select"
                        value={dateRange.startMonth}
                        onChange={(e) => onDateRangeChange({ ...dateRange, startMonth: parseInt(e.target.value) })}
                    >
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <input
                        type="number"
                        className="date-select year-input"
                        value={dateRange.startYear}
                        onChange={(e) => onDateRangeChange({ ...dateRange, startYear: parseInt(e.target.value) || new Date().getFullYear() })}
                        style={{ width: '60px', marginLeft: '4px' }}
                    />

                    <span className="date-label" style={{ marginLeft: '12px' }}>To:</span>
                    <select
                        className="date-select"
                        value={dateRange.endMonth}
                        onChange={(e) => onDateRangeChange({ ...dateRange, endMonth: parseInt(e.target.value) })}
                    >
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <input
                        type="number"
                        className="date-select year-input"
                        value={dateRange.endYear}
                        onChange={(e) => onDateRangeChange({ ...dateRange, endYear: parseInt(e.target.value) || new Date().getFullYear() })}
                        style={{ width: '60px', marginLeft: '4px' }}
                    />
                </div>
            </div>

            <div className="header-right">

                {onSyncToggle && (
                    <button 
                        className={`header-btn secondary sync-btn ${isSyncEnabled ? 'active' : ''}`} 
                        onClick={onSyncToggle}
                        title={isSyncEnabled ? "Sync is ON" : "Sync is OFF"}
                    >
                        <RefreshCcw size={16} className={isSyncEnabled ? 'spin-slow' : ''} />
                        <span>{isSyncEnabled ? 'SYNC' : 'SYNC OFF'}</span>
                    </button>
                )}

                <div className="value-type-selector">
                    <select 
                        className="header-select"
                        value={valueDisplayType}
                        onChange={(e) => onValueDisplayTypeChange(e.target.value as 'absolute' | 'variance')}
                    >
                        <option value="absolute">Absolute Value</option>
                        <option value="variance">Variance Value</option>
                    </select>
                </div>
                <button className="header-btn secondary" onClick={() => fileInputRef.current?.click()} title="Upload Data Model (JSON/Excel)">
                    <Upload size={16} /> <span>Upload Data</span>
                </button>
                <input
                    type="file"
                    accept=".json,.csv,.xlsx,.xls"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                <div className="header-actions-group">
                    <button className="header-btn forecast-btn" onClick={onForecast} title="Generate Forecast">
                        <TrendingUp size={14} /> <span>Forecast</span>
                    </button>
                    <button className="header-btn reset-btn" onClick={onReset} title="Reset Simulation">
                        <RefreshCcw size={14} /> <span>Reset</span>
                    </button>
                </div>
                <div className="user-profile">
                    <div className="avatar">JD</div>
                </div>
            </div>
        </header>
    );
};

export default Header;
