#!/bin/bash
# Run all load and stress tests for URL Shortener
# Unix/Linux/macOS shell script

set -e  # Exit on error

echo "============================================================"
echo "URL Shortener - Complete Load Testing Suite"
echo "============================================================"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "ERROR: k6 is not installed"
    echo "Please install k6 from: https://k6.io/docs/get-started/installation/"
    echo ""
    echo "macOS: brew install k6"
    echo "Linux: See https://k6.io/docs/get-started/installation/"
    exit 1
fi

echo "✓ k6 is installed"
echo ""

# Check if server is running
echo "Checking if server is running..."
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "ERROR: Server is not running at http://localhost:3000"
    echo "Please start the server first: npm run dev"
    exit 1
fi

echo "✓ Server is running"
echo ""

# Set base URL
export BASE_URL=http://localhost:3000

echo "============================================================"
echo "Test 1: Load Test (20 minutes)"
echo "============================================================"
echo ""
k6 run src/test/load/load-test.js
echo ""
echo "✓ Load test completed successfully"
echo ""
sleep 10

echo "============================================================"
echo "Test 2: Stress Test (30 minutes)"
echo "============================================================"
echo ""
k6 run src/test/load/stress-test.js
echo ""
echo "✓ Stress test completed successfully"
echo ""
sleep 10

echo "============================================================"
echo "Test 3: Spike Test (10 minutes)"
echo "============================================================"
echo ""
k6 run src/test/load/spike-test.js
echo ""
echo "✓ Spike test completed successfully"
echo ""
sleep 10

echo "============================================================"
echo "Test 4: Chaos Engineering Tests (30 minutes)"
echo "============================================================"
echo ""
echo "NOTE: Chaos tests require Docker containers to be running"
read -p "Press Enter to continue or Ctrl+C to skip..."
node src/test/load/chaos-test.js
echo ""
echo "✓ Chaos test completed successfully"
echo ""

echo "============================================================"
echo "Test 5: Soak Test (2+ hours) - OPTIONAL"
echo "============================================================"
echo ""
echo "Soak test takes over 2 hours. Run separately if needed:"
echo "k6 run src/test/load/soak-test.js"
echo ""

echo "============================================================"
echo "ALL TESTS COMPLETED SUCCESSFULLY"
echo "============================================================"
echo ""
echo "Results saved to:"
echo "  - summary.json"
echo "  - stress-test-results.json"
echo "  - spike-test-results.json"
echo ""
echo "Review the results and check for:"
echo "  - Error rates < 1%"
echo "  - p99 latency < 100ms for redirects"
echo "  - p99 latency < 200ms for URL creation"
echo "  - System stability during failures"
echo ""

exit 0
