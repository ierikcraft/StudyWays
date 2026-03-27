// js/api.js

// 1. PEGA AQUÍ TU CLAVE DE SAMBANOVA
const API_KEY = '093a150f-94b9-48c0-98f6-9ec0764c807f'; 

// URL de SambaNova (idéntica a la estructura de Groq/OpenAI)
const BASE_URL = 'https://api.sambanova.ai/v1/chat/completions';

// --- TUS PROMPTS ORIGINALES INTACTOS ---
const SYSTEM_PROMPT_SUMMARY = `You are a helpful study assistant. Your task is to summarize the provided text clearly and concisely. formatting with markdown`;

const SYSTEM_PROMPT_AUDIO_SUMMARY = `You are a helpful study assistant. Create a concise, spoken-friendly summary of the provided text. The summary should:
- Be 2-4 sentences maximum
- Use simple, conversational language
- Sound natural when read aloud
- Avoid complex formatting or special characters
- Focus on the key points only
Just provide the summary text, nothing else.`;

const SYSTEM_PROMPT_EXPERT_ADVICE = `Eres un experto tutor académico. El usuario acaba de completar un test. 
Se te proporcionará el texto de estudio original, las preguntas que el usuario ha fallado y qué respondió incorrectamente.
Tu tarea es analizar los fallos y darle un consejo amable, directo y estructurado de qué partes o temas específicos del texto debería repasar más a fondo.
Da indicaciones claras. Responde en español y formatéalo en markdown con bullet points.`;

const SYSTEM_PROMPT_FLASHCARDS = (count) => `You are a helpful study assistant. Your task is to generate exactly ${count} flashcards from the provided text.
The output format MUST be strictly:
P: [Question]
R: [Answer]
P: [Question]
R: [Answer]
...
Do not include any other text, intro, or outro. Just the P/R pairs.`;

const SYSTEM_PROMPT_CHAT = `You are a helpful study assistant. Answer the user's question based strictly on the provided context text. If the answer is not in the text, say you don't know based on the context. Be concise and clear.`;

const SYSTEM_PROMPT_TEST = (count) => `You are a study test generator. Generate exactly ${count} multiple-choice questions based ONLY on the provided text. For each question output EXACTLY four lines in this order and format (no extra text or numbering):
P: <question>
F: <wrong answer>
F: <wrong answer>
V: <correct answer>
Repeat for every question. Do NOT include explanations or headers.`;

/**
 * Llama a la API de SambaNova.
 */
async function callAI(messages) {
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                // Usamos Llama 3.1 70B, rapidísimo y con memoria gigante para tus PDFs
                model: 'Meta-Llama-3.1-8B-Instruct',
                messages: messages,
                temperature: 0.5
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            const errDetails = errData ? JSON.stringify(errData) : response.statusText;
            throw new Error(`API Error ${response.status}: ${errDetails}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('API Call Failed:', error);
        throw error;
    }
}

// --- TUS FUNCIONES PRINCIPALES ---

export async function generateSummary(text) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_SUMMARY },
        { role: 'user', content: text }
    ];
    return await callAI(messages);
}

export async function generateAudioSummary(text) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_AUDIO_SUMMARY },
        { role: 'user', content: text }
    ];
    return await callAI(messages);
}

export async function generateFlashcards(text, count = 5) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_FLASHCARDS(count) },
        { role: 'user', content: text }
    ];
    const rawOutput = await callAI(messages);
    return parseFlashcards(rawOutput);
}

export async function generateTest(text, count = 5) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_TEST(count) },
        { role: 'user', content: text }
    ];
    const rawOutput = await callAI(messages);
    return parseTest(rawOutput);
}

export async function getExpertAdvice(text, incorrectQuestions) {
    const context = `
TEXTO DE ESTUDIO ORIGINAL:
${text}

PREGUNTAS FALLADAS POR EL USUARIO:
${JSON.stringify(incorrectQuestions, null, 2)}
`;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_EXPERT_ADVICE },
        { role: 'user', content: context }
    ];
    return await callAI(messages);
}

export async function chatWithContext(context, question, history = []) {
    const messages = [
        { role: 'system', content: `${SYSTEM_PROMPT_CHAT}\n\nContext:\n${context}` },
        ...history,
        { role: 'user', content: question }
    ];
    return await callAI(messages);
}

// --- TUS FUNCIONES DE PARSEO (Las que leen P: y R: / F: y V:) ---

function parseTest(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const questions = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('P:')) {
            const q = { question: line.substring(2).trim(), options: [] };
            for (let j = 1; j <= 3 && (i + j) < lines.length; j++) {
                const optLine = lines[i + j];
                if (optLine.startsWith('F:')) {
                    q.options.push({ text: optLine.substring(2).trim(), correct: false });
                } else if (optLine.startsWith('V:')) {
                    q.options.push({ text: optLine.substring(2).trim(), correct: true });
                }
            }
            questions.push(q);
            i += 4; 
        } else {
            i++;
        }
    }
    return questions;
}

function parseFlashcards(text) {
    const lines = text.split('\n');
    const cards = [];
    let currentCard = {};

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('P:')) {
            if (currentCard.question && currentCard.answer) {
                cards.push(currentCard);
                currentCard = {};
            }
            currentCard.question = cleanLine.substring(2).trim();
        } else if (cleanLine.startsWith('R:')) {
            currentCard.answer = cleanLine.substring(2).trim();
        }
    });

    if (currentCard.question && currentCard.answer) {
        cards.push(currentCard);
    }

    return cards;
}