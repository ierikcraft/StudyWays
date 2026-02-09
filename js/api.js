const API_KEY = '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'; // Hardcoded as per request
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT_SUMMARY = `You are a helpful study assistant. Your task is to summarize the provided text clearly and concisely. formatting with markdown`;

const SYSTEM_PROMPT_FLASHCARDS = (count) => `You are a helpful study assistant. Your task is to generate exactly ${count} flashcards from the provided text.
The output format MUST be strictly:
P: [Question]
R: [Answer]
P: [Question]
R: [Answer]
...
Do not include any other text, intro, or outro. Just the P/R pairs.`;

const SYSTEM_PROMPT_CHAT = `You are a helpful study assistant. Answer the user's question based strictly on the provided context text. If the answer is not in the text, say you don't know based on the context. Be concise and clear.`;

/**
 * Calls the Groq API.
 * @param {string} messages - Array of message objects.
 * @returns {Promise<string>} - The content of the response.
 */
async function callGroq(messages) {
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // Using a fast model supported by Groq
                messages: messages,
                temperature: 0.5,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('Groq API Call Failed:', error);
        throw error;
    }
}

export async function generateSummary(text) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_SUMMARY },
        { role: 'user', content: text }
    ];
    return await callGroq(messages);
}

export async function generateFlashcards(text, count = 5) {
    const prompt = SYSTEM_PROMPT_FLASHCARDS(count);
    const messages = [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
    ];

    const response = await callGroq(messages);
    try {
        // Strip markdown code blocks if present
        let cleanResponse = response.replace(/```json\n?|```/g, '').trim();

        // Find the JSON array
        const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No se pudo encontrar un array JSON válido en la respuesta.');
    } catch (e) {
        console.error('Error parsing flashcards:', response);
        throw e;
    }
}

export async function generateTitle(text) {
    const messages = [
        { role: 'system', content: 'Eres un asistente experto en resumir. Tu tarea es generar un TITULO corto, conciso y descriptivo (máximo 5 palabras) para el siguiente texto. Devuelve SOLO el título, sin comillas ni texto adicional.' },
        { role: 'user', content: text.substring(0, 1000) } // Send first 1000 chars context
    ];

    try {
        const title = await callGroq(messages);
        return title.trim();
    } catch (error) {
        console.error('Error generating title:', error);
        return null;
    }
}

export async function chatWithContext(context, question, history = []) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT_CHAT },
        { role: 'user', content: `Context:\n${context}` },
        ...history,
        { role: 'user', content: question }
    ];
    return await callGroq(messages);
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
