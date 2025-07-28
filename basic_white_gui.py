#!/usr/bin/env python3
"""
Basic White GUI for Ollama Chat
Simple white interface that should definitely be visible
"""

import tkinter as tk
from tkinter import scrolledtext, messagebox
import threading
from ollama_chat import OllamaChat

class BasicWhiteGUI:
    def __init__(self):
        # Create root window
        self.root = tk.Tk()
        self.root.title("OLLAMA CHAT")
        
        # Set window size and position
        self.root.geometry("800x600+200+100")
        
        # Set to white background
        self.root.configure(bg='white')
        
        # Force window visible
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after(1000, lambda: self.root.attributes('-topmost', False))
        
        # Initialize chat app
        try:
            self.chat_app = OllamaChat()
            self.init_success = True
        except Exception as e:
            print(f"Error: {e}")
            self.init_success = False
            self.chat_app = None
        
        self.create_widgets()

    def create_widgets(self):
        # Title
        title = tk.Label(self.root, 
                        text="OLLAMA CHAT GUI", 
                        font=("Arial", 20, "bold"),
                        bg='white', 
                        fg='black')
        title.pack(pady=10)
        
        # Status
        status_text = "Ready to chat!" if self.init_success else "Error: Check Ollama installation"
        self.status = tk.Label(self.root, 
                              text=status_text,
                              font=("Arial", 12),
                              bg='white', 
                              fg='green' if self.init_success else 'red')
        self.status.pack(pady=5)
        
        # Chat area
        chat_frame = tk.Frame(self.root, bg='white')
        chat_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        tk.Label(chat_frame, text="Chat History:", font=("Arial", 12, "bold"), bg='white', fg='black').pack(anchor='w')
        
        self.chat_text = scrolledtext.ScrolledText(
            chat_frame,
            width=80,
            height=20,
            font=("Arial", 11),
            bg='white',
            fg='black',
            insertbackground='black',
            relief=tk.SOLID,
            bd=2
        )
        self.chat_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Add initial message
        self.chat_text.insert('1.0', "Welcome to Ollama Chat!\nType your message below and click Send.\n\n")
        
        # Input area
        input_frame = tk.Frame(self.root, bg='white')
        input_frame.pack(fill=tk.X, padx=20, pady=10)
        
        tk.Label(input_frame, text="Your message:", font=("Arial", 12, "bold"), bg='white', fg='black').pack(anchor='w')
        
        # Input field and button container
        entry_frame = tk.Frame(input_frame, bg='white')
        entry_frame.pack(fill=tk.X, pady=5)
        
        self.message_var = tk.StringVar()
        self.message_entry = tk.Entry(
            entry_frame,
            textvariable=self.message_var,
            font=("Arial", 12),
            bg='white',
            fg='black',
            insertbackground='black',
            relief=tk.SOLID,
            bd=2
        )
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.message_entry.bind('<Return>', self.send_message_enter)
        
        self.send_btn = tk.Button(
            entry_frame,
            text="SEND MESSAGE",
            command=self.send_message,
            font=("Arial", 12, "bold"),
            bg='lightblue',
            fg='black',
            relief=tk.RAISED,
            bd=3,
            width=15
        )
        self.send_btn.pack(side=tk.RIGHT)
        
        # Focus on input
        self.message_entry.focus_set()

    def send_message_enter(self, event):
        self.send_message()

    def send_message(self):
        if not self.init_success:
            messagebox.showerror("Error", "Chat app not initialized. Please check Ollama installation.")
            return
            
        message = self.message_var.get().strip()
        if not message:
            messagebox.showwarning("Warning", "Please enter a message!")
            return
        
        # Clear input
        self.message_var.set("")
        
        # Add user message
        self.chat_text.insert(tk.END, f"You: {message}\n")
        self.chat_text.see(tk.END)
        
        # Update status and button
        self.status.config(text="AI is thinking...", fg='orange')
        self.send_btn.config(state='disabled', text="THINKING...")
        
        # Get AI response in background
        def get_response():
            try:
                response = self.chat_app.send_message(message)
                self.root.after(0, self.display_response, response)
            except Exception as e:
                error_msg = f"Error: {str(e)}"
                self.root.after(0, self.display_response, error_msg)
        
        threading.Thread(target=get_response, daemon=True).start()

    def display_response(self, response):
        # Add AI response
        self.chat_text.insert(tk.END, f"AI: {response}\n\n")
        self.chat_text.see(tk.END)
        
        # Reset status and button
        self.status.config(text="Ready to chat!", fg='green')
        self.send_btn.config(state='normal', text="SEND MESSAGE")
        
        # Focus back to input
        self.message_entry.focus_set()

    def run(self):
        print("Starting basic white GUI...")
        print("Look for a white window with black text!")
        self.root.mainloop()

def main():
    try:
        gui = BasicWhiteGUI()
        gui.run()
    except Exception as e:
        print(f"GUI Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 