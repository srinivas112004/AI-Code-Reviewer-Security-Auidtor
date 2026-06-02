# AI Code Reviewer & Security Auditor Agent

<div align="center">
  <img src="frontend/public/AI Code Reviewer & Secuity Auditor.jpeg" width="120" alt="Logo" style="border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
  <h2 style="margin-top: 15px; font-weight: 700;">From Code to Secure, Instantly.</h2>
  <p>An enterprise-grade, AI-powered code security auditing, vulnerability detection, and automatic fixing suite powered by Google's Gemini AI.</p>
</div>

---

## 🚀 Key Features

* **AI-Powered Vulnerability Detection**: Deep-scan your codebases for SQL injection, XSS, CSRF, remote code execution, and other OWASP Top 10 vulnerabilities using advanced semantic AI.
* **Triple-Redundant Context Fixes**: Generate real, precise line-by-line code fixes directly in the UI. Instantly view an interactive visual diff comparing original and patched code.
* **Multi-Fix Alternative Solutions**: Request multiple alternative fixing strategies with lists of pros and cons, allowing developers to choose the ideal architectural fit.
* **Interactive Code Chat & Explainer**: Work directly with the security auditor. Explain complex functions and ask architectural security questions inside an integrated, high-fidelity Monaco Editor environment.
* **Premium PDF Report Generator**: Generate and download stunning executive security reports featuring left-accent branding bars, KPI breakdowns, custom-styled auto-tables, and clean typography.
* **Multiple Input Methods**:
  * Drag-and-drop file/ZIP directory scanner.
  * Scan public GitHub repositories directly via URL.
  * Direct copy-paste code auditor.
* **JWT User Authentication & SQLite Store**: Complete multi-user accounts system with role access control (User vs. Admin), robust rate-limiting, secure DB backups, and persistent scan histories.

---

## 🛠️ Tech Stack

### Backend
* **Python 3.8+**
* **Flask** - Clean API endpoints and server-sent event (SSE) streaming
* **Google Generative AI (Gemini)** - Model orchestration for code review, fixes, and chat
* **SQLite & SQLAlchemy** - Persistent relational storage for user accounts, scans, and issue snippets
* **GitPython** - Secure checkout and scanning of public GitHub repositories

### Frontend
* **React 19 & Vite 7** - Ultra-fast development server and production bundling
* **Tailwind CSS v4** - Custom utility class designs with fluid hover transitions
* **ChartJS & React-Chartjs-2** - Dynamic vulnerability and trend visualizations
* **Monaco Editor (@monaco-editor/react)** - Visual code highlights for explains and security chat
* **jsPDF & jsPDF-AutoTable** - Professional corporate report generation

---

## 📋 Prerequisites

* **Python 3.8** or higher
* **Node.js 18** or higher
* **npm** or **yarn** package manager
* **Google AI API Key (Gemini)** - Obtain one from [Google AI Studio](https://aistudio.google.com/)

---

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/srinivas112004/AI-Code-Reviewer-Security-Auidtor-.git
cd "AI Code Reviewer and Security Auditor"
```

### 2. Backend Setup

#### Create and Activate Virtual Environment
```bash
cd backend
python -m venv .venv
```
* **Windows (PowerShell)**:
  ```powershell
  .venv\Scripts\Activate.ps1
  ```
* **macOS/Linux**:
  ```bash
  source .venv/bin/activate
  ```

#### Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
JWT_SECRET_KEY=your_jwt_signing_key_here
```

---

### 3. Frontend Setup

#### Install Node.js Dependencies
```bash
cd ../frontend
npm install
```

---

## 🚀 Running the Application

### Start the Backend API Server
```bash
cd backend
python main.py
```
The backend API server will spin up on **`http://localhost:5000`**.

### Start the Frontend Dev Server
```bash
cd frontend
npm run dev
```
The Vite development server will boot and be accessible locally at **`http://localhost:5173`**.

---

## 📖 Main Workflow Guide

### 1. Initiating a Scan
* **ZIP Upload**: Drop any ZIP archive of your source code. The backend automatically handles nested files.
* **GitHub Repository**: Input the URL of any public GitHub project to run an immediate remote audit.
* **Direct Paste**: Switch to the Monaco Editor tab, select your programming language, and paste specific files to audit.

### 2. Generating Context-Rich Fixes
* Select any security vulnerability from the actionable issues feed.
* Click **Generate AI Fix** to see a clean line-by-line visual diff.
* Click **Multiple Fixes** to see alternative approaches, complete with pros, cons, and confidence scores.
* Click **Download Patched File** to download the fixed code file.

### 3. Reviewing Reports
* Switch to the **Reports** tab or click **Download PDF** on any scan.
* Generates a corporate-grade, customized layout ready for stakeholders.

---

## 🛡️ Security & Administration

* **Rate Limiting**: Configured daily scanning thresholds per user role.
* **Automatic SQLite Migrations**: Secure column updates (`code_snippet` extensions) auto-applied on startup.
* **Automatic Database Backups**: Run `python backup_db.py` to securely store snapshots of user and scan records.
* **Log Rotation**: Persistent audit logging enabled inside the `backend/logs` directory.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-ui`
3. Commit your changes: `git commit -m 'Add amazing UI design'`
4. Push to the branch: `git push origin feature/amazing-ui`
5. Open a Pull Request.

---

<div align="center">
  <p>Built with ❤️ for secure coding</p>
  <p>Star this repo if you found it helpful! ⭐</p>
</div>
