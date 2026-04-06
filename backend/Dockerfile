# Use an official lightweight Python image
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    redis-server \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file
COPY requirements.txt .

# FIX 1: Install CPU-only PyTorch first (saves space)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    --trusted-host download.pytorch.org

# FIX 2: Install everything else
RUN pip install --no-cache-dir -r requirements.txt \
    --trusted-host pypi.org \
    --trusted-host pypi.python.org \
    --trusted-host files.pythonhosted.org

# FIX 3: Fetch spaCy dictionary
RUN pip install --no-cache-dir https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1.tar.gz

# Pre-download ML models (SBERT and spaCy)
COPY download_models.py .
RUN python download_models.py

# Copy the rest of your Python files
COPY . .

# Expose the FastAPI default port
EXPOSE 10000

# Make start script executable
RUN chmod +x start.sh

# Run the All-in-One startup script
CMD ["/bin/bash", "start.sh"]