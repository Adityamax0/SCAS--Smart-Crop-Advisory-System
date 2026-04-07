# ⚙️ SCAS Backend: The Intelligence Engine

The SCAS Backend is a high-performance Node.js API that serves as the central nervous system for the Smart Crop Advisory System. It handles complex GeoSpatial queries, AI inference orchestration, and automated escalation logic.

---

## 🚀 Core Features

### 1. GeoSpatial Ticket Routing
Utilizes MongoDB's **2dsphere index** to automatically assign new tickets to the nearest certified field worker within a 50km radius.

### 2. Multi-Modal AI Integration
- **Vision Hub**: Orchestrates Groq Llama-3.2 Vision for disease identification.
- **Audio Hub**: Processes voice-to-advisory queries using Whisper/Groq.
- **Vector Search**: (Upcoming) RAG-based search for government crop manuals.

### 3. Automated Escalation Chain
A state-machine driven service that monitors ticket SLAs. If a worker fails to respond within the target window (default 12hrs), the system automatically promotes the ticket to **Sub-Head** level via Cron-scheduled workers.

---

## 🛠️ API Reference (Key Endpoints)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | User onboarding with district/state grouping. |
| `POST` | `/api/tickets`| Multi-part upload (Description + Voice + Images). |
| `POST` | `/api/users/verify-agristack` | AgriStack/UFSI Federated Identity Handshake. |
| `POST` | `/api/users/record-baseline` | Triple C Carbon Credit MRV baseline entry. |
| `GET`  | `/api/admin/dashboard` | District performance & heatmaps. |

---

## 🔧 Internal Services Architecture

- **`escalationService.js`**: Core logic for state transitions.
- **`notificationService.js`**: Multi-channel delivery (Socket.io, SMTP, Twilio).
- **`mediaService.js`**: Cloudinary integration for resilient media storage.
- **`groqService.js`**: AI inference wrapper for Llama and Whisper.

---

## 🚀 Deployment

- **Infrastructure**: Dockerized on Render (Debian Slim).
- **CI/CD**: Automatic builds triggered via `git push origin main`.
- **Health Monitoring**: Check [https://scas-backend.onrender.com/api/health](https://scas-backend.onrender.com/api/health).

---
© 2026 SCAS Backend Engineering.
