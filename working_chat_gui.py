#!/usr/bin/env python3
"""
Working Chat GUI - Based on successful test display
"""

import tkinter as tk
from tkinter import scrolledtext, messagebox
import threading
from ollama_chat import OllamaChat

class WorkingChatGUI:
    def __init__(self):
        # Create window just like the working test
        self.root = tk.Tk()
        self.root.title("OLLAMA CHAT - WORKING VERSION")
        self.root.geometry("900x700+200+100")
        self.root.configure(bg='lightgray')
        
        # Force to front like the test
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after(2000, lambda: self.root.attributes('-topmost', False))
        
        # Initialize chat
        try:
            self.chat_app = OllamaChat()
            self.chat_ready = True
            print("✅ Chat app ready!")
        except Exception as e:
            print(f"⚠️ Chat error: {e}")
            self.chat_ready = False
            self.chat_app = None
        
        self.create_interface()

    def create_interface(self):
        # Title - high contrast like the test
        title = tk.Label(self.root,
                        text="OLLAMA CHAT GUI",
                        font=("Arial", 24, "bold"),
                        bg='blue',
                        fg='white',
                        pady=10)
        title.pack(fill=tk.X, padx=10, pady=10)
        
        # Status - clear colors
        status_text = "✅ Ready to chat!" if self.chat_ready else "❌ Chat not ready"
        status_color = 'green' if self.chat_ready else 'red'
        
        self.status_label = tk.Label(self.root,
                                    text=status_text,
                                    font=("Arial", 14, "bold"),
                                    bg='white',
                                    fg=status_color,
                                    pady=5)
        self.status_label.pack(fill=tk.X, padx=10, pady=(0,10))
        
        # Chat area frame
        chat_frame = tk.Frame(self.root, bg='lightgray')
        chat_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0,10))
        
        # Chat label
        chat_label = tk.Label(chat_frame,
                             text="Chat Messages:",
                             font=("Arial", 12, "bold"),
                             bg='lightgray',
                             fg='black')
        chat_label.pack(anchor='w', pady=(0,5))
        
        # Chat text area - simple and clear
        self.chat_area = scrolledtext.ScrolledText(
            chat_frame,
            font=("Arial", 11),
            bg='white',
            fg='black',
            height=20,
            relief=tk.SOLID,
            bd=2
        )
        self.chat_area.pack(fill=tk.BOTH, expand=True)
        
        # Welcome message
        welcome = """🤖 Ollama Chat is Ready!

Instructions:
1. Type your message in the box below
2. Click SEND or press Enter
3. Wait for AI response

Try asking: "Hello, can you help me code a website?"

"""
        self.chat_area.insert('1.0', welcome)
        
        # Input section
        input_frame = tk.Frame(self.root, bg='lightgray')
        input_frame.pack(fill=tk.X, padx=10, pady=10)
        
        # Input label
        input_label = tk.Label(input_frame,
                              text="Type your message:",
                              font=("Arial", 12, "bold"),
                              bg='lightgray',
                              fg='black')
        input_label.pack(anchor='w', pady=(0,5))
        
        # Input entry and button
        entry_frame = tk.Frame(input_frame, bg='lightgray')
        entry_frame.pack(fill=tk.X)
        
        self.message_var = tk.StringVar()
        self.entry = tk.Entry(entry_frame,
                             textvariable=self.message_var,
                             font=("Arial", 12),
                             bg='white',
                             fg='black',
                             relief=tk.SOLID,
                             bd=2)
        self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,10))
        self.entry.bind('<Return>', self.send_enter)
        
        # Send button - just like the working test button
        self.send_button = tk.Button(entry_frame,
                                    text="SEND MESSAGE",
                                    font=("Arial", 12, "bold"),
                                    bg='blue',
                                    fg='white',
                                    command=self.send_message,
                                    relief=tk.RAISED,
                                    bd=3,
                                    width=15)
        self.send_button.pack(side=tk.RIGHT)
        
        # Focus on entry
        self.entry.focus_set()
        
        print("GUI created - look for window with blue title bar")

    def send_enter(self, event):
        self.send_message()

    def send_message(self):
        if not self.chat_ready:
            messagebox.showerror("Error", "Chat system not ready!")
            return
            
        message = self.message_var.get().strip()
        if not message:
            messagebox.showwarning("Warning", "Please type a message!")
            return
        
        # Clear input
        self.message_var.set("")
        
        # Show user message
        self.chat_area.insert(tk.END, f"\n👤 You: {message}\n")
        self.chat_area.see(tk.END)
        
        # Update UI
        self.status_label.config(text="🤔 AI thinking...", fg='orange')
        self.send_button.config(state='disabled', text="THINKING...")
        
        # Get response
        def get_ai_response():
            try:
                response = self.chat_app.send_message(message)
                self.root.after(0, self.show_response, response)
            except Exception as e:
                error = f"Error: {str(e)}"
                self.root.after(0, self.show_response, error)
        
        threading.Thread(target=get_ai_response, daemon=True).start()

    def show_response(self, response):
        # Show AI response
        self.chat_area.insert(tk.END, f"🤖 AI: {response}\n")
        self.chat_area.insert(tk.END, "-" * 40 + "\n")
        self.chat_area.see(tk.END)
        
        # Reset UI
        self.status_label.config(text="✅ Ready for next message!", fg='green')
        self.send_button.config(state='normal', text="SEND MESSAGE")
        self.entry.focus_set()

    def run(self):
        print("🚀 Starting working chat GUI...")
        print("📱 Look for window with BLUE title bar and white chat area!")
        self.root.mainloop()

def main():
    try:
        app = WorkingChatGUI()
        app.run()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 