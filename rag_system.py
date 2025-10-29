#!/usr/bin/env python3
"""
RAG (Retrieval-Augmented Generation) System for Ollama Chat
Handles document upload, embedding, storage, and retrieval
"""

import os
import json
import warnings
from typing import List, Dict, Optional

# Suppress urllib3 warnings
warnings.filterwarnings('ignore', message='urllib3')
warnings.filterwarnings('ignore')

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader


class RAGSystem:
    """Manages document storage and retrieval for RAG"""
    
    def __init__(self, persist_directory: str = "./chroma_db"):
        """Initialize RAG system with ChromaDB and embedding model"""
        self.persist_directory = persist_directory
        
        # Initialize ChromaDB client
        self.client = chromadb.Client(Settings(
            persist_directory=persist_directory,
            anonymized_telemetry=False
        ))
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"description": "User uploaded documents for RAG"}
        )
        
        # Initialize embedding model (lightweight and fast)
        # Suppress output to keep clean for IPC
        import warnings
        warnings.filterwarnings('ignore')
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file"""
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")
    
    def extract_text_from_file(self, file_path: str) -> str:
        """Extract text from various file types"""
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Image files - not yet supported
        if file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']:
            raise Exception(f"Image files not yet supported. OCR functionality coming soon!")
        
        if file_ext == '.pdf':
            return self.extract_text_from_pdf(file_path)
        elif file_ext == '.csv':
            # Read CSV and convert to readable format
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                if not content.strip():
                    raise Exception("CSV file is empty")
                # Format CSV nicely for embedding
                lines = content.split('\n')
                # Keep first 200 lines for better context
                formatted = "CSV Data:\n" + "\n".join([line for line in lines[:200] if line.strip()])
                return formatted if formatted else "CSV Data: Empty file"
            except Exception as e:
                raise Exception(f"Error reading CSV: {str(e)}")
        elif file_ext in ['.txt', '.md', '.json', '.py', '.js', '.ts', '.tsx', '.jsx']:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            raise Exception(f"Unsupported file type: {file_ext}")
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks"""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk:
                chunks.append(chunk)
        
        return chunks
    
    def add_document(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Add a document to the RAG system"""
        try:
            # Extract text
            text = self.extract_text_from_file(file_path)
            
            # Chunk text
            chunks = self.chunk_text(text)
            
            # Generate embeddings
            embeddings = self.embedding_model.encode(chunks).tolist()
            
            # Prepare metadata
            file_name = os.path.basename(file_path)
            doc_metadata = metadata or {}
            doc_metadata['file_name'] = file_name
            doc_metadata['file_path'] = file_path
            doc_metadata['chunks_count'] = len(chunks)
            
            # Generate IDs
            doc_id = file_name.replace(' ', '_').replace('.', '_')
            ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
            
            # Add to collection
            self.collection.add(
                embeddings=embeddings,
                documents=chunks,
                metadatas=[{**doc_metadata, 'chunk_index': i} for i in range(len(chunks))],
                ids=ids
            )
            
            return {
                'success': True,
                'file_name': file_name,
                'chunks': len(chunks),
                'message': f'Successfully added {file_name} with {len(chunks)} chunks'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def search(self, query: str, n_results: int = 3) -> List[Dict]:
        """Search for relevant document chunks"""
        try:
            # Generate query embedding
            query_embedding = self.embedding_model.encode([query])[0].tolist()
            
            # Search collection
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results
            )
            
            # Format results
            formatted_results = []
            if results['documents'] and len(results['documents']) > 0:
                for i, doc in enumerate(results['documents'][0]):
                    formatted_results.append({
                        'text': doc,
                        'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                        'distance': results['distances'][0][i] if results['distances'] else 0
                    })
            
            return formatted_results
            
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    def get_context_for_query(self, query: str, n_results: int = 3) -> str:
        """Get formatted context for a query"""
        results = self.search(query, n_results)
        
        if not results:
            return ""
        
        context = "Relevant information from your documents:\n\n"
        for i, result in enumerate(results, 1):
            file_name = result['metadata'].get('file_name', 'Unknown')
            context += f"[Source {i}: {file_name}]\n{result['text']}\n\n"
        
        return context
    
    def list_documents(self) -> List[Dict]:
        """List all uploaded documents"""
        try:
            # Get all items
            all_items = self.collection.get()
            
            # Extract unique documents
            docs = {}
            if all_items['metadatas']:
                for metadata in all_items['metadatas']:
                    file_name = metadata.get('file_name')
                    if file_name and file_name not in docs:
                        docs[file_name] = {
                            'file_name': file_name,
                            'file_path': metadata.get('file_path', ''),
                            'chunks_count': metadata.get('chunks_count', 0)
                        }
            
            return list(docs.values())
            
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []
    
    def delete_document(self, file_name: str) -> Dict:
        """Delete a document and all its chunks"""
        try:
            # Get all IDs for this document
            doc_id = file_name.replace(' ', '_').replace('.', '_')
            
            # Get all items
            all_items = self.collection.get()
            
            # Find IDs to delete
            ids_to_delete = []
            if all_items['ids']:
                for id in all_items['ids']:
                    if id.startswith(doc_id):
                        ids_to_delete.append(id)
            
            if ids_to_delete:
                self.collection.delete(ids=ids_to_delete)
                return {
                    'success': True,
                    'message': f'Deleted {file_name} ({len(ids_to_delete)} chunks)'
                }
            else:
                return {
                    'success': False,
                    'error': 'Document not found'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# CLI interface for IPC handlers
if __name__ == "__main__":
    import sys
    import warnings
    
    # Suppress warnings to keep output clean
    warnings.filterwarnings('ignore')
    
    try:
        rag = RAGSystem()
        
        if len(sys.argv) < 2:
            sys.exit(0)
        
        command = sys.argv[1]
        
        if command == 'add' and len(sys.argv) >= 3:
            file_path = sys.argv[2]
            result = rag.add_document(file_path)
            print(json.dumps(result))
        
        elif command == 'list':
            documents = rag.list_documents()
            print(json.dumps(documents))
        
        elif command == 'delete' and len(sys.argv) >= 3:
            file_name = sys.argv[2]
            result = rag.delete_document(file_name)
            print(json.dumps(result))
        
        elif command == 'search' and len(sys.argv) >= 3:
            query = sys.argv[2]
            n_results = int(sys.argv[3]) if len(sys.argv) >= 4 else 3
            results = rag.search(query, n_results)
            print(json.dumps(results))
        
        elif command == 'context' and len(sys.argv) >= 3:
            query = sys.argv[2]
            n_results = int(sys.argv[3]) if len(sys.argv) >= 4 else 3
            context = rag.get_context_for_query(query, n_results)
            print(json.dumps({'context': context}))
        
        else:
            print(json.dumps({'error': 'Invalid command'}))
            sys.exit(1)
    
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
