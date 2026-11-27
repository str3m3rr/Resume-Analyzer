import axios from 'axios';

// This is the URL where your FastAPI server is running
// In production, use VITE_API_URL environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/analyze';

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

const INTERVIEW_API_URL = import.meta.env.VITE_INTERVIEW_API_URL || 'http://localhost:8000/api/interview';

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