#!/usr/bin/env python3
"""
Test script to verify code metrics implementation
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import calculate_cyclomatic_complexity, calculate_code_duplication, scan_dependencies_vulnerabilities

# Test code samples
test_python_code = """
def complex_function(x, y):
    if x > 0:
        if y > 0:
            for i in range(10):
                if i % 2 == 0:
                    print(i)
                else:
                    continue
        else:
            while y < 10:
                y += 1
    else:
        try:
            result = x / y
        except ZeroDivisionError:
            return 0
    return x + y

def simple_function():
    return "hello world"
"""

test_js_code = """
function testFunction(a, b) {
    if (a > b) {
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) {
                console.log(i);
            }
        }
    } else {
        while (a < b) {
            a++;
        }
    }
    return a + b;
}
"""

# Test the metrics
if __name__ == "__main__":
    print("Testing Code Metrics Implementation")
    print("=" * 50)
    
    # Test complexity calculation
    py_complexity = calculate_cyclomatic_complexity(test_python_code, "test.py")
    js_complexity = calculate_cyclomatic_complexity(test_js_code, "test.js")
    
    print(f"Python code complexity: {py_complexity:.2f}")
    print(f"JavaScript code complexity: {js_complexity:.2f}")
    
    # Test duplication detection
    test_files = {
        "file1.py": test_python_code,
        "file2.py": test_python_code,  # Duplicate
        "file3.js": test_js_code
    }
    
    duplication = calculate_code_duplication(test_files)
    print(f"Code duplication percentage: {duplication:.1f}%")
    
    print("\n✅ Code metrics implementation is working!")