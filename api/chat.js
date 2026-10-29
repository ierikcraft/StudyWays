// api/chat.js — Función serverless de Vercel para texto (Flashcards, Resúmenes, Test, Chat, Audio)
// Intenta usar SambaNova Cloud primero; si SambaNova está saturada (429) o da error,
// usa automáticamente Pollinations AI con tu clave para que nunca se quede colgada.

const SAMBANOVA_URL = 'https://api.sambanova.ai/v1/chat/completions';
const SAMBANOVA_DEFAULT_KEY = '77766d5a-cf15-4e4e-9acb-67e468f6fe45';
const SAMBANOVA_MODEL = 'Meta-Llama-3.3-70B-Instruct';

const POLLINATIONS_URL = 'https://gen.pollinations.ai/v1/chat/completions';
const POLLINATIONS_DEFAULT_KEY = 'sk_8S7OMOdZw5eolrik71nWiQ6RlNcX7QOV';
const POLLINATIONS_MODEL = 'openai/gpt-5.4-nano';

const ALLOWED_ORIGINS = [
    'https://studyways.erikhub.com',
    'http://localhost:3000'
];

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

module.exports = async (req, res) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin) && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origen no permitido' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const messages = body && body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Se esperaba un array de mensajes' });
    }

    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.5;

    // 1. Intentar primero con SambaNova Cloud
    const sambanovaKey = process.env.SAMBANOVA_API_KEY || SAMBANOVA_DEFAULT_KEY;
    if (sambanovaKey) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 7000); // 7s máx para no dejar al usuario esperando
            const sRes = await fetch(SAMBANOVA_URL, {
                method: 'POST',
                signal: ctrl.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sambanovaKey}`
                },
                body: JSON.stringify({
                    model: SAMBANOVA_MODEL,
                    messages,
                    temperature
                })
            });
            clearTimeout(timer);

            if (sRes.ok) {
                const sData = await sRes.json();
                const content = sData.choices?.[0]?.message?.content || '';
                if (content) {
                    return res.status(200).json({ content, provider: 'sambanova' });
                }
            } else {
                console.warn(`SambaNova respondió con ${sRes.status}, recurriendo a Pollinations...`);
            }
        } catch (sErr) {
            console.warn('SambaNova error / timeout, recurriendo a Pollinations:', sErr.message);
        }
    }

    // 2. Fallback garantizado: Pollinations AI con tu clave y gpt-5.4-nano
    const pollinationsKey = process.env.POLLINATIONS_API_KEY || POLLINATIONS_DEFAULT_KEY;
    try {
        const pRes = await fetch(POLLINATIONS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pollinationsKey}`
            },
            body: JSON.stringify({
                model: POLLINATIONS_MODEL,
                messages,
                temperature
            })
        });

        if (!pRes.ok) {
            const errText = await pRes.text().catch(() => '');
            return res.status(502).json({ error: `Error de la IA: ${pRes.status} ${errText}` });
        }

        const pData = await pRes.json();
        const content = pData.choices?.[0]?.message?.content || '';
        return res.status(200).json({ content, provider: 'pollinations' });
    } catch (pErr) {
        console.error('Fallo en IA:', pErr);
        return res.status(500).json({ error: 'Error al contactar con la IA' });
    }
};
