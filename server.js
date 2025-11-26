
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for large files

// --- API ROUTES ---

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  console.log(`Criando diretório de dados: ${DATA_DIR}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize DB file if not exists
if (!fs.existsSync(DB_FILE)) {
  console.log(`Inicializando banco de dados em: ${DB_FILE}`);
  fs.writeFileSync(DB_FILE, JSON.stringify({ files: [], messages: [] }, null, 2));
}

// Helper to read DB
const readDb = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
        return { files: [], messages: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading DB:", err);
    return { files: [], messages: [] };
  }
};

// Helper to write DB
const writeDb = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing DB:", err);
    return false;
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Gonçalinho API Online', storage: DB_FILE });
});

// GET Files
app.get('/files', (req, res) => {
  const db = readDb();
  res.json(db.files);
});

// POST File
app.post('/files', (req, res) => {
  const newFile = req.body;
  if (!newFile || !newFile.id) {
    return res.status(400).json({ error: 'Invalid file data' });
  }

  const db = readDb();
  db.files.push(newFile);
  writeDb(db);

  console.log(`File added: ${newFile.name}`);
  res.status(201).json(newFile);
});

// DELETE File
app.delete('/files/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  
  const initialLength = db.files.length;
  db.files = db.files.filter(f => f.id !== id);
  
  if (db.files.length === initialLength) {
    return res.status(404).json({ error: 'File not found' });
  }

  writeDb(db);
  console.log(`File deleted: ${id}`);
  res.json({ success: true });
});

// GET Messages
app.get('/messages', (req, res) => {
  const db = readDb();
  res.json(db.messages);
});

// POST Message
app.post('/messages', (req, res) => {
  const newMessage = req.body;
  if (!newMessage || !newMessage.id) {
    return res.status(400).json({ error: 'Invalid message data' });
  }

  const db = readDb();
  db.messages.push(newMessage);
  writeDb(db);

  res.status(201).json(newMessage);
});

// --- SERVING FRONTEND ---
// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database location: ${DB_FILE}`);
});
