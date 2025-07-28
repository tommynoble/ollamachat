#!/usr/bin/env python3
"""
Simple Visible Ollama Chat GUI
A minimal GUI that will definitely be visible on screen
"""

import tkinter as tk
from tkinter import scrolledtext, messagebox
import threading
import os
import json
from ollama_chat import OllamaChat

class SimpleVisibleGUI:
    def __init__(self):
        # Create root window
        self.root = tk.Tk()
        self.root.title("🤖 OLLAMA CHAT GUI 🤖")
        
        # Make window large and centered
        window_width = 900
        window_height = 700
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        center_x = int(screen_width/2 - window_width/2)
        center_y = int(screen_height/2 - window_height/2)
        
        self.root.geometry(f'{window_width}x{window_height}+{center_x}+{center_y}')
        
        # Force window to be visible and on top
        self.root.attributes('-topmost', True)
        self.root.lift()
        self.root.focus_force()
        
        # Make window colorful so it's obvious
        self.root.configure(bg='#2E2E2E')
        
        # Initialize chat app
        try:
            self.chat_app = OllamaChat()
            self.models = self.chat_app.get_available_models()
        except Exception as e:
            print(f"Error initializing chat app: {e}")
            self.chat_app = None
            self.models = ['llama2']  # Default model
        
        self.create_widgets()
        
        # Remove topmost after a moment
        self.root.after(2000, lambda: self.root.attributes('-topmost', False))

    def create_widgets(self):
        # Big obvious title
        title_frame = tk.Frame(self.root, bg='#FF6B6B', height=60)
        title_frame.pack(fill=tk.X, padx=5, pady=5)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="🚀 OLLAMA CHAT IS RUNNING! 🚀", 
                              font=("Arial", 20, "bold"), 
                              bg='#FF6B6B', fg='white')
        title_label.pack(expand=True)
        
        # Status frame
        status_frame = tk.Frame(self.root, bg='#4ECDC4', height=40)
        status_frame.pack(fill=tk.X, padx=5, pady=(0,5))
        status_frame.pack_propagate(False)
        
        self.status_label = tk.Label(status_frame, text="✅ Ready to chat!", 
                                    font=("Arial", 14, "bold"), 
                                    bg='#4ECDC4', fg='white')
        self.status_label.pack(expand=True)
        
        # Model selection frame
        model_frame = tk.Frame(self.root, bg='#45B7D1', height=40)
        model_frame.pack(fill=tk.X, padx=5, pady=(0,5))
        model_frame.pack_propagate(False)
        
        tk.Label(model_frame, text="Model:", font=("Arial", 12, "bold"), 
                bg='#45B7D1', fg='white').pack(side=tk.LEFT, padx=10)
        
        self.model_var = tk.StringVar()
        self.model_var.set(self.models[0] if self.models else 'llama2')
        
        model_menu = tk.OptionMenu(model_frame, self.model_var, *self.models)
        model_menu.config(font=("Arial", 12), bg='white')
        model_menu.pack(side=tk.LEFT, padx=10)
        
        # Chat area
        chat_frame = tk.Frame(self.root, bg='#2E2E2E')
        chat_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=(0,5))
        
        self.chat_area = scrolledtext.ScrolledText(chat_frame, 
                                                  wrap=tk.WORD,
                                                  font=("Arial", 12),
                                                  bg='#F8F8F8',
                                                  fg='#333333',
                                                  insertbackground='#333333')
        self.chat_area.pack(fill=tk.BOTH, expand=True)
        
        # Add welcome message
        self.chat_area.insert(tk.END, "🤖 Welcome to Ollama Chat!\n")
        self.chat_area.insert(tk.END, "Type your message below and press Send or Enter.\n\n")
        
        # Input frame
        input_frame = tk.Frame(self.root, bg='#96CEB4', height=80)
        input_frame.pack(fill=tk.X, padx=5, pady=5)
        input_frame.pack_propagate(False)
        
        # Input field
        input_container = tk.Frame(input_frame, bg='#96CEB4')
        input_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.input_var = tk.StringVar()
        self.input_field = tk.Entry(input_container, 
                                   textvariable=self.input_var,
                                   font=("Arial", 14),
                                   bg='white',
                                   fg='#333333')
        self.input_field.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0,10))
        self.input_field.bind('<Return>', self.send_message_event)
        self.input_field.focus_set()
        
        # Send button
        self.send_button = tk.Button(input_container, 
                                    text="SEND 🚀", 
                                    command=self.send_message,
                                    font=("Arial", 14, "bold"),
                                    bg='#FF6B6B',
                                    fg='white',
                                    width=10)
        self.send_button.pack(side=tk.RIGHT)

    def send_message_event(self, event):
        self.send_message()

    def send_message(self):
        message = self.input_var.get().strip()
        if not message:
            return
        
        # Clear input
        self.input_var.set("")
        
        # Add user message to chat
        self.chat_area.insert(tk.END, f"You: {message}\n")
        self.chat_area.see(tk.END)
        
        # Update status
        self.status_label.config(text="🤔 Thinking...")
        self.send_button.config(state=tk.DISABLED, text="THINKING...")
        
        # Get response in thread
        def get_response():
            try:
                if self.chat_app:
                    response = self.chat_app.send_message(message)
                    self.root.after(0, self.display_response, response)
                else:
                    self.root.after(0, self.display_response, "Error: Chat app not initialized")
            except Exception as e:
                self.root.after(0, self.display_response, f"Error: {str(e)}")
        
        threading.Thread(target=get_response, daemon=True).start()

    def display_response(self, response):
        # Add response to chat
        self.chat_area.insert(tk.END, f"🤖 Assistant: {response}\n\n")
        self.chat_area.see(tk.END)
        
        # Reset status
        self.status_label.config(text="✅ Ready to chat!")
        self.send_button.config(state=tk.NORMAL, text="SEND 🚀")
        
        # Focus back to input
        self.input_field.focus_set()

    def run(self):
        print("🚀 Starting Visible Ollama Chat GUI...")
        print("📱 Look for a colorful window on your screen!")
        self.root.mainloop()

if __name__ == "__main__":
    try:
        app = SimpleVisibleGUI()
        app.run()
    except Exception as e:
        print(f"❌ Error starting GUI: {e}")
        import traceback
        traceback.print_exc() 