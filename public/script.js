
const modelSelect = document.getElementById("model-select");
const thinkToggle = document.getElementById("think-toggle");
let history = [];
const stopButton = document.getElementById("stop-btn");
const systemPromptInput = document.getElementById("system-prompt");
const temperatureSlider = document.getElementById("temperature");
const temperatureValue = document.getElementById("temperature-value");

temperatureSlider.addEventListener("input", () => {
    temperatureValue.textContent = temperatureSlider.value;
});
let currentController = null;
let availableModels = [];
async function loadModels() {
    try {
        // Send a GET request to our Express backend
        const response = await fetch("/api/models");

        if (!response.ok) {
            throw new Error("Failed to load models");
        }

        // Convert the JSON response into JavaScript objects
        const models = await response.json();
        availableModels = models;

        // Remove the "Loading models..." option
        modelSelect.innerHTML = "";

        // Create one option for each installed model
        models.forEach((model) => {
            const option = document.createElement("option");

            option.value = model.name;
            option.textContent = model.name;

            modelSelect.appendChild(option);
        });
        updateThinkingOption();

    } catch (error) {
        console.error("Error loading models:", error);

        modelSelect.innerHTML = "";
        const option = document.createElement("option");
        option.textContent = "Cannot load models";
        option.value = "";
        modelSelect.appendChild(option);
    }
}

// Execute the function when the page loads
loadModels();


const chatMessages = document.getElementById("chat-messages");

function addMessage(role, content) {

    // Create a new HTML element
    const messageElement = document.createElement("div");

    // Apply the corresponding CSS classes
    messageElement.classList.add("message", role);

    // Insert the message text
    messageElement.textContent = content;

    // Add the message to the conversation
    chatMessages.appendChild(messageElement);

    // Scroll to the newest message
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageElement;
}


async function* readNDJSON(response) {

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {

        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        // Convert binary data to text
        buffer += decoder.decode(value, { stream: true });

        // Extract complete JSON lines
        let newlineIndex;

        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {

            const line = buffer.slice(0, newlineIndex).trim();

            buffer = buffer.slice(newlineIndex + 1);

            if (line) {
                yield JSON.parse(line);
            }
        }
    }

    // Decode any remaining bytes
    buffer += decoder.decode();

    // Process the final line if necessary
    if (buffer.trim()) {
        yield JSON.parse(buffer.trim());
    }
}

const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const errorMessage = document.getElementById("error-message");

// Listen for form submission
chatForm.addEventListener("submit", async (event) => {

    // Prevent the browser from reloading the page
    event.preventDefault();

    const userText = messageInput.value.trim();

    if (!userText) {
        return;
    }

    errorMessage.textContent = "";

    // Display the user's message
    const userBubble = addMessage("user", userText);
   // Save the user message in conversation history
    history.push({
        role: "user",
       content: userText
    });

    // Clear the input
    messageInput.value = "";

    // Disable controls during generation
    sendButton.disabled = true;
    messageInput.disabled = true;
    modelSelect.disabled = true;
    currentController = new AbortController();

    stopButton.disabled = false;
    let fullAnswer = "";
    let assistantBubble = null;
    let requestCompleted = false;

    try {
        const messagesToSend = [...history];

if (systemPromptInput.value.trim()) {
    messagesToSend.unshift({
        role: "system",
        content: systemPromptInput.value.trim()
    });
}
        // Send the user's question to Express
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelSelect.value,
                messages: messagesToSend,
options: {
    temperature: Number(temperatureSlider.value)
},
                stream: true,
                think: thinkToggle.checked
            }),
            signal: currentController.signal
        });

        if (!response.ok) {
            throw new Error("The server could not generate a response.");
        }

        
assistantBubble = addMessage("assistant", "");

const reasoningPanel = document.createElement("details");
const reasoningTitle = document.createElement("summary");
const reasoningText = document.createElement("div");

reasoningTitle.textContent = "Reasoning";
reasoningPanel.appendChild(reasoningTitle);
reasoningPanel.appendChild(reasoningText);

// Hide the panel until reasoning text arrives
reasoningPanel.hidden = true;

assistantBubble.appendChild(reasoningPanel);

const answerText = document.createElement("div");
assistantBubble.appendChild(answerText);

let fullThinking = "";
const statsElement = document.createElement("div");

statsElement.classList.add("stats");

assistantBubble.appendChild(statsElement);


// Read every NDJSON object received from Express

for await (const chunk of readNDJSON(response)) {
    console.log("Received chunk:", chunk);

    if (chunk.error) {
        throw new Error(chunk.error);
    }

    // Extract reasoning fragments
    const thinking = chunk.message?.thinking ?? "";

    if (thinking) {
        fullThinking += thinking;

        reasoningPanel.hidden = false;
        reasoningText.textContent = fullThinking;
    }

    // Extract answer fragments
    const text = chunk.message?.content ?? "";

    fullAnswer += text;
    answerText.textContent = fullAnswer;

    // Scroll to the newest content
    chatMessages.scrollTop = chatMessages.scrollHeight;


if (chunk.done === true && chunk.eval_duration > 0) {

    const tokens = chunk.eval_count;

    const durationSeconds = chunk.eval_duration / 1_000_000_000;

    const tokensPerSecond = tokens / durationSeconds;

    statsElement.textContent =
        `${tokensPerSecond.toFixed(2)} tokens/s · ${tokens} tokens`;
}

}



// Save the complete assistant response
history.push({
    role: "assistant",
    content: fullAnswer
});
requestCompleted = true;


    } 
catch (error) {

    const wasAborted =
        error.name === "AbortError" ||
        currentController?.signal.aborted;

    if (wasAborted) {

        // User intentionally stopped generation
        if (fullAnswer.trim()) {

            history.push({
                role: "assistant",
                content: fullAnswer
            });

        } else {

            // No answer received: remove the user message
            history.pop();
            assistantBubble?.remove();
        }

    } else {

        // Real failure: remove the unanswered request
        history.pop();

        // Remove any incomplete assistant response
        assistantBubble?.remove();
        userBubble.remove();

        // Show a readable error message
        errorMessage.textContent =
            error.message || "An unexpected error occurred.";
    }
}
 finally {
        // Re-enable controls
        currentController = null;

       stopButton.disabled = true;
       sendButton.disabled = false;
       messageInput.disabled = false;
       modelSelect.disabled = false;

       messageInput.focus();
    }
});


const newChatButton = document.getElementById("new-chat");

newChatButton.addEventListener("click", () => {

    // Clear conversation history
    history = [];

    // Remove all message bubbles
    chatMessages.replaceChildren();

    // Clear previous error messages
    errorMessage.textContent = "";

    // Focus the input field
    messageInput.focus();
});

stopButton.addEventListener("click", () => {

    if (currentController !== null) {
        currentController.abort();
    }

});


function updateThinkingOption() {

    const selectedModel = availableModels.find(
        model => model.name === modelSelect.value
    );

    const supportsThinking =
        selectedModel?.capabilities.includes("thinking") ?? false;

    // Show or hide the checkbox and its label
    thinkToggle.closest("label").hidden = !supportsThinking;

    if (!supportsThinking) {
        thinkToggle.checked = false;
    }
}

// Update when the user selects another model
modelSelect.addEventListener("change", updateThinkingOption);





