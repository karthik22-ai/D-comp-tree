FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if required (none needed for this specific set of python packages, but good practice for SQLite if complex)

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run sets the PORT environment variable.
ENV PORT=8000

# Run the web service on container startup using uvicorn.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
