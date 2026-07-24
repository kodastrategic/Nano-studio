const MODEL_ENDPOINTS = {
    "flux.2-klein-4b": { slug: "black-forest-labs/flux.2-klein-4b", cfg: false },
    "flux.1-schnell":  { slug: "black-forest-labs/flux.1-schnell",  cfg: false },
    "flux.1-dev":      { slug: "black-forest-labs/flux.1-dev",      cfg: true  },
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).end();
    }

    const { prompt, key, width, height, steps, model } = req.body;
    if (!prompt || !key) {
        return res.status(400).json({ error: "Missing prompt or key" });
    }

    const info = MODEL_ENDPOINTS[model] || MODEL_ENDPOINTS["flux.1-schnell"];
    const payload = {
        prompt,
        width: width || 1024,
        height: height || 1024,
        seed: Math.floor(Math.random() * 2147483647),
        steps: steps || 4,
    };
    if (info.cfg) {
        payload.cfg_scale = 1;
    }

    try {
        const response = await fetch(
            `https://ai.api.nvidia.com/v1/genai/${info.slug}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(response.ok ? 200 : response.status).json(data);
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
}
