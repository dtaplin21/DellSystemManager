"""
Run script for the Panel Optimizer API service
"""

import os
import sys
from api.panel_api import app

if __name__ == '__main__':
    port = int(os.environ.get('PANEL_API_PORT', 8001))
    app.run(host='0.0.0.0', port=port, debug=True)