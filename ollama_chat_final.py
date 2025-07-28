#!/usr/bin/env python3
"""
Final Ollama Chat GUI - Complete working version with all features
"""

import os
# Suppress the Tk deprecation warning
os.environ['TK_SILENCE_DEPRECATION'] = '1'

import tkinter as tk
import threading
import json
from ollama_chat import OllamaChat

class OllamaChatFinal:
    def __init__(self, root):
        self.root = root
        self.root.title("Ollama Chat - Final Version")
        self.root.geometry("900x700")
        self.root.minsize(700, 500)
        
        # Force window to front
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after_idle(self.root.attributes, '-topmost', False)
        
        # Initialize chat app
        try:
            self.chat_app = OllamaChat()
            self.models = self.chat_app.get_available_models()
        except Exception as e:
            print(f"Error initializing chat app: {e}")
            self.chat_app = None
            self.models = []
        
        self.create_widgets()
        self.update_status()

    def create_widgets(self):
        # Main container
        main_frame = tk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Title bar
        title_btn = tk.Button(main_frame, text="🤖 OLLAMA CHAT GUI", 
                             font=("Arial", 18, "bold"), 
                             bg="#2E86AB", fg="white",
                             relief=tk.FLAT, state=tk.DISABLED)
        title_btn.pack(fill=tk.X, pady=(0, 15))
        
        # Control panel
        control_frame = tk.Frame(main_frame, relief=tk.RAISED, bd=2, bg="#F8F9FA")
        control_frame.pack(fill=tk.X, pady=(0, 15))
        
        # Model selection row
        model_frame = tk.Frame(control_frame, bg="#F8F9FA")
        model_frame.pack(fill=tk.X, padx=10, pady=8)
        
        tk.Button(model_frame, text="📋 Model:", relief=tk.FLAT, state=tk.DISABLED, 
                 bg="#F8F9FA", font=("Arial", 11, "bold")).pack(side=tk.LEFT)
        self.model_var = tk.StringVar(value=self.chat_app.config["model"] if self.chat_app else "llama2")
        self.model_entry = tk.Entry(model_frame, textvariable=self.model_var, width=20, 
                                   font=("Arial", 11))
        self.model_entry.pack(side=tk.LEFT, padx=8)
        
        tk.Button(model_frame, text="🔄 Refresh", command=self.refresh_models,
                 bg="#28A745", fg="white", font=("Arial", 10)).pack(side=tk.LEFT, padx=5)
        
        # Temperature and status row
        config_frame = tk.Frame(control_frame, bg="#F8F9FA")
        config_frame.pack(fill=tk.X, padx=10, pady=8)
        
        tk.Button(config_frame, text="🌡️ Temperature:", relief=tk.FLAT, state=tk.DISABLED,
                 bg="#F8F9FA", font=("Arial", 11, "bold")).pack(side=tk.LEFT)
        self.temp_var = tk.DoubleVar(value=self.chat_app.config["temperature"] if self.chat_app else 0.7)
        self.temp_entry = tk.Entry(config_frame, textvariable=self.temp_var, width=8,
                                  font=("Arial", 11))
        self.temp_entry.pack(side=tk.LEFT, padx=8)
        
        tk.Button(config_frame, text="📊 Status:", relief=tk.FLAT, state=tk.DISABLED,
                 bg="#F8F9FA", font=("Arial", 11, "bold")).pack(side=tk.LEFT, padx=(20,0))
        self.status_var = tk.StringVar(value="Checking...")
        self.status_btn = tk.Button(config_frame, textvariable=self.status_var, 
                                   relief=tk.FLAT, state=tk.DISABLED, bg="#FFC107",
                                   font=("Arial", 11, "bold"))
        self.status_btn.pack(side=tk.LEFT, padx=8)
        
        # System prompt row
        prompt_frame = tk.Frame(control_frame, bg="#F8F9FA")
        prompt_frame.pack(fill=tk.X, padx=10, pady=8)
        
        tk.Button(prompt_frame, text="💬 System Prompt:", relief=tk.FLAT, state=tk.DISABLED,
                 bg="#F8F9FA", font=("Arial", 11, "bold")).pack(side=tk.LEFT)
        self.prompt_var = tk.StringVar(value=self.chat_app.config["system_prompt"] if self.chat_app else "You are a helpful AI assistant.")
        self.prompt_entry = tk.Entry(prompt_frame, textvariable=self.prompt_var, width=50,
                                    font=("Arial", 11))
        self.prompt_entry.pack(side=tk.LEFT, padx=8, fill=tk.X, expand=True)
        
        tk.Button(prompt_frame, text="✅ Set", command=self.set_system_prompt,
                 bg="#17A2B8", fg="white", font=("Arial", 10)).pack(side=tk.LEFT, padx=5)
        
        # Chat area
        chat_frame = tk.Frame(main_frame, relief=tk.SUNKEN, bd=2)
        chat_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        # Chat title
        tk.Button(chat_frame, text="💭 Chat History", relief=tk.FLAT, state=tk.DISABLED,
                 bg="#E9ECEF", font=("Arial", 12, "bold")).pack(fill=tk.X)
        
        # Chat text area with scrollbar
        text_frame = tk.Frame(chat_frame)
        text_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.chat_text = tk.Text(text_frame, wrap=tk.WORD, height=20, state=tk.DISABLED,
                                font=("Arial", 11), bg="white", fg="black")
        self.chat_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        chat_scrollbar = tk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.chat_text.yview)
        chat_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.chat_text.config(yscrollcommand=chat_scrollbar.set)
        
        # Input area
        input_frame = tk.Frame(main_frame)
        input_frame.pack(fill=tk.X, pady=(0, 10))
        
        tk.Button(input_frame, text="✍️ Your Message:", relief=tk.FLAT, state=tk.DISABLED,
                 font=("Arial", 12, "bold")).pack(anchor=tk.W)
        
        input_row = tk.Frame(input_frame)
        input_row.pack(fill=tk.X, pady=8)
        
        self.input_var = tk.StringVar()
        self.input_entry = tk.Entry(input_row, textvariable=self.input_var, 
                                   font=("Arial", 12), bg="white")
        self.input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.input_entry.bind("<Return>", self.send_message)
        
        send_btn = tk.Button(input_row, text="🚀 Send", command=self.send_message, 
                            bg="#28A745", fg="white", font=("Arial", 12, "bold"))
        send_btn.pack(side=tk.LEFT)
        
        # Action buttons
        button_frame = tk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=10)
        
        tk.Button(button_frame, text="💾 Save Chat", command=self.save_chat_history,
                 bg="#17A2B8", fg="white", font=("Arial", 11)).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="📂 Load Chat", command=self.load_chat_history,
                 bg="#6F42C1", fg="white", font=("Arial", 11)).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="🗑️ Clear Chat", command=self.clear_chat,
                 bg="#DC3545", fg="white", font=("Arial", 11)).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="❌ Quit", command=self.root.quit,
                 bg="#6C757D", fg="white", font=("Arial", 11)).pack(side=tk.RIGHT, padx=5)
        
        # Add welcome message
        self.append_chat("System", "🎉 Welcome to Ollama Chat GUI! Type a message to start chatting with your AI assistant.")

    def update_status(self):
        if not self.chat_app:
            self.status_var.set("❌ Chat app error")
            self.status_btn.config(bg="#DC3545")
            return
            
        try:
            installed = self.chat_app.check_ollama_installation()
            running = self.chat_app.check_ollama_server()
            
            if not installed:
                self.status_var.set("❌ Ollama not installed")
                self.status_btn.config(bg="#DC3545")
            elif not running:
                self.status_var.set("🔴 Offline")
                self.status_btn.config(bg="#DC3545")
            else:
                self.status_var.set("🟢 Online")
                self.status_btn.config(bg="#28A745")
        except Exception as e:
            self.status_var.set("⚠️ Error")
            self.status_btn.config(bg="#FFC107")
        
        # Update every 5 seconds
        self.root.after(5000, self.update_status)

    def refresh_models(self):
        if not self.chat_app:
            return
        try:
            self.models = self.chat_app.get_available_models()
            self.append_chat("System", f"📋 Found {len(self.models)} models: {', '.join(self.models)}")
        except Exception as e:
            self.append_chat("System", f"❌ Error refreshing models: {e}")

    def set_system_prompt(self):
        if not self.chat_app:
            return
        try:
            prompt = self.prompt_var.get()
            self.chat_app.config["system_prompt"] = prompt
            self.chat_app.save_config(self.chat_app.config)
            self.append_chat("System", "✅ System prompt updated.")
        except Exception as e:
            self.append_chat("System", f"❌ Error setting prompt: {e}")

    def send_message(self, event=None):
        if not self.chat_app:
            self.append_chat("System", "❌ Chat app not available")
            return
            
        message = self.input_var.get().strip()
        if not message:
            return
        
        self.input_var.set("")
        self.append_chat("You", message)
        self.chat_app.add_to_history("user", message)
        
        # Send in background thread
        threading.Thread(target=self.get_response, args=(message,), daemon=True).start()

    def get_response(self, message):
        try:
            # Update temperature from entry
            try:
                temp = float(self.temp_entry.get())
                self.chat_app.config["temperature"] = temp
            except:
                pass
                
            # Update model from entry
            model = self.model_var.get()
            if model != self.chat_app.config["model"]:
                self.chat_app.config["model"] = model
                self.chat_app.save_config(self.chat_app.config)
            
            self.append_chat("Assistant", "🤔 Thinking...")
            response = self.chat_app.send_message(message, self.chat_app.config.get("system_prompt"))
            self.chat_app.add_to_history("assistant", response)
            
            # Replace "Thinking..." with actual response
            self.replace_last_message(response)
            
        except Exception as e:
            self.append_chat("System", f"❌ Error: {e}")

    def append_chat(self, sender, message):
        self.chat_text.config(state=tk.NORMAL)
        self.chat_text.insert(tk.END, f"{sender}: {message}\n")
        self.chat_text.see(tk.END)
        self.chat_text.config(state=tk.DISABLED)

    def replace_last_message(self, new_message):
        self.chat_text.config(state=tk.NORMAL)
        lines = self.chat_text.get("1.0", tk.END).splitlines()
        if lines and lines[-1].startswith("Assistant: 🤔 Thinking..."):
            lines[-1] = f"Assistant: {new_message}"
            self.chat_text.delete("1.0", tk.END)
            self.chat_text.insert(tk.END, "\n".join(lines) + "\n")
        self.chat_text.see(tk.END)
        self.chat_text.config(state=tk.DISABLED)

    def save_chat_history(self):
        if not self.chat_app:
            return
        try:
            from tkinter import filedialog
            file_path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON Files", "*.json")])
            if file_path:
                with open(file_path, 'w') as f:
                    json.dump(self.chat_app.chat_history, f, indent=2)
                self.append_chat("System", f"💾 Chat history saved to {file_path}")
        except Exception as e:
            self.append_chat("System", f"❌ Error saving: {e}")

    def load_chat_history(self):
        if not self.chat_app:
            return
        try:
            from tkinter import filedialog
            file_path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
            if file_path:
                with open(file_path, 'r') as f:
                    self.chat_app.chat_history = json.load(f)
                self.load_history_to_gui()
                self.append_chat("System", f"📂 Chat history loaded from {file_path}")
        except Exception as e:
            self.append_chat("System", f"❌ Error loading: {e}")

    def load_history_to_gui(self):
        if not self.chat_app:
            return
        try:
            self.chat_text.config(state=tk.NORMAL)
            self.chat_text.delete("1.0", tk.END)
            for entry in self.chat_app.chat_history:
                sender = "You" if entry["role"] == "user" else "Assistant"
                self.chat_text.insert(tk.END, f"{sender}: {entry['content']}\n")
            self.chat_text.see(tk.END)
            self.chat_text.config(state=tk.DISABLED)
        except Exception as e:
            self.append_chat("System", f"❌ Error loading history: {e}")

    def clear_chat(self):
        self.chat_text.config(state=tk.NORMAL)
        self.chat_text.delete("1.0", tk.END)
        self.chat_text.config(state=tk.DISABLED)
        if self.chat_app:
            self.chat_app.chat_history.clear()
        self.append_chat("System", "🗑️ Chat cleared.")

if __name__ == "__main__":
    print("🚀 Starting Ollama Chat GUI - Final Version...")
    root = tk.Tk()
    app = OllamaChatFinal(root)
    print("✅ GUI created successfully!")
    print("💡 The GUI should now be visible with all features working.")
    root.mainloop()
    print("👋 GUI closed.") 