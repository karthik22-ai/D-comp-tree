import numpy as np
from typing import List, Dict, Any, Optional

def generate_forecast(historical_data: List[float], horizon: int = 12, method: str = 'LINEAR_TREND', growth_rate: float = 0.0) -> List[float]:
    """
    Generates a forecast based on historical data points.
    Methods: LINEAR_TREND, MOVING_AVERAGE, FLAT_GROWTH, SEASONAL_NAIVE
    """
    if not historical_data:
        return [0.0] * horizon
        
    if method == 'FLAT_GROWTH':
        last_val = historical_data[-1]
        if growth_rate == 0:
            return [last_val] * horizon
        
        # Compound growth: future = last_val * (1 + monthly_growth)^n
        monthly_growth = (1 + growth_rate) ** (1/12) - 1
        return [last_val * ((1 + monthly_growth) ** i) for i in range(1, horizon + 1)]
        
    if method == 'MOVING_AVERAGE':
        window = min(3, len(historical_data))
        avg = sum(historical_data[-window:]) / window
        return [avg] * horizon
        
    if method == 'LINEAR_TREND':
        if len(historical_data) < 2:
            return [historical_data[-1]] * horizon
        
        x = np.arange(len(historical_data))
        y = np.array(historical_data)
        
        # Simple linear regression: y = mx + c
        m, c = np.polyfit(x, y, 1)
        
        future_x = np.arange(len(historical_data), len(historical_data) + horizon)
        forecast = m * future_x + c
        return forecast.tolist()

    if method == 'SEASONAL_NAIVE':
        # Repeats the last 12 months (or fewer if not enough data)
        cycle = 12
        if len(historical_data) == 0:
            return [0.0] * horizon
        
        forecast = []
        for i in range(horizon):
            # Take value from same month in previous year(s)
            prev_idx = len(historical_data) - cycle + (i % cycle)
            if prev_idx >= 0:
                forecast.append(historical_data[prev_idx])
            else:
                # Fallback to last available if less than a cycle
                forecast.append(historical_data[-1])
        return forecast
        
    # Default to flat last value
    return [historical_data[-1]] * horizon
