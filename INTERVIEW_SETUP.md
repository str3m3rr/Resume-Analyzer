# AI Mock Interviewer setup

## Frontend

```powershell
cd "C:\Users\ayush\Desktop\int\int - Copy\frontend"
npm install
npm run dev
```

The feature uses free browser `SpeechRecognition` (Chrome/Edge) and
`speechSynthesis`, so no speech API key is required. Add
`VITE_AVATAR_URL` with a Ready Player Me `.glb` URL to replace the fallback
avatar. The component renders the GLB with React Three Fiber and adds a subtle
head/mouth motion while speech is playing.

## Python service

```powershell
cd "C:\Users\ayush\Desktop\int\int - Copy\backend"
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

`GROQ_API_KEY` is optional. With it, the service uses the free Groq API and
returns structured agenda/evaluation JSON. Without it, deterministic prompts
and scoring keep local demos functional.

## Node gateway (optional, for session state and Socket.io)

```powershell
cd "C:\Users\ayush\Desktop\int\int - Copy\interview-service"
npm install
$env:PYTHON_API_URL="http://localhost:8000"
npm start
```

Then set `VITE_INTERVIEW_API_URL=http://localhost:3001/api/interview` before
starting Vite. For Docker, run the Python service first and expose the gateway
on port 3001. Production deployments should replace the in-memory `Map` with
Redis and restrict CORS origins.
