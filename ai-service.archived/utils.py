import logging
import os
import tempfile
from werkzeug.utils import secure_filename

def setup_logging():
    """Set up logging configuration"""
    logging_level = os.getenv("LOG_LEVEL", "INFO")
    numeric_level = getattr(logging, logging_level.upper(), logging.INFO)
    
    logging.basicConfig(
        level=numeric_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def save_temp_file(file):
    """Save a file upload to a temporary location"""
    filename = secure_filename(file.filename)
    _, extension = os.path.splitext(filename)
    
    # Create a temporary file with the same extension
    temp_fd, temp_path = tempfile.mkstemp(suffix=extension)
    os.close(temp_fd)
    
    # Save the file to the temporary path
    file.save(temp_path)
    
    return temp_path