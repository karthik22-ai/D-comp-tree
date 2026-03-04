# Forecasting Tool Documentation

Welcome to the interactive forecasting and data-modeling tool. This application allows users to build, visualize, simulate, and export complex hierarchical Key Performance Indicator (KPI) models. 

## 🚀 Tech Stack

The application is built using a modern, fast, and robust frontend stack:

- **React Function Components**: Core UI rendering and state management.
- **TypeScript**: Provides strong typing for predictable structures like `KPIData` and `AppState`.
- **Vite**: Ultra-fast build tool and development server.
- **React Flow**: A highly customizable library used for the interactive node-based canvas (the "Tree View").
- **Dagre**: A directed graph layout engine used to automatically position the React Flow nodes into a neat left-to-right hierarchical tree structure without manual dragging.
- **SheetJS (xlsx)**: A comprehensive spreadsheet library for parsing and exporting data to `.xlsx`, `.xls`, and `.csv`.
- **Lucide React**: Provides the clean, modern SVG icons used throughout the interface.
- **Tailwind-like Custom CSS**: The application primarily uses raw CSS (`index.css` and `App.css`) modeled after utility classes (e.g., `flex-center`, `gap-2`) alongside glassmorphism aesthetics.

## 📂 File Structure & Breakdown

### Configuration & Entry
- **`package.json`**: Lists dependencies (`reactflow`, `dagre`, `xlsx`, `lucide-react`, etc.) and runnable scipts.
- **`vite.config.ts`**: Configuration for the Vite bundler.
- **`src/main.tsx`**: The main React entry point that mounts the `App` component to the DOM.
- **`src/App.tsx`**: Renders the `SimulationCanvas`, wrapping the core app logic.

### Core Data & Types
- **`src/types.ts`**: Contains all the foundational TypeScript interfaces. This includes `KPIData` (how a node is defined), `TimeSeriesValue` (actual/forecast data loops), `Scenario`, `DateRange`, and `AppState`.
- **`src/data.ts`**: Provides the base mock data (`initialKPIs`) that loads on the first run.

### Application Components
- **`src/components/MainLayout.tsx`**: The UI wrapper for the application, handling the sidebar navigation and layout grid.
- **`src/components/Header.tsx`**: The main top bar that includes the dynamic Date Range selectors (Start Date -> End Date), along with action buttons like **Upload Data**, **Forecast**, and **Reset**.
- **`src/components/SimulationCanvas.tsx`**: **The Orchestrator**. This is the most complex file in the stack. It maintains the master `appState` (including the full KPI tree and current scenario), handles file uploading (Excel/JSON parsing logic), renders the `<ReactFlow />` visual tree using Dagre layouts, and manages the modal for editing node settings.
- **`src/components/KPINode.tsx`**: A custom node component registered with React Flow. It renders the individual cards in the tree, showing sparklines, variances, and input controls for `PERCENT` or `ABSOLUTE` simulations.
- **`src/components/SpreadsheetView.tsx`**: Displays the active KPI tree as an editable, hierarchical table. It dynamically generates month/year column headers based on the current Date Range, accepts manual overrides, and handles Excel exports/imports specifically for the spreadsheet.

### Utility Modules
- **`src/utils/calc.ts`**: The mathematical engine of the app. It features the `calculateValues` function which recursively traverses the KPI tree. It processes Leaf nodes, then calculates Parents using `SUM`, `PRODUCT`, `AVERAGE`, or `CUSTOM` formulas by aggregating the children, incorporating manual simulation inputs, and accounting for monthly/annual overrides.
- **`src/utils/dateRange.ts`**: Contains `getMonthsInRange()`, which converts the user's selected `DateRange` into a structured array of labels (e.g., "Jan", "Feb 2025") used for rendering table columns and allocating data points dynamically.
- **`src/utils/forecast.ts`**: Handles the statistical projection functions (Linear Trend, Moving Average, Flat Growth) used when the user hits "Generate Forecast", projecting historical data across a 12-month horizon.

## ⚙️ How It Works (Data Flow)

1. **State Initialization**: When the app loads, `SimulationCanvas` reads from `localStorage`. If nothing is found, it loads the default tree from `data.ts`.
2. **Calculations**: Every time a node's formula, simulation value, or an override in the Spreadsheet View is modified, `calculateValues()` runs. This strictly calculates from the leaf nodes up to the root to ensure all aggregations are accurate.
3. **Data Uploads**: 
    - The parser uses `xlsx` to handle both CSV and true Excel formats.
    - If a predefined structure (like an `id` or `parentId` column) is found, it exactly maps the tree.
    - **Fallback**: If a totally raw file is uploaded, the script grabs the first column (regardless of header name), uses it as the KPI labels, uses leading spaces to infer hierarchical depth, and maps all subsequent columns to the respective date range dynamically.
4. **Rendering**: The `calculatedValues` are passed into the React Flow nodes and the Spreadsheet rows as props, automatically causing sparklines and variance % badges to update in real-time.
