
import express from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { rateLimit } from "express-rate-limit";
const app = express();
const PORT = 3000;

// Allow Express to read JSON request bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static("public"));


const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    handler: (req, res) => {
        res.status(429).json({
            error: "Too many requests. Please try again later."
        });
    }
});

// Protect all API routes
app.use("/api", apiLimiter);



app.post("/api/chat", async (req, res) => {

    const { messages, model = "gemma4:e4b", stream =true , think, options } = req.body ?? {};

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
            error: "Messages are required and must not be empty"
        });
    }
    const controller = new AbortController();
    // Cancel Ollama request when the client disconnects
    res.on("close", () => {
        if (!res.writableFinished) {
            console.log("Client disconnected: aborting Ollama request");
            controller.abort();
        }
    });


    try {
        // Forward request to Ollama
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages,
                stream,
                ...(think !== undefined ? { think } : {}),
                ...(options !== undefined ? { options } : {})
            }),
            signal: controller.signal
        });

        // Check HTTP errors returned by Ollama
        if (!response.ok) {
            return res.status(502).json({
                error: `Ollama returned HTTP ${response.status}`
            });
        }
        // Non-streaming mode
        if (stream === false) {
            const data = await response.json();
            return res.json(data);
        }
        // Streaming mode
         res.setHeader("Content-Type", "application/x-ndjson");
         await pipeline(
            Readable.fromWeb(response.body),
            res
        );


    } catch (error) {
        // Client intentionally disconnected
        if (controller.signal.aborted) {
            return;
        }

        console.error("Ollama error:", error.message);
        if (!res.headersSent) {
            return res.status(502).json({
                error: "Cannot reach Ollama"
            });
        }

        res.end();
    }
});


app.get("/api/models", async (req, res) => {
    try {
        // Step 1: Get the list of installed models
        const response = await fetch("http://127.0.0.1:11434/api/tags");

        if (!response.ok) {
            throw new Error(`Ollama returned HTTP ${response.status}`);
        }

        const data = await response.json();

        // Step 2: Retrieve capabilities for every model
        const models = await Promise.all(
            data.models.map(async (model) => {
                const detailsResponse = await fetch(
                    "http://127.0.0.1:11434/api/show",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: model.name
                        })
                    }
                );

                if (!detailsResponse.ok) {
                    throw new Error(
                        `Cannot retrieve capabilities for ${model.name}`
                    );
                }

                const details = await detailsResponse.json();

                return {
                    name: model.name,
                    capabilities: details.capabilities ?? []
                };
            })
        );

        res.json(models);

    } catch (error) {
        console.error("Models error:", error.message);

        res.status(502).json({
            error: "Cannot retrieve Ollama models"
        });
    }
});


// Start the HTTP server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
