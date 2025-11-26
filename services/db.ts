import { UploadedFile, Message } from '../types';
import Dexie, { type Table } from 'dexie';

// --- CONFIGURAÇÃO DA API ---
// No Docker/Produção, a API está no mesmo host (caminho relativo)
// No Local, tentamos usar a variável ou localhost
const ENV_API_URL = (import.meta as any).env?.VITE_API_URL;
const BASE_API_URL = ENV_API_URL || ''; // Vazio = relativo (mesmo domínio)

// --- CONFIGURAÇÃO DO DEXIE (LOCAL DB) ---
class LocalDatabase extends Dexie {
  files!: Table<UploadedFile, string>;
  messages!: Table<Message, string>;

  constructor() {
    super('GoncalinhoDB');
    // Using cast to avoid TypeScript error 'Property version does not exist on type LocalDatabase'
    // This can happen due to Dexie type definition mismatches in some environments
    (this as any).version(1).stores({
      files: 'id, timestamp, category',
      messages: 'id, timestamp'
    });
  }
}

const localDb = new LocalDatabase();

// --- CLASSE HÍBRIDA ---
class HybridDatabase {
  private useLocal: boolean = false;
  
  constructor() {
    // Se estiver rodando em localhost sem porta definida, pode assumir local dev
    // Mas vamos deixar a detecção automática baseada em erro
  }

  // Helper para verificar status
  getConnectionStatus(): 'cloud' | 'local' {
    return this.useLocal ? 'local' : 'cloud';
  }

  // --- ARQUIVOS ---

  async getAllFiles(): Promise<UploadedFile[]> {
    try {
      if (this.useLocal) throw new Error("Force Local");
      
      const response = await fetch(`${BASE_API_URL}/files`);
      if (!response.ok) throw new Error('Falha API');
      return await response.json();
    } catch (error) {
      console.warn("API offline, using Local DB for Files");
      this.useLocal = true;
      return await localDb.files.toArray();
    }
  }

  async addFile(file: UploadedFile): Promise<void> {
    try {
      if (this.useLocal) throw new Error("Force Local");

      const response = await fetch(`${BASE_API_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      });
      if (!response.ok) throw new Error('Falha API');
    } catch (error) {
      console.warn("API offline, saving File locally");
      this.useLocal = true;
      await localDb.files.add(file);
    }
  }

  async deleteFile(id: string): Promise<void> {
    try {
      if (this.useLocal) throw new Error("Force Local");

      const response = await fetch(`${BASE_API_URL}/files/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Falha API');
    } catch (error) {
      this.useLocal = true;
      await localDb.files.delete(id);
    }
  }

  // --- MENSAGENS ---

  async getAllMessages(): Promise<Message[]> {
    try {
      if (this.useLocal) throw new Error("Force Local");

      const response = await fetch(`${BASE_API_URL}/messages`);
      if (!response.ok) throw new Error('Falha API');
      return await response.json();
    } catch (error) {
      console.warn("API offline, using Local DB for Messages");
      this.useLocal = true;
      return await localDb.messages.orderBy('timestamp').toArray();
    }
  }

  async addMessage(message: Message): Promise<void> {
    try {
      if (this.useLocal) throw new Error("Force Local");

      const response = await fetch(`${BASE_API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      if (!response.ok) throw new Error('Falha API');
    } catch (error) {
      this.useLocal = true;
      await localDb.messages.add(message);
    }
  }
}

export const db = new HybridDatabase();