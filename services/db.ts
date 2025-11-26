import { UploadedFile, Message } from '../types';
import Dexie, { type Table } from 'dexie';

// --- CONFIGURAÇÃO DA API ---
const ENV_API_URL = (import.meta as any).env?.VITE_API_URL;
const BASE_API_URL = ENV_API_URL || ''; 

// --- CONFIGURAÇÃO DO DEXIE (LOCAL DB - APENAS BACKUP) ---
class LocalDatabase extends Dexie {
  files!: Table<UploadedFile, string>;
  
  constructor() {
    super('GoncalinhoDB');
    (this as any).version(1).stores({
      files: 'id, timestamp, category',
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
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        return await response.json();
      }
      return null;

    } catch (error) {
      console.warn(`Falha na conexão com servidor (${endpoint}):`, error);
      this.isOffline = true;
      throw error; 
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
      // Se falhar, salva local e avisa
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
}

export const db = new DatabaseService();
