import requests
import os

def test_import():
    url = "http://localhost:8000/import"
    
    # Create a dummy CSV file
    csv_content = """Label,Unit,Formula,Jan 2024,Feb 2024
Revenue,$,SUM,100,200
  Sales,$,NONE,60,120
  Service,$,NONE,40,80
Expenses,$,SUM,50,100
"""
    with open("test_import.csv", "w") as f:
        f.write(csv_content)
        
    try:
        with open("test_import.csv", "rb") as f:
            files = {'file': ('test_import.csv', f, 'text/csv')}
            data = {'monthsCount': '2'}
            
            print("Sending import request...")
            response = requests.post(url, files=files, data=data)
        
        if response.status_code == 200:
            print("Import successful!")
            kpis = response.json().get('kpis', {})
            print(f"Imported {len(kpis)} KPIs")
            for id, kpi in kpis.items():
                print(f" - {kpi['label']} (Parent: {kpi['parentId']}, Children: {kpi['children']})")
        else:
            print(f"Import failed with status {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if os.path.exists("test_import.csv"):
            os.remove("test_import.csv")

if __name__ == "__main__":
    test_import()
