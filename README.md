# AI Code Reviewer & Security Auditor Agent

<div align="center">
  <h3>From Code to Secure, Instantly.</h3>
  <p>AI-powered code security auditing and vulnerability detection tool</p>
</div>

## 🚀 Features

- **AI-Powered Security Analysis**: Uses Google's Gemini AI to detect security vulnerabilities in your code
- **Multiple Input Methods**:
  - Upload ZIP files containing your codebase
  - Scan public GitHub repositories via URL
- **Comprehensive Reporting**: Detailed vulnerability reports with severity levels and actionable suggestions
- **Interactive Dashboard**: Visual representation of security scores and vulnerability breakdowns
- **PDF Report Generation**: Download detailed security audit reports
- **Multi-Language Support**: Supports Python, JavaScript, Java, C++, C, HTML, CSS, PHP, Ruby, Go, and more

## 🛠️ Tech Stack

### Backend
- **Python 3.8+**
- **Flask** - Web framework
- **Google Generative AI (Gemini)** - AI-powered code analysis
- **Flask-CORS** - Cross-origin resource sharing
- **GitPython** - Git repository handling
- **python-dotenv** - Environment variable management

### Frontend
- **React 18** - User interface framework
- **Material-UI (MUI)** - Component library
- **Chart.js** - Data visualization
- **Axios** - HTTP client
- **jsPDF** - PDF generation
- **React Particles** - Background animations

## 📋 Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn package manager
- Google AI API key (Gemini)

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd AI-Code-Auditor
```

### 2. Backend Setup

#### Create Virtual Environment
```bash
cd backend
python -m venv venv
```

#### Activate Virtual Environment
- **Windows**:
  ```bash
  venv\Scripts\activate
  ```
- **macOS/Linux**:
  ```bash
  source venv/bin/activate
  ```

#### Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### Environment Configuration
Create a `.env` file in the backend directory:
```env
GOOGLE_API_KEY=your_google_api_key_here
```

Get your Google AI API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 3. Frontend Setup

#### Install Node.js Dependencies
```bash
cd ../frontend
npm install
```

## 🚀 Running the Application

### Start Backend Server
```bash
cd backend
python main.py
```
The backend server will start on `http://localhost:5000`

### Start Frontend Development Server
```bash
cd frontend
npm start
```
The frontend will be available at `http://localhost:3000`

## 📖 Usage

### Scanning Code

1. **Upload ZIP File**:
   - Click on "Upload ZIP" tab
   - Drag and drop your ZIP file or click to select
   - Click "Scan Now" to start analysis

2. **GitHub Repository**:
   - Click on "GitHub URL" tab
   - Enter the public GitHub repository URL
   - Click "Scan Now" to start analysis

### Understanding Results

- **Overall Security Score**: Visual gauge showing code security rating (0-100)
- **Vulnerability Breakdown**: Doughnut chart categorizing issues by severity
- **Code Quality Metrics**: Key statistics about your codebase
- **Actionable Issues Feed**: Detailed list of security issues with:
  - Severity level (Critical, High, Medium, Low)
  - File location
  - Issue description
  - AI-powered suggestions for fixes

### Exporting Reports

- Click "Download Report" to generate a comprehensive PDF report
- Reports include all scan results, metrics, and actionable recommendations

## 🔍 Supported File Types

| Language | Extensions |
|----------|------------|
| Python | `.py` |
| JavaScript | `.js` |
| Java | `.java` |
| C++ | `.cpp`, `.c++` |
| C | `.c` |
| HTML | `.html` |
| CSS | `.css` |
| PHP | `.php` |
| Ruby | `.rb` |
| Go | `.go` |
| TypeScript | `.ts` |

## 📊 File Size Limits

- **Single File**: Up to 250 MB
- **ZIP File**: Up to 250 MB
- **GitHub Repository**: No size limit (subject to GitHub API limits)

## 🛡️ Security Features

- **Per-file Analysis**: Each code file is analyzed individually for precise vulnerability detection
- **Rate Limiting**: Built-in delays to respect API limits
- **Temporary File Cleanup**: Automatic cleanup of uploaded files after processing
- **CORS Protection**: Secure cross-origin resource sharing configuration

## 🐛 Troubleshooting

### Common Issues

1. **Backend not starting**:
   - Ensure virtual environment is activated
   - Check if port 5000 is available
   - Verify GOOGLE_API_KEY is set correctly

2. **Frontend build errors**:
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility

3. **API connection issues**:
   - Verify backend is running on port 5000
   - Check CORS configuration
   - Ensure frontend is configured to connect to correct backend URL

4. **File upload issues**:
   - Ensure ZIP file is not corrupted
   - Check file size limits
   - Verify file contains supported code files

### Getting Help

If you encounter issues:
1. Check the browser console for frontend errors
2. Check the terminal for backend error messages
3. Ensure all environment variables are properly configured
4. Verify all dependencies are installed correctly

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📝 API Documentation

### Endpoints

#### POST /api/scan
Scan code for security vulnerabilities.

**Request (ZIP file)**:
```bash
curl -X POST http://localhost:5000/api/scan \
  -F "file=@your-code.zip"
```

**Request (GitHub URL)**:
```bash
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"github_url": "https://github.com/user/repo"}'
```

**Response**:
```json
{
  "scan_info": "Successfully scanned 15 files.",
  "overall_score": 85,
  "metrics": {
    "code_complexity": "N/A (Per-file scan)",
    "duplication_percentage": "N/A (Per-file scan)",
    "vulnerable_dependencies": "N/A (Per-file scan)"
  },
  "issues": [
    {
      "severity": "High",
      "description": "SQL injection vulnerability detected",
      "suggestion": "Use parameterized queries instead of string concatenation",
      "file": "src/database.py"
    }
  ]
}
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Generative AI (Gemini) for powering the security analysis
- Material-UI for the beautiful component library
- Chart.js for data visualization
- React community for the amazing ecosystem

---

<div align="center">
  <p>Built with ❤️ for secure coding</p>
  <p>Star this repo if you found it helpful! ⭐</p>
</div>
