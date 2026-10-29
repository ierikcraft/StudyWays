export async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                const typedarray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }

                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

export function base64ToBlob(base64, mimeType = 'application/pdf') {
    const raw = window.atob(base64.split(',')[1]);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return new Blob([array], { type: mimeType });
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// --- Imágenes ---

export function isImageFile(file) {
    return file && file.type && file.type.startsWith('image/');
}

/**
 * Lee una imagen y la reescala (máx. maxSize px en el lado mayor) a JPEG data URL,
 * para reducir el tamaño enviado a la IA.
 */
export function imageFileToDataUrl(file, maxSize = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                let { width, height } = img;
                const scale = Math.min(1, maxSize / Math.max(width, height));
                width = Math.round(width * scale);
                height = Math.round(height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (err) {
                reject(err);
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo leer la imagen'));
        };
        img.src = url;
    });
}

// Guarda texto como data URL (para no volver a procesar la foto al recargar)
export function textToDataUrl(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return 'data:text/plain;base64,' + window.btoa(binary);
}

export function dataUrlToText(dataUrl) {
    const raw = window.atob(dataUrl.split(',')[1]);
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
