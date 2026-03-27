// js/api.js

// ¡Ya no necesitamos API_KEY!
const BASE_URL = 'https://text.pollinations.ai/';

const SYSTEM_PROMPT_SUMMARY = `You are a helpful study assistant. Your task is to summarize the provided text clearly and concisely. formatting with markdown`;

const SYSTEM_PROMPT_AUDIO_SUMMARY = `You are a helpful study assistant. Create a concise, spoken-friendly summary of the provided text. The summary should:
- Be 2-4 sentences maximum
- Use simple, conversational language
- Sound natural when read aloud
- Avoid complex formatting or special characters
- Focus on the key points only
Just provide the summary text, nothing else.`;

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
 * Llama a la API de Pollinations.
 * @param {Array} messages - Array de objetos de mensaje.
 * @returns {Promise<string>} - El contenido de la respuesta.
 */
async function callPollinations(messages) {
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                // Usamos el modelo por defecto, pero puedes especificar "openai", "mistral" o "llama"
                model: 'openai', 
                seed: Math.floor(Math.random() * 1000) // Añadimos algo de aleatoriedad para evitar caché de Pollinations
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => null);
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        // A diferencia de Groq, Pollinations devuelve el texto directamente, no un JSON.
        const text = await response.text();
        return text;
    } catch (error) {
        console.error('Pollinations API Call Failed:', error);
        throw error;
    }
}

export async function generateSummary(text) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_SUMMARY },
        { role: 'user', content: text }
    ];
    return await callPollinations(messages);
}

export async function generateAudioSummary(text) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_AUDIO_SUMMARY },
        { role: 'user', content: text }
    ];
    return await callPollinations(messages);
}

export async function generateFlashcards(text, count = 5) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_FLASHCARDS(count) },
        { role: 'user', content: text }
    ];
    const rawOutput = await callPollinations(messages);
    return parseFlashcards(rawOutput);
}

export async function generateTest(text, count = 5) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_TEST(count) },
        { role: 'user', content: text }
    ];
    const rawOutput = await callPollinations(messages);
    return parseTest(rawOutput);
}

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
            i += 4; // avanza al siguiente bloque
        } else {
            i++; // Ignora texto de relleno que la IA pueda añadir al principio o final
        }
    }
    return questions;
}

export async function chatWithContext(context, question, history = []) {
    const messages = [
        { role: 'system', content: `${SYSTEM_PROMPT_CHAT}\n\nContext:\n${context}` },
        ...history,
        { role: 'user', content: question }
    ];
    return await callPollinations(messages);
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