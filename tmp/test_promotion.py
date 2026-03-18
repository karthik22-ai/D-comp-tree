
import sys
import os
import json

# Add project root to path
sys.path.append(os.getcwd())

from backend.importer import promote_by_hierarchy

def test_long_format_promotion():
    # L1, L2, Scenario, Time, Value
    rows = [
        ["Level 1", "Level 2", "Scenario", "Date", "Amount"],
        ["Revenue", "Sales", "Actual", "2024-01-01", 100],
        ["Revenue", "Sales", "Actual", "2024-02-01", 120],
        ["Revenue", "Sales", "Budget", "2024-01-01", 110],
        ["Revenue", "Services", "Actual", "2024-01-01", 50],
    ]
    
    # We want to support this kind of mapping
    mappings = {
        "0": "L1",
        "1": "L2",
        "2": "Scenario",
        "3": "Time",
        "4": "Value"
    }
    
    # Current function signature (needs change):
    # def promote_by_hierarchy(rows: List[List[Any]], months_count: int = 12, mappings: Dict[str, str] = None)
    
    try:
        result = promote_by_hierarchy(rows, 12, mappings=mappings)
        print("Promotion Result Keys:", result.keys())
        # We expect a nested structure if scenarios are present, 
        # or a way to distinguish them.
        # Given the frontend structure, maybe we should return:
        # { "scenarios": { "Actual": { kpis... }, "Budget": { kpis... } } }
    except TypeError as e:
        print(f"FAILED as expected (missing mappings param): {e}")

if __name__ == "__main__":
    test_long_format_promotion()
