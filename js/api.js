// js/api.js

// Endpoint serverless de Vercel (SambaNova Cloud como principal + fallback garantizado a Pollinations)
const CHAT_ENDPOINT = '/api/chat';

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
 * Llama a la API de IA (vía serverless /api/chat: SambaNova Cloud prioritario con fallback a Pollinations).
 */
async function callAI(messages) {
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                temperature: 0.5
            })
        });

        if (!response.ok) {
            // Si /api/chat devuelve 404 (ej. en desarrollo local sin Vercel), fallback directo a Pollinations
            if (response.status === 404) {
                return await directFallbackAI(messages);
            }
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error || `Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.content || '';
    } catch (error) {
        // En caso de fallo de red al endpoint local, intentar fallback directo
        if (error.message && error.message.includes('Failed to fetch')) {
            try {
                return await directFallbackAI(messages);
            } catch (fallbackErr) {
                console.error('Fallback también falló:', fallbackErr);
            }
        }
        console.error('API Call Failed:', error);
        throw error;
    }
}

async function directFallbackAI(messages) {
    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk_8S7OMOdZw5eolrik71nWiQ6RlNcX7QOV'
        },
        body: JSON.stringify({
            model: 'openai/gpt-5.4-nano',
            messages,
            temperature: 0.5
        })
    });
    if (!res.ok) throw new Error(`Error de IA ${res.status}`);
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
}

// --- Imagen a texto (solo para fotos) ---
// La llamada a Pollinations se hace en la función serverless de Vercel (api/vision.js),
// que lee la API key de la variable de entorno POLLINATIONS_API_KEY.
const VISION_ENDPOINT = '/api/vision';

/**
 * Convierte una imagen (data URL base64) a texto.
 */
export async function imageToText(dataUrl) {
    const response = await fetch(VISION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Error de visión ${response.status}`);
    }
    return data.text || '';
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
