FROM python:3.11-slim

WORKDIR /app

# CPU-only torch build (no GPU on the free tier)
RUN pip install --no-cache-dir torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 10000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
