import sys
import json
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from logic.importer import promote_by_hierarchy

rows = [
    ["L1", "L2", "Scenario", "Jan 2024", "Feb 2024"],
    ["A", "B", "Actual", 10, 20],
    ["A", "B", "Budget", 15, 25]
]
mappings = {
    "0": "L1",
    "1": "L2",
    "2": "Scenario"
}

res = promote_by_hierarchy(rows, 12, mappings, 0, 2024)
print(json.dumps(res, indent=2))
