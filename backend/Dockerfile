# Use an official lightweight Python image
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    redis-server \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# RAM Optimizations for Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONMALLOC=malloc

# Upgrade pip and base packaging tools, and pre-install typing-extensions to avoid wheel name metadata bugs
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir typing-extensions

# Copy the requirements file
COPY requirements.txt .

# FIX 1: Install CPU-only PyTorch first (saves space)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple \
    --trusted-host download.pytorch.org \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org

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

# Set default port
ENV PORT=8000

# Copy the rest of your Python files
COPY . .

# Expose the FastAPI port
EXPOSE 8000

# Strip carriage returns in start.sh and make start script executable
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Run the startup script
CMD ["/bin/bash", "start.sh"]