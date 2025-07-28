#!/usr/bin/env python3
"""
Fixed GUI for macOS Dark Mode
Forces all colors explicitly to ensure visibility
"""

import tkinter as tk
from tkinter import scrolledtext, messagebox
import threading
from ollama_chat import OllamaChat

class FixedGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("OLLAMA CHAT - FIXED VERSION")
        self.root.geometry("900x700+100+100")
        
        # Force light appearance on macOS
        try:
            # This should help with macOS dark mode issues
            self.root.tk.call('tk', 'scaling', 1.0)
        except:
            pass
        
        # Explicitly set ALL colors to override dark mode
        self.root.configure(bg='#F0F0F0')  # Light gray background
        
        # Force window visible
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after(2000, lambda: self.root.attributes('-topmost', False))
        
        # Initialize chat
        try:
            self.chat_app = OllamaChat()
            self.chat_ready = True
        except Exception as e:
            print(f"Chat error: {e}")
            self.chat_ready = False
            self.chat_app = None
        
        self.create_widgets()

    def create_widgets(self):
        # Create all widgets with EXPLICIT colors to override macOS dark mode
        
        # Title frame with forced colors
        title_frame = tk.Frame(self.root, bg='#4A90E2', height=60)
        title_frame.pack(fill=tk.X, padx=10, pady=10)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame,
                              text="OLLAMA CHAT - NOW VISIBLE!",
                              font=("Arial", 20, "bold"),
                              bg='#4A90E2',
                              fg='#FFFFFF')
        title_label.pack(expand=True)
        
        # Status with explicit colors
        status_frame = tk.Frame(self.root, bg='#E8F5E8', height=40)
        status_frame.pack(fill=tk.X, padx=10, pady=(0,10))
        status_frame.pack_propagate(False)
        
        status_text = "✅ Ready to chat!" if self.chat_ready else "❌ Not ready"
        self.status_label = tk.Label(status_frame,
                                    text=status_text,
                                    font=("Arial", 14, "bold"),
                                    bg='#E8F5E8',
                                    fg='#2E7D2E')
        self.status_label.pack(expand=True)
        
        # Chat area with explicit white background
        chat_frame = tk.Frame(self.root, bg='#F0F0F0')
        chat_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0,10))
        
        # Chat label with explicit colors
        chat_label = tk.Label(chat_frame,
                             text="💬 Chat Messages:",
                             font=("Arial", 12, "bold"),
                             bg='#F0F0F0',
                             fg='#333333')
        chat_label.pack(anchor='w', pady=(0,5))
        
        # Chat text with forced white background
        self.chat_area = scrolledtext.ScrolledText(
            chat_frame,
            font=("Monaco", 11),
            bg='#FFFFFF',           # Force white background
            fg='#000000',           # Force black text
            insertbackground='#000000',  # Force black cursor
            selectbackground='#B3D9FF',  # Light blue selection
            selectforeground='#000000',   # Black selected text
            height=20,
            relief=tk.SOLID,
            bd=2,
            highlightthickness=1,
            highlightcolor='#4A90E2'
        )
        self.chat_area.pack(fill=tk.BOTH, expand=True)
        
        # Add welcome message
        welcome = """🎉 SUCCESS! The GUI is now visible!

✅ You can see this text clearly
✅ All colors are working properly
✅ Ready to chat with AI

Instructions:
1. Type your message in the white box below
2. Click the blue SEND button
3. Watch for AI responses here

Try asking: "Hello, can you write a simple website for me?"

---

"""
        self.chat_area.insert('1.0', welcome)
        
        # Input section with explicit colors
        input_frame = tk.Frame(self.root, bg='#F0F0F0')
        input_frame.pack(fill=tk.X, padx=10, pady=10)
        
        # Input label
        input_label = tk.Label(input_frame,
                              text="📝 Type your message here:",
                              font=("Arial", 12, "bold"),
                              bg='#F0F0F0',
                              fg='#333333')
        input_label.pack(anchor='w', pady=(0,8))
        
        # Entry container
        entry_container = tk.Frame(input_frame, bg='#F0F0F0')
        entry_container.pack(fill=tk.X)
        
        # Message entry with explicit white background
        self.message_var = tk.StringVar()
        self.message_entry = tk.Entry(
            entry_container,
            textvariable=self.message_var,
            font=("Arial", 14),
            bg='#FFFFFF',           # Force white background
            fg='#000000',           # Force black text
            insertbackground='#000000',  # Force black cursor
            relief=tk.SOLID,
            bd=2,
            highlightthickness=2,
            highlightcolor='#4A90E2'
        )
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,15))
        self.message_entry.bind('<Return>', self.send_enter)
        
        # Send button with explicit colors
        self.send_button = tk.Button(
            entry_container,
            text="SEND MESSAGE",
            font=("Arial", 14, "bold"),
            bg='#4A90E2',           # Blue background
            fg='#FFFFFF',           # White text
            activebackground='#357ABD',  # Darker blue when clicked
            activeforeground='#FFFFFF',   # White text when clicked
            command=self.send_message,
            relief=tk.RAISED,
            bd=3,
            width=15,
            height=2
        )
        self.send_button.pack(side=tk.RIGHT)
        
        # Focus on input
        self.message_entry.focus_set()

    def send_enter(self, event):
        self.send_message()

    def send_message(self):
        if not self.chat_ready:
            messagebox.showerror("Error", "Chat not ready! Check Ollama installation.")
            return
            
        message = self.message_var.get().strip()
        if not message:
            messagebox.showwarning("Empty Message", "Please type a message first!")
            return
        
        # Clear input
        self.message_var.set("")
        
        # Add user message with explicit formatting
        self.chat_area.insert(tk.END, f"👤 YOU: {message}\n\n")
        self.chat_area.see(tk.END)
        
        # Update status
        self.status_label.config(text="🤔 AI is thinking...", 
                                bg='#FFF3CD', fg='#856404')
        self.send_button.config(state='disabled', text="THINKING...",
                               bg='#CCCCCC', fg='#666666')
        
        # Get AI response
        def get_response():
            try:
                response = self.chat_app.send_message(message)
                self.root.after(0, self.show_response, response)
            except Exception as e:
                error = f"❌ Error: {str(e)}"
                self.root.after(0, self.show_response, error)
        
        threading.Thread(target=get_response, daemon=True).start()

    def show_response(self, response):
        # Add AI response with explicit formatting
        self.chat_area.insert(tk.END, f"🤖 AI ASSISTANT: {response}\n\n")
        self.chat_area.insert(tk.END, "=" * 60 + "\n\n")
        self.chat_area.see(tk.END)
        
        # Reset status and button
        self.status_label.config(text="✅ Ready for your next message!",
                                bg='#E8F5E8', fg='#2E7D2E')
        self.send_button.config(state='normal', text="SEND MESSAGE",
                               bg='#4A90E2', fg='#FFFFFF')
        
        # Focus back to input
        self.message_entry.focus_set()

    def run(self):
        print("🚀 Starting FIXED GUI with explicit colors...")
        print("🎨 This should work properly with macOS dark mode!")
        print("📱 Look for a window with blue title and white text areas!")
        self.root.mainloop()

def main():
    try:
        app = FixedGUI()
        app.run()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 