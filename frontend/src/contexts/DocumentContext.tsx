import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DocumentItem, DocumentResult } from '../types/document';
import { documentService } from '../services/documentService';

interface DocumentContextType {
  documents: DocumentItem[];
  activeDoc: DocumentResult | null;
  activeDocId: string | null;
  isLoading: boolean;
  error: string | null;
  backendOnline: boolean;
  refreshDocuments: () => Promise<void>;
  loadDocument: (id: string) => Promise<DocumentResult | null>;
  setActiveDoc: (doc: DocumentResult | null) => void;
  deleteDocument: (id: string) => Promise<boolean>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentResult | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);

  const checkHealthAndLoad = useCallback(async () => {
    try {
      await documentService.checkHealth();
      setBackendOnline(true);
      setError(null);
      const docs = await documentService.getDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !activeDoc) {
        // Auto-select most recent completed doc if none selected
        const completed = docs.find((d) => d.status === 'completed');
        if (completed) {
          const full = await documentService.getDocument(completed.id);
          setActiveDoc(full);
          setActiveDocId(completed.id);
        }
      }
    } catch (err: any) {
      setBackendOnline(false);
      setError(err.message || 'Cannot reach FastAPI backend server.');
    }
  }, [activeDoc]);

  useEffect(() => {
    checkHealthAndLoad();
    const interval = setInterval(async () => {
      try {
        await documentService.checkHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [checkHealthAndLoad]);

  const refreshDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs);
      setBackendOnline(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh documents.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocument = async (id: string): Promise<DocumentResult | null> => {
    setIsLoading(true);
    try {
      const doc = await documentService.getDocument(id);
      setActiveDoc(doc);
      setActiveDocId(id);
      setError(null);
      return doc;
    } catch (err: any) {
      setError(err.message || `Failed to load document ${id}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDocument = async (id: string): Promise<boolean> => {
    try {
      await documentService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocId === id) {
        setActiveDoc(null);
        setActiveDocId(null);
      }
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete document.');
      return false;
    }
  };

  return (
    <DocumentContext.Provider
      value={{
        documents,
        activeDoc,
        activeDocId,
        isLoading,
        error,
        backendOnline,
        refreshDocuments,
        loadDocument,
        setActiveDoc,
        deleteDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) throw new Error('useDocuments must be used within DocumentProvider');
  return context;
};
