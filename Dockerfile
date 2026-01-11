FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pipenv
RUN pip install pipenv

# Copy dependency files first (for better caching)
COPY ["Pipfile", "Pipfile.lock", "./"]

# Install Python dependencies
RUN pipenv install --deploy --ignore-pipfile --system

# Copy data files
COPY data/CancerQA_data.csv data/CancerQA_data.csv
COPY data/ground-truth-retrieval_v2.csv data/ground-truth-retrieval_v2.csv

# Copy grafana configuration
COPY grafana/ grafana/

# Copy the main application
COPY Cancer_chatbot/ .

# Copy additional files that might be needed
COPY cli.py .
COPY requirements.txt .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_PATH=data/CancerQA_data.csv

EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/')" || exit 1

CMD gunicorn --bind 0.0.0.0:5001 --workers 2 --timeout 120 app:app