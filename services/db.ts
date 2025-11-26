import { UploadedFile, Message } from '../types';
import Dexie, { type Table } from 'dexie';

// --- CONFIGURAÇÃO DA API ---
// O Vite substitui import.meta.env durante o build.
// Se VITE_API_URL não estiver definido, usamos string vazia, o que cria URLs relativas (ex: /files)
// URLs relativas funcionam automaticamente tanto no Proxy local quanto no servidor de produção.
const ENV_API_URL = (import.meta as any).env?.VITE_API_URL;
const BASE_API_URL = ENV_API_URL || ''; 

// --- CONFIGURAÇÃO DO DEXIE (LOCAL DB - APENAS BACKUP) ---
class LocalDatabase extends Dexie {
  files!: Table<UploadedFile, string>;
  messages!: Table<Message, string>;

  constructor() {
    super('GoncalinhoDB');
    (this as any).version(1).stores({
      files: 'id, timestamp, category',
      messages: 'id, timestamp'
    });
  }
}

const localDb = new LocalDatabase();

// --- CLASSE DE GERENCIAMENTO DE DADOS ---
class DatabaseService {
  private isOffline: boolean = false;
  
  constructor() {}

  // Retorna se estamos rodando na nuvem ou localmente baseado na última requisição
  getConnectionStatus(): 'cloud' | 'local' {
    return this.isOffline ? 'local' : 'cloud';
  }

  private async tryServer(endpoint: string, options?: RequestInit): Promise<any> {
    try {
      const url = `${BASE_API_URL}${endpoint}`;
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      this.isOffline = false; // Sucesso, servidor está online
      
      // Se tiver conteúdo JSON, retorna. Se for DELETE/sem corpo, retorna null.
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        return await response.json();
      }
      return null;

    } catch (error) {
      console.warn(`Falha na conexão com servidor (${endpoint}):`, error);
      this.isOffline = true;
      throw error; // Repassa o erro para o fallback pegar
    }
  }

  // --- ARQUIVOS ---

  async getAllFiles(): Promise<UploadedFile[]> {
    try {
      // Tenta Nuvem
      const data = await this.tryServer('/files');
      return data;
    } catch (error) {
      // Fallback Local
      return await localDb.files.toArray();
    }
  }

  async addFile(file: UploadedFile): Promise<void> {
    try {
      // Tenta salvar na Nuvem (CRÍTICO para base de conhecimento compartilhada)
      await this.tryServer('/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      });
    } catch (error) {
      // Se falhar, salva local e avisa no console
      console.error("Servidor inacessível. Salvando apenas localmente.");
      await localDb.files.add(file);
    }
  }

  async deleteFile(id: string): Promise<void> {
    try {
      await this.tryServer(`/files/${id}`, { method: 'DELETE' });
    } catch (error) {
      await localDb.files.delete(id);
    }
  }

  // --- MENSAGENS ---

  async getAllMessages(): Promise<Message[]> {
    try {
      return await this.tryServer('/messages');
    } catch (error) {
      return await localDb.messages.orderBy('timestamp').toArray();
    }
  }

  async addMessage(message: Message): Promise<void> {
    // Para mensagens, usamos uma estratégia "otimista".
    // Salvamos localmente imediatamente para a UI ser rápida, e tentamos enviar para o servidor.
    
    // 1. Salva local (garante histórico imediato na sessão)
    await localDb.messages.add(message);

    // 2. Tenta sincronizar com servidor em background
    try {
      await this.tryServer('/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      // Silencioso: se falhar o server, pelo menos está no localDb
    }
  }
}

export const db = new DatabaseService();