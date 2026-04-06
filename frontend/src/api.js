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