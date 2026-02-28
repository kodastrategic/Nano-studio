export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt, openrouterKey, model = "google/gemini-2.5-flash-image" } = req.body;

    if (!prompt || prompt.length < 3) return res.status(400).json({ error: 'Prompt muito curto' });
    if (!openrouterKey) return res.status(400).json({ error: 'OpenRouter Key necessária' });

    const startTime = Date.now();

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openrouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://banana-studio.vercel.app",
                "X-Title": "Banana Studio"
            },
            body: JSON.stringify({
                "model": model,
                "modalities": ["image"],
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            { "type": "text", "text": prompt }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message || "Erro na API OpenRouter");

        // Parsing do formato específico do OpenRouter/Gemini Flash Image
        const content = data.choices[0].message.content;
        let imageUrl = "";

        if (Array.isArray(content)) {
            const imageItem = content.find(item => item.type === "image_url");
            imageUrl = imageItem ? imageItem.image_url.url : "";
        }

        if (!imageUrl) throw new Error("A API não retornou uma URL de imagem.");

        res.status(200).json({
            imageUrl,
            providerUsed: "openrouter",
            meta: {
                ms: Date.now() - startTime,
                model: model
            }
        });

    } catch (error) {
        console.error("OpenRouter Error:", error);
        res.status(500).json({ error: error.message });
    }
}
