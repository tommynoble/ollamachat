#!/usr/bin/env python3
"""
Super Simple Visible Ollama Chat GUI
A minimal GUI that will definitely work and be visible
"""

import tkinter as tk
from tkinter import scrolledtext
import threading
import os
from ollama_chat import OllamaChat

class SuperSimpleGUI:
    def __init__(self):
        # Create root window
        self.root = tk.Tk()
        self.root.title("🤖 OLLAMA CHAT - WORKING! 🤖")
        
        # Make window large and centered
        self.root.geometry("1000x800+100+100")
        
        # Force window to be visible and on top
        self.root.attributes('-topmost', True)
        self.root.lift()
        self.root.focus_force()
        
        # Make window bright so it's obvious
        self.root.configure(bg='#FF0000')  # Bright red background
        
        # Initialize chat app
        try:
            self.chat_app = OllamaChat()
            print("✅ Chat app initialized successfully!")
        except Exception as e:
            print(f"⚠️ Error initializing chat app: {e}")
            self.chat_app = None
        
        self.create_widgets()
        
        # Remove topmost after 3 seconds
        self.root.after(3000, lambda: self.root.attributes('-topmost', False))

    def create_widgets(self):
        # Create main container with padding
        main_frame = tk.Frame(self.root, bg='#FFFFFF', relief=tk.RAISED, bd=5)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Big obvious title
        title_label = tk.Label(main_frame, 
                              text="🚀 OLLAMA CHAT IS NOW WORKING! 🚀", 
                              font=("Arial", 24, "bold"), 
                              bg='#00FF00', 
                              fg='#000000',
                              pady=20)
        title_label.pack(fill=tk.X, padx=10, pady=10)
        
        # Status label
        self.status_label = tk.Label(main_frame, 
                                    text="✅ Ready to chat! Type below and click SEND", 
                                    font=("Arial", 16, "bold"), 
                                    bg='#FFFF00', 
                                    fg='#000000',
                                    pady=10)
        self.status_label.pack(fill=tk.X, padx=10, pady=(0,10))
        
        # Chat area with bright border
        chat_frame = tk.Frame(main_frame, bg='#0000FF', relief=tk.RAISED, bd=3)
        chat_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0,10))
        
        self.chat_area = scrolledtext.ScrolledText(chat_frame, 
                                                  wrap=tk.WORD,
                                                  font=("Arial", 14),
                                                  bg='#F0F0F0',
                                                  fg='#000000',
                                                  height=20)
        self.chat_area.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Add welcome message
        welcome_msg = """🎉 OLLAMA CHAT GUI IS WORKING! 🎉

✅ You can see this window!
✅ The GUI is functional!
✅ Ready to chat with AI!

Instructions:
1. Type your message in the input box below
2. Click the SEND button or press Enter
3. Wait for the AI response

Try asking: "Hello, can you help me with coding?"

"""
        self.chat_area.insert(tk.END, welcome_msg)
        
        # Input area with bright colors
        input_frame = tk.Frame(main_frame, bg='#FF00FF', relief=tk.RAISED, bd=3)
        input_frame.pack(fill=tk.X, padx=10, pady=(0,10))
        
        # Input label
        input_label = tk.Label(input_frame, 
                              text="Type your message here:", 
                              font=("Arial", 14, "bold"), 
                              bg='#FF00FF', 
                              fg='#FFFFFF')
        input_label.pack(anchor=tk.W, padx=10, pady=(10,5))
        
        # Input field container
        input_container = tk.Frame(input_frame, bg='#FF00FF')
        input_container.pack(fill=tk.X, padx=10, pady=(0,10))
        
        self.input_var = tk.StringVar()
        self.input_field = tk.Entry(input_container, 
                                   textvariable=self.input_var,
                                   font=("Arial", 16),
                                   bg='#FFFFFF',
                                   fg='#000000',
                                   relief=tk.RAISED,
                                   bd=2)
        self.input_field.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0,10))
        self.input_field.bind('<Return>', self.send_message_event)
        self.input_field.focus_set()
        
        # Send button - huge and obvious
        self.send_button = tk.Button(input_container, 
                                    text="SEND MESSAGE 🚀", 
                                    command=self.send_message,
                                    font=("Arial", 16, "bold"),
                                    bg='#00FF00',
                                    fg='#000000',
                                    relief=tk.RAISED,
                                    bd=3,
                                    width=15,
                                    height=2)
        self.send_button.pack(side=tk.RIGHT)

    def send_message_event(self, event):
        self.send_message()

    def send_message(self):
        message = self.input_var.get().strip()
        if not message:
            self.status_label.config(text="⚠️ Please type a message first!", bg='#FF0000')
            return
        
        # Clear input
        self.input_var.set("")
        
        # Add user message to chat
        self.chat_area.insert(tk.END, f"\n👤 You: {message}\n")
        self.chat_area.see(tk.END)
        
        # Update status
        self.status_label.config(text="🤔 AI is thinking... please wait...", bg='#FFA500')
        self.send_button.config(state=tk.DISABLED, text="THINKING... 🤔", bg='#CCCCCC')
        
        # Get response in thread
        def get_response():
            try:
                if self.chat_app:
                    print(f"Sending message: {message}")
                    response = self.chat_app.send_message(message)
                    print(f"Got response: {response[:100]}...")
                    self.root.after(0, self.display_response, response)
                else:
                    self.root.after(0, self.display_response, "❌ Error: Chat app not initialized. Please check if Ollama is installed and running.")
            except Exception as e:
                error_msg = f"❌ Error: {str(e)}"
                print(f"Error getting response: {error_msg}")
                self.root.after(0, self.display_response, error_msg)
        
        threading.Thread(target=get_response, daemon=True).start()

    def display_response(self, response):
        # Add response to chat
        self.chat_area.insert(tk.END, f"🤖 AI Assistant: {response}\n")
        self.chat_area.insert(tk.END, "-" * 50 + "\n")
        self.chat_area.see(tk.END)
        
        # Reset status
        self.status_label.config(text="✅ Response received! Ready for next message.", bg='#00FF00')
        self.send_button.config(state=tk.NORMAL, text="SEND MESSAGE 🚀", bg='#00FF00')
        
        # Focus back to input
        self.input_field.focus_set()

    def run(self):
        print("🚀 Starting Super Simple Ollama Chat GUI...")
        print("📱 Look for a BRIGHT COLORFUL window on your screen!")
        print("🌈 The window has RED borders and colorful sections!")
        self.root.mainloop()

if __name__ == "__main__":
    try:
        app = SuperSimpleGUI()
        app.run()
    except Exception as e:
        print(f"❌ Error starting GUI: {e}")
        import traceback
        traceback.print_exc() 