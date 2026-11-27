import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const sessions = new Map();
const pythonUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';
app.use(cors());
app.use(express.json({ limit: '1mb' }));

async function python(path, body) {
  const response = await fetch(`${pythonUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Interview service rejected the request');
  return data;
}

app.get('/health', (_request, response) => response.json({ status: 'healthy', service: 'interview-gateway' }));
app.post('/api/interview/start', async (request, response) => {
  try {
    const session = await python('/api/interview/start', request.body);
    sessions.set(session.session_id, { ...session, resume: request.body.resume || '', jd: request.body.jd });
    response.status(201).json(session);
  } catch (error) { response.status(502).json({ error: error.message }); }
});
app.post('/api/interview/turn', async (request, response) => {
  try {
    const current = sessions.get(request.body.session_id);
    if (!current) return response.status(404).json({ error: 'Interview session not found' });
    const next = await python('/api/interview/turn', { ...current, candidate_answer: request.body.candidate_answer });
    sessions.set(next.session_id, { ...current, ...next });
    io.to(next.session_id).emit('interview:update', next);
    response.json(next);
  } catch (error) { response.status(502).json({ error: error.message }); }
});
io.on('connection', socket => {
  socket.on('interview:join', sessionId => {
    if (sessions.has(sessionId)) socket.join(sessionId);
  });
});

const port = Number(process.env.PORT || 3001);
httpServer.listen(port, () => console.log(`Interview gateway listening on ${port}`));
