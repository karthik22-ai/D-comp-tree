from backend.logic.calc import KPICalculator

kpis = {
    'A': {
        'id': 'A',
        'label': 'A',
        'formula': 'SUM',
        'children': ['B', 'C'],
        'data': []
    },
    'B': {
        'id': 'B',
        'label': 'B',
        'formula': 'NONE',
        'children': [],
        'data': [{'month': i, 'year': 2024, 'actual': 10} for i in range(12)]
    },
    'C': {
        'id': 'C',
        'label': 'C',
        'formula': 'NONE',
        'children': [],
        'data': [{'month': i, 'year': 2024, 'actual': 20} for i in range(12)]
    }
}
date_range = {'startMonth': 0, 'startYear': 2024, 'endMonth': 11, 'endYear': 2024}

calc = KPICalculator(kpis, date_range)
res, imp = calc.calculate()
print("Base Total A:", res['A'][-1])
print("Base Total B:", res['B'][-1])
print("Base Total C:", res['C'][-1])

kpis['A']['fullYearOverride'] = 500
calc2 = KPICalculator(kpis, date_range)
res2, imp2 = calc2.calculate()
print("Override Total A:", res2['A'][-1])
print("Override Total B:", res2['B'][-1])
print("Override Total C:", res2['C'][-1])
