import re

def test_regex():
    s = "feb2025"
    s2 = "2024-01-01"
    s3 = "jan 25"
    
    # Original problematic regex: (?<=[\s\-\/]|^|(?<=[a-zA-Z]))(20\d{2})(?=\b)
    # The error "look-behind requires fixed-width pattern" is common in Python re
    
    # New regex: (?<!\d)(20\d{2})(?=\b)
    regex = r'(?<!\d)(20\d{2})(?=\b)'
    
    m1 = re.search(regex, s)
    m2 = re.search(regex, s2)
    
    print(f"Match 'feb2025': {m1.group(1) if m1 else 'None'}")
    print(f"Match '2024-01-01': {m2.group(1) if m2 else 'None'}")
    
    # Testing 2-digit fallback
    s4 = "Feb-25"
    short_year_match = re.search(r'(\d{2})$', s4)
    print(f"Short year 'Feb-25': {short_year_match.group(1) if short_year_match else 'None'}")

if __name__ == "__main__":
    test_regex()
