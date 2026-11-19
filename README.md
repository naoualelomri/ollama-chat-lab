
# Ollama Local Chat

A local AI chatbot built with Node.js, Express, HTML, CSS, JavaScript, and Ollama.

The application provides a modern chat interface to interact with locally hosted language models through Ollama's REST API.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- AI Runtime: Ollama
- Model used: Gemma 4 E4B
- Communication: REST API and NDJSON Streaming

## Features

- Real-time AI responses with NDJSON streaming
- Conversation history and New Chat
- Dynamic model selection
- Stop button with request cancellation
- Optional reasoning panel (Thinking)
- Generation speed statistics (tokens/second)
- Error handling

## Additional Extensions

### System Prompt and Temperature
- Custom system instructions for the AI model
- Adjustable temperature slider (0.0–1.0)

### API Rate Limiting
- Protection using express-rate-limit
- Maximum 20 API requests per minute per IP
- HTTP 429 returned when the limit is exceeded

## Installation and Setup

### 1. Prerequisites

- Node.js 22 or newer
- Ollama installed
- Git

### 2. Clone the repository

git clone https://github.com/naoualelomri/ollama-chat-lab.git

cd ollama-chat-lab

### 3. Install dependencies

npm install

### 4. Download the AI model

ollama pull gemma4:e4b

### 5. Start Ollama

Make sure Ollama is running.

If necessary, run:

ollama serve

### 6. Start the backend

node server.js

### 7. Open the application

http://localhost:3000

## Architecture

Browser (Frontend)
    |
    | POST /api/chat
    v
Node.js / Express (:3000)
    |
    | POST /api/chat
    v
Ollama (:11434)
    |
    v
Local LLM (Gemma 4 E4B)

The backend forwards Ollama's NDJSON stream to the browser.

## API Endpoints

- POST /api/chat — Send messages and receive AI responses
- GET /api/models — List installed Ollama models and capabilities

## Notes

- The AI model runs locally.
- Conversation history is stored in browser memory during the session.
- No database is required.
- The Ollama server should not be exposed publicly without additional security.

## Academic Context

Developed as part of the "Build a Chat GUI on Top of Ollama" laboratory.

AI coding assistance was used for JavaScript syntax, implementation guidance, and debugging. The application was developed and tested incrementally, including REST API communication, streaming, cancellation, and security checks.
