# Telugu PDF Reader - React + FastAPI

Streamlit has been removed.

## Prerequisites
- Python 3.10+
- Node.js 18+
- Tesseract OCR with Telugu (`tel`) and English (`eng`) trained data
- Ollama with `llama3.2`

## Tesseract
Install Tesseract on Windows with Telugu and English language data. Check:
```powershell
tesseract --list-langs
```
Both `tel` and `eng` should appear. Add Tesseract to PATH or configure its executable path in `backend/processor.py`.

## Ollama
```powershell
ollama pull llama3.2
ollama serve
```

## Run backend (PowerShell, project root)
```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
API docs: http://localhost:8000/docs

## Run frontend (second terminal)
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## API
- GET `/api/health`
- POST `/api/documents/process`
- POST `/api/documents/export`

## Notes
Pages with at least 35 embedded text characters use PyMuPDF; other pages use Tesseract OCR. pdfplumber detects digital tables. Ollama structures tables and paragraphs and translates them.
This starter processes synchronously, so large PDFs may take several minutes. A scanned page with complex table geometry needs layout-aware OCR/table recognition (for example PaddleOCR PP-Structure). Verify OCR and AI output against source documents. Add background jobs, authentication, storage, rate limits and malware scanning before public production deployment. CORS is configured for localhost:5173.
"# VMS" 
