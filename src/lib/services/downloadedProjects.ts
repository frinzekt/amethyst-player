import { browser } from '$app/environment';

export interface DownloadedProject {
  id: string;
  name: string;
  author: string;
  downloadedAt: string;
  lastPlayedAt?: string;
  playCount: number;
  file: File;
}

class DownloadedProjectsService {
  private readonly STORAGE_KEY = 'amethyst_downloaded_projects';
  private readonly DB_NAME = 'AmethystProjectFiles';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'projectFiles';
  private dbPromise: Promise<IDBDatabase> | null = null;

  // Get all downloaded projects (metadata only)
  getDownloadedProjects(): DownloadedProject[] {
    if (!browser) return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const projects = JSON.parse(stored);
      
      // Add backward compatibility for existing projects
      return projects.map((project: any) => ({
        ...project,
        playCount: project.playCount || 0,
        lastPlayedAt: project.lastPlayedAt || undefined
      }));
    } catch (error) {
      console.error('Error reading downloaded projects:', error);
      return [];
    }
  }

  // Check if a project is already downloaded
  isProjectDownloaded(projectId: string): boolean {
    return this.getDownloadedProjects().some(p => p.id === projectId);
  }

  // Add a project to downloaded list and store its file
  async addDownloadedProject(projectId: string, name: string, author: string, file: File): Promise<void> {
    if (!browser) return;

    try {
      const downloadedProjects = this.getDownloadedProjects();
      
      // Remove if already exists
      const filtered = downloadedProjects.filter(p => p.id !== projectId);
      
      // Add new entry
      const newProject: DownloadedProject = {
        id: projectId,
        name,
        author,
        downloadedAt: new Date().toISOString(),
        lastPlayedAt: undefined,
        playCount: 0,
        file: file // Note: File object will be stored as metadata, actual file data stored separately
      };
      
      filtered.push(newProject);
      
      // Store metadata
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      
      // Store file data separately using FileReader
      await this.storeFileData(projectId, file);
      
    } catch (error) {
      console.error('Error adding downloaded project:', error);
    }
  }

  // Initialize IndexedDB
  private async initDB(): Promise<IDBDatabase> {
    if (!browser) throw new Error('IndexedDB not available');
    
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
        
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          }
        };
      });
    }
    
    return this.dbPromise;
  }

  // Store file data in IndexedDB
  private async storeFileData(projectId: string, file: File): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const fileData = {
        id: projectId,
        name: file.name,
        type: file.type,
        size: file.size,
        file: file // Store the actual File object
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(fileData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to store file in IndexedDB'));
      });
    } catch (error) {
      console.error('Error storing file in IndexedDB:', error);
      throw error;
    }
  }

  // Get stored file for a project
  async getProjectFile(projectId: string): Promise<File | null> {
    if (!browser) return null;

    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      return new Promise<File | null>((resolve, reject) => {
        const request = store.get(projectId);
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.file) {
            console.log('Retrieved file from IndexedDB:', result.name);
            resolve(result.file);
          } else {
            console.log('No file found in IndexedDB for project:', projectId);
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('Error retrieving file from IndexedDB');
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Error accessing IndexedDB:', error);
      return null;
    }
  }

  // Update project play statistics
  updatePlayStats(projectId: string): void {
    if (!browser) return;

    try {
      const downloadedProjects = this.getDownloadedProjects();
      const projectIndex = downloadedProjects.findIndex(p => p.id === projectId);
      
      if (projectIndex !== -1) {
        downloadedProjects[projectIndex].lastPlayedAt = new Date().toISOString();
        downloadedProjects[projectIndex].playCount = (downloadedProjects[projectIndex].playCount || 0) + 1;
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(downloadedProjects));
      }
    } catch (error) {
      console.error('Error updating play stats:', error);
    }
  }

  // Get downloaded projects sorted by last played (never played last)
  getDownloadedProjectsSorted(): DownloadedProject[] {
    const projects = this.getDownloadedProjects();
    
    return projects.sort((a, b) => {
      // Projects that have been played come first
      if (a.lastPlayedAt && !b.lastPlayedAt) return -1;
      if (!a.lastPlayedAt && b.lastPlayedAt) return 1;
      
      // If both have been played, sort by most recent
      if (a.lastPlayedAt && b.lastPlayedAt) {
        return new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime();
      }
      
      // If neither have been played, sort by download date (most recent first)
      return new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime();
    });
  }

  // Remove a downloaded project
  async removeDownloadedProject(projectId: string): Promise<void> {
    if (!browser) return;

    try {
      // Remove from metadata
      const downloadedProjects = this.getDownloadedProjects();
      const filtered = downloadedProjects.filter(p => p.id !== projectId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      
      // Remove from IndexedDB
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(projectId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to remove file from IndexedDB'));
      });
    } catch (error) {
      console.error('Error removing downloaded project:', error);
    }
  }

  // Clear all downloaded projects
  async clearAllDownloaded(): Promise<void> {
    if (!browser) return;

    try {
      // Clear metadata
      localStorage.removeItem(this.STORAGE_KEY);
      
      // Clear IndexedDB
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to clear IndexedDB'));
      });
    } catch (error) {
      console.error('Error clearing downloaded projects:', error);
    }
  }
}

export const downloadedProjectsService = new DownloadedProjectsService();