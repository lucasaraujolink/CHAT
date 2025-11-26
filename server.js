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
const PORT = process.env.PORT || 3001;

// Define Data Directory
// Em produção (Docker), isso mapeia para o volume montado
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Limite aumentado para arquivos grandes

// --- DATABASE SETUP ---

const initializeDb = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`[Server] Criando pasta de dados: ${DATA_DIR}`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      console.log(`[Server] Criando arquivo DB: ${DB_FILE}`);
      const initialData = { files: [], messages: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error("[Server] Erro fatal ao inicializar DB:", err);
  }
};

initializeDb();

// Helper to read DB
const readDb = () => {
  try {
    if (!fs.existsSync(DB_FILE)) return { files: [], messages: [] };
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("[Server] Erro leitura DB:", err);
    return { files: [], messages: [] };
  }
};

// Helper to write DB
const writeDb = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("[Server] Erro escrita DB:", err);
    return false;
  }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', dbPath: DB_FILE });
});

app.get('/files', (req, res) => {
  const db = readDb();
  res.json(db.files || []);
});

app.post('/files', (req, res) => {
  const newFile = req.body;
  if (!newFile || !newFile.id) return res.status(400).json({ error: 'Invalid data' });

  const db = readDb();
  // Evita duplicatas
  if (!db.files.some(f => f.id === newFile.id)) {
    db.files.push(newFile);
    writeDb(db);
    console.log(`[Server] Arquivo salvo: ${newFile.name} (Categoria: ${newFile.category})`);
  }
  
  res.status(201).json(newFile);
});

app.delete('/files/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  db.files = db.files.filter(f => f.id !== id);
  writeDb(db);
  console.log(`[Server] Arquivo deletado: ${id}`);
  res.json({ success: true });
});

app.get('/messages', (req, res) => {
  const db = readDb();
  res.json(db.messages || []);
});

app.post('/messages', (req, res) => {
  const newMessage = req.body;
  const db = readDb();
  db.messages.push(newMessage);
  writeDb(db);
  res.status(201).json(newMessage);
});

// --- SERVING FRONTEND ---
// Serve os arquivos estáticos do React (pasta dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Qualquer outra rota retorna o index.html para o React Router funcionar
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Banco de dados: ${DB_FILE}`);
});