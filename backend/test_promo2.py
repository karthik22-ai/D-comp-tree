import requests
import json
import os

def test_promo2():
    url = "http://localhost:8000/promote-sheet"
    rows = [
        ["Hierarchy", "Scenario", "Jan 2024", "Feb 2024"],
        ["Revenue", "Actual", 100, 200],
        ["Revenue", "Budget", 150, 250],
        ["Expenses", "Actual", 50, 100],
        ["Expenses", "Budget", 40, 90]
    ]
    mappings = {
        "0": "L1",
        "1": "Scenario"
    }
    
    data = {
        "rows": rows,
        "mappings": mappings,
        "monthsCount": 12,
        "startMonth": 0,
        "startYear": 2024
    }
    
    resp = requests.post(url, json=data)
    if resp.status_code == 200:
        with open("test_promo_out2.json", "w") as f:
            json.dump(resp.json(), f, indent=2)
        print("Success, wrote test_promo_out2.json")
    else:
        print("Failed:", resp.text)

if __name__ == "__main__":
    test_promo2()
