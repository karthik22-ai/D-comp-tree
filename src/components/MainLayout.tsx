import React from 'react';
import Header from './Header';
import type { DateRange } from '../types';

interface MainLayoutProps {
    children: React.ReactNode;
    onReset: () => void;
    onForecast: () => void;
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    onUploadData: (file: File) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, onReset, onForecast, dateRange, onDateRangeChange, onUploadData }) => {
    return (
        <div className="main-layout">
            <Header onReset={onReset} onForecast={onForecast} dateRange={dateRange} onDateRangeChange={onDateRangeChange} onUploadData={onUploadData} />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
