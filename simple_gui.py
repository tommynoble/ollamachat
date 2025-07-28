#!/usr/bin/env python3
"""
Simple Ollama Chat GUI - Basic version without OllamaChat dependency
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import requests

class SimpleOllamaGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Simple Ollama Chat GUI")
        self.root.geometry("700x600")
        self.root.minsize(500, 400)
        
        # Simple configuration
        self.api_base_url = "http://localhost:11434"
        self.model = "llama2"
        self.temperature = 0.7
        
        self.create_widgets()
        self.update_status()

    def create_widgets(self):
        # Top frame with status
        top_frame = ttk.Frame(self.root)
        top_frame.pack(fill=tk.X, padx=8, pady=4)
        
        ttk.Label(top_frame, text="Status:").pack(side=tk.LEFT)
        self.status_label = ttk.Label(top_frame, text="Checking...", foreground="orange")
        self.status_label.pack(side=tk.LEFT, padx=4)
        
        ttk.Label(top_frame, text="Model:").pack(side=tk.LEFT, padx=(20,0))
        self.model_var = tk.StringVar(value=self.model)
        self.model_entry = ttk.Entry(top_frame, textvariable=self.model_var, width=15)
        self.model_entry.pack(side=tk.LEFT, padx=4)
        
        ttk.Label(top_frame, text="Temp:").pack(side=tk.LEFT, padx=(20,0))
        self.temp_var = tk.DoubleVar(value=self.temperature)
        self.temp_spin = ttk.Spinbox(top_frame, from_=0.0, to=1.5, increment=0.1, 
                                    textvariable=self.temp_var, width=5)
        self.temp_spin.pack(side=tk.LEFT, padx=4)
        
        # Chat area
        self.chat_text = scrolledtext.ScrolledText(self.root, wrap=tk.WORD, height=25)
        self.chat_text.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
        
        # Input area
        input_frame = ttk.Frame(self.root)
        input_frame.pack(fill=tk.X, padx=8, pady=4)
        
        self.input_var = tk.StringVar()
        self.input_entry = ttk.Entry(input_frame, textvariable=self.input_var)
        self.input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,8))
        self.input_entry.bind("<Return>", self.send_message)
        
        send_btn = ttk.Button(input_frame, text="Send", command=self.send_message)
        send_btn.pack(side=tk.LEFT)
        
        # Add initial message
        self.append_message("System", "GUI loaded successfully! Type a message to start chatting.")

    def update_status(self):
        try:
            response = requests.get(f"{self.api_base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                self.status_label.config(text="Online", foreground="green")
            else:
                self.status_label.config(text="Error", foreground="red")
        except:
            self.status_label.config(text="Offline", foreground="red")
        
        # Update every 5 seconds
        self.root.after(5000, self.update_status)

    def append_message(self, sender, message):
        self.chat_text.insert(tk.END, f"{sender}: {message}\n")
        self.chat_text.see(tk.END)

    def send_message(self, event=None):
        message = self.input_var.get().strip()
        if not message:
            return
        
        self.input_var.set("")
        self.append_message("You", message)
        
        # Send in background thread
        threading.Thread(target=self.get_response, args=(message,), daemon=True).start()

    def get_response(self, message):
        try:
            payload = {
                "model": self.model_var.get(),
                "messages": [{"role": "user", "content": message}],
                "stream": False,
                "options": {"temperature": self.temp_var.get()}
            }
            
            response = requests.post(
                f"{self.api_base_url}/api/chat",
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                assistant_message = data.get("message", {}).get("content", "No response")
                self.append_message("Assistant", assistant_message)
            else:
                self.append_message("System", f"Error: {response.status_code}")
                
        except Exception as e:
            self.append_message("System", f"Error: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = SimpleOllamaGUI(root)
    root.mainloop() 