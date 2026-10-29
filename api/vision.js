// api/vision.js — Función serverless de Vercel
// Convierte una foto en texto usando Pollinations AI.
// La API key se lee de la variable de entorno POLLINATIONS_API_KEY (nunca llega al navegador).

const VISION_URL = 'https://gen.pollinations.ai/v1/chat/completions';
const VISION_MODEL = 'openai/gpt-5.4-nano';
const MAX_IMAGE_CHARS = 4 * 1024 * 1024; // ~4 MB de data URL (límite de Vercel: 4.5 MB por petición)

const SYSTEM_PROMPT_IMAGE_TO_TEXT = `Eres un sistema de OCR para apuntes de estudio. Transcribe fielmente TODO el texto visible en la imagen (incluido texto manuscrito), respetando el orden y la estructura (títulos, listas, tablas en markdown). Si hay fórmulas, escríbelas en texto plano. Si hay diagramas o imágenes sin texto, descríbelos brevemente entre corchetes. No añadas comentarios, introducciones ni conclusiones: devuelve solo el contenido.`;

// Orígenes permitidos (además del propio dominio de despliegue de Vercel)
const ALLOWED_ORIGINS = [
    'https://studyways.erikhub.com',
    'http://localhost:3000'
];

function isAllowedOrigin(origin) {
    if (!origin) return true; // misma página (algunos navegadores no envían Origin en same-origin)
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin); // previews de Vercel
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

    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Falta la variable de entorno POLLINATIONS_API_KEY' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const image = body && body.image;

    // Solo se aceptan imágenes: el modelo y el prompt están fijados en el servidor,
    // así nadie puede usar este endpoint como proxy de chat general con tu clave.
    if (typeof image !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(image)) {
        return res.status(400).json({ error: 'Se esperaba una imagen en formato data URL' });
    }
    if (image.length > MAX_IMAGE_CHARS) {
        return res.status(413).json({ error: 'La imagen es demasiado grande' });
    }

    try {
        const upstream = await fetch(VISION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: VISION_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT_IMAGE_TO_TEXT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Transcribe el contenido de esta imagen.' },
                            { type: 'image_url', image_url: { url: image } }
                        ]
                    }
                ]
            })
        });

        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => '');
            console.error('Pollinations error', upstream.status, errText);
            return res.status(502).json({ error: `Error del servicio de visión (${upstream.status})` });
        }

        const data = await upstream.json();
        const text = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({ text });
    } catch (err) {
        console.error('Vision function failed', err);
        return res.status(500).json({ error: 'Error interno al procesar la imagen' });
    }
};
