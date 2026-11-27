import axios from 'axios';

// Base backend URL: set VITE_API_BASE_URL in Vercel (e.g. https://your-backend.onrender.com)
// Remains backwards-compatible with VITE_API_URL if it includes /api/analyze
const rawBase =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/analyze\/?$/, '')
    : '') ||
  'http://localhost:8000';

export const API_BASE_URL = rawBase.replace(/\/+$/, '');

const API_URL = import.meta.env.VITE_API_URL || `${API_BASE_URL}/api/analyze`;
const INTERVIEW_API_URL = import.meta.env.VITE_INTERVIEW_API_URL || `${API_BASE_URL}/api/interview`;

export const analyzeResume = async (resumeFile, jobDescriptionText, antiBiasMode = false, strictness = 50) => {
    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('job_description', jobDescriptionText);
    formData.append('anti_bias_mode', antiBiasMode);
    formData.append('strictness', strictness);

    try {
        const response = await axios.post(API_URL, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error analyzing resume:", error);
        throw error;
    }
};

export const rewriteBullet = async ({ original_bullet, target_skill, job_role }) => {
    const response = await fetch(`${API_BASE_URL}/api/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_bullet, target_skill, job_role }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Rewrite failed with HTTP ${response.status}`);
    }
    return await response.json();
};

export const startHunt = async (resumeText) => {
    const response = await fetch(`${API_BASE_URL}/api/hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Hunt start failed with HTTP ${response.status}`);
    }
    return await response.json();
};

export const getHuntResults = async (taskId) => {
    const response = await fetch(`${API_BASE_URL}/api/hunt-results/${taskId}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Hunt poll failed with HTTP ${response.status}`);
    }
    return await response.json();
};

export const runBiasAudit = async (jobDescription, resumeText = null) => {
    const response = await fetch(`${API_BASE_URL}/api/bias-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, resume_text: resumeText || null }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Bias audit failed with HTTP ${response.status}`);
    }
    return await response.json();
};

export const createInterview = async (resume, jd, options = {}) => {
    const payload = {
        resume: resume || '',
        jd: jd || '',
        difficulty: options.difficulty || 'medium',
        question_count: options.questionCount || options.question_count || 5,
        questions: options.questions || options.preloaded_questions || null,
    };
    const response = await axios.post(`${INTERVIEW_API_URL}/start`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
};

export const submitInterviewTurn = async (payload) => {
    const response = await axios.post(`${INTERVIEW_API_URL}/turn`, {
        session_id: payload.session_id,
        resume: payload.resume || '',
        jd: payload.jd,
        agenda: payload.agenda,
        current_index: payload.current_index,
        history: payload.history || [],
        candidate_answer: payload.candidate_answer,
    }, {
        headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
};

export const transcribeAudio = async (audioBlob) => {
    const formData = new FormData();
    const ext = audioBlob.type && audioBlob.type.includes('webm') ? 'webm' : 'wav';
    formData.append('file', audioBlob, `speech.${ext}`);

    const res = await fetch(`${INTERVIEW_API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Transcription failed with HTTP ${res.status}`);
    }
    return await res.json();
};