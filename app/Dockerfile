FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# gunicorn_config.py binds 0.0.0.0:5002 - EXPOSE must match or the port
# mapping/healthchecks in docker-compose silently point at the wrong port.
EXPOSE 5002

# Run as non-root
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

CMD ["gunicorn", "-c", "gunicorn_config.py", "app:app"]
