import uvicorn
import sys
import os

# Add root directory to python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if __name__ == "__main__":
    print("==================================================")
    print("  GrocIQ API Backend — Team AXON")
    print("  Serving at: http://127.0.0.1:8000")
    print("  Health endpoint: http://127.0.0.1:8000/api/health")
    print("  API Documentation: http://127.0.0.1:8000/docs")
    print("==================================================")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=False)
