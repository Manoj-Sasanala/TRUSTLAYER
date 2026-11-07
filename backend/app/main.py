from fastapi import FastAPI

app = FastAPI(title="WARRANT")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
