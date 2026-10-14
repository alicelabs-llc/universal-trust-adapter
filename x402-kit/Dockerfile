FROM python:3.12-slim
WORKDIR /app
COPY fastapi/fastapi_server.py ./fastapi_server.py
RUN pip install --no-cache-dir "x402[fastapi,httpx,evm]" fastapi uvicorn
ENV PORT=4020 NETWORK=base-sepolia
# PAY_TO se pasa como variable en el deploy (wallet de tesoreria AliceLabs)
CMD uvicorn fastapi_server:app --host 0.0.0.0 --port ${PORT}
