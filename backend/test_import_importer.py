from logic.importer import promote_by_hierarchy
import json

rows = [
    ["Component", "Scenario", "Jan-24", "Feb-24"],
    ["Revenue", "Actual", 100, 200],
    ["Revenue", "Forecast", 300, 400]
]

mappings = {"0": "L1", "1": "Scenario"}

res = promote_by_hierarchy(rows, 2, mappings, 0, 2024)

for s in res['scenarios']:
    print(s)
    for k in res['scenarios'][s]:
        print("  ", res['scenarios'][s][k]['label'], [d['actual'] for d in res['scenarios'][s][k]['data']])
