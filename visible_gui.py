#!/usr/bin/env python3
"""
Visible Ollama Chat GUI - Enhanced visibility version
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import os
import json
from ollama_chat import OllamaChat

class VisibleOllamaChatGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Ollama Chat GUI - VISIBLE VERSION")
        self.root.geometry("800x700")  # Larger window
        self.root.minsize(600, 500)
        
        # Force window to front and make it visible
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after_idle(self.root.attributes, '-topmost', False)
        
        # Add a very visible header
        header_frame = tk.Frame(self.root, bg="red", height=50)
        header_frame.pack(fill=tk.X)
        header_frame.pack_propagate(False)
        
        header_label = tk.Label(header_frame, text="OLLAMA CHAT GUI IS RUNNING!", 
                               bg="red", fg="white", font=("Arial", 20, "bold"))
        header_label.pack(expand=True)
        
        # Add a status bar at the bottom
        self.status_bar = tk.Label(self.root, text="Ready", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        try:
            self.chat_app = OllamaChat()
            self.models = self.chat_app.get_available_models()
            self.status_var = tk.StringVar()
            self.model_var = tk.StringVar(value=self.chat_app.config["model"])
            self.temperature_var = tk.DoubleVar(value=self.chat_app.config["temperature"])
            self.system_prompt_var = tk.StringVar(value=self.chat_app.config["system_prompt"])
            
            self.create_widgets()
            self.update_status()
            self.refresh_models()
            self.load_history_to_gui()
            
            # Add a welcome message
            self.append_chat("System", "Welcome to Ollama Chat GUI! The interface is now visible.")
            self.status_bar.config(text="GUI loaded successfully")
            
        except Exception as e:
            error_msg = f"Error during initialization: {e}"
            self.status_bar.config(text=error_msg)
            messagebox.showerror("Error", error_msg)

    def create_widgets(self):
        # Menu
        menubar = tk.Menu(self.root)
        filemenu = tk.Menu(menubar, tearoff=0)
        filemenu.add_command(label="Save Chat History", command=self.save_chat_history)
        filemenu.add_command(label="Load Chat History", command=self.load_chat_history)
        filemenu.add_separator()
        filemenu.add_command(label="Exit", command=self.root.quit)
        menubar.add_cascade(label="File", menu=filemenu)
        self.root.config(menu=menubar)

        # Main content frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Top frame for model and status
        top_frame = ttk.LabelFrame(main_frame, text="Configuration", padding=10)
        top_frame.pack(fill=tk.X, pady=(0, 10))

        # Model selection row
        model_frame = ttk.Frame(top_frame)
        model_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(model_frame, text="Model:", font=("Arial", 12, "bold")).pack(side=tk.LEFT)
        self.model_combo = ttk.Combobox(model_frame, textvariable=self.model_var, values=self.models, width=20, state="readonly")
        self.model_combo.pack(side=tk.LEFT, padx=10)
        self.model_combo.bind("<<ComboboxSelected>>", self.change_model)
        
        ttk.Button(model_frame, text="Refresh Models", command=self.refresh_models).pack(side=tk.LEFT, padx=10)
        
        # Temperature and status row
        config_frame = ttk.Frame(top_frame)
        config_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(config_frame, text="Temperature:", font=("Arial", 12, "bold")).pack(side=tk.LEFT)
        self.temp_spin = ttk.Spinbox(config_frame, from_=0.0, to=1.5, increment=0.05, 
                                    textvariable=self.temperature_var, width=8, command=self.change_temperature)
        self.temp_spin.pack(side=tk.LEFT, padx=10)
        
        ttk.Label(config_frame, text="Status:", font=("Arial", 12, "bold")).pack(side=tk.LEFT, padx=(20,0))
        self.status_label = ttk.Label(config_frame, textvariable=self.status_var, foreground="green", font=("Arial", 12, "bold"))
        self.status_label.pack(side=tk.LEFT, padx=10)

        # System prompt
        prompt_frame = ttk.LabelFrame(main_frame, text="System Prompt", padding=10)
        prompt_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.sys_entry = ttk.Entry(prompt_frame, textvariable=self.system_prompt_var, font=("Arial", 10))
        self.sys_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        ttk.Button(prompt_frame, text="Set Prompt", command=self.change_system_prompt).pack(side=tk.LEFT)

        # Chat area
        chat_frame = ttk.LabelFrame(main_frame, text="Chat", padding=10)
        chat_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.chat_text = scrolledtext.ScrolledText(chat_frame, wrap=tk.WORD, state=tk.DISABLED, 
                                                  font=("Arial", 11), height=20)
        self.chat_text.pack(fill=tk.BOTH, expand=True)

        # Input area
        input_frame = ttk.Frame(main_frame)
        input_frame.pack(fill=tk.X)
        
        ttk.Label(input_frame, text="Your message:", font=("Arial", 12, "bold")).pack(anchor=tk.W)
        
        input_row = ttk.Frame(input_frame)
        input_row.pack(fill=tk.X, pady=5)
        
        self.input_var = tk.StringVar()
        self.input_entry = ttk.Entry(input_row, textvariable=self.input_var, font=("Arial", 12))
        self.input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.input_entry.bind("<Return>", self.send_message_event)
        
        send_btn = ttk.Button(input_row, text="Send Message", command=self.send_message, style="Accent.TButton")
        send_btn.pack(side=tk.LEFT)

    def update_status(self):
        try:
            installed = self.chat_app.check_ollama_installation()
            running = self.chat_app.check_ollama_server()
            if not installed:
                self.status_var.set("Ollama not installed")
                self.status_label.config(foreground="red")
                self.status_bar.config(text="Ollama not installed")
            elif not running:
                self.status_var.set("Offline")
                self.status_label.config(foreground="red")
                self.status_bar.config(text="Ollama server offline")
            else:
                self.status_var.set("Online")
                self.status_label.config(foreground="green")
                self.status_bar.config(text="Connected to Ollama")
            # Schedule next status update
            self.root.after(5000, self.update_status)
        except Exception as e:
            self.status_var.set("Error")
            self.status_bar.config(text=f"Status error: {e}")

    def refresh_models(self):
        try:
            self.models = self.chat_app.get_available_models()
            self.model_combo["values"] = self.models
            if self.chat_app.config["model"] in self.models:
                self.model_var.set(self.chat_app.config["model"])
            elif self.models:
                self.model_var.set(self.models[0])
                self.change_model()
            self.status_bar.config(text=f"Found {len(self.models)} models")
        except Exception as e:
            self.status_bar.config(text=f"Error refreshing models: {e}")

    def change_model(self, event=None):
        try:
            model = self.model_var.get()
            if model not in self.models:
                if messagebox.askyesno("Pull Model", f"Model '{model}' not found. Pull it now?"):
                    self.append_chat("System", f"Pulling model '{model}'...")
                    self.status_bar.config(text=f"Pulling model {model}...")
                    threading.Thread(target=self.pull_model_thread, args=(model,), daemon=True).start()
                return
            self.chat_app.config["model"] = model
            self.chat_app.save_config(self.chat_app.config)
            self.append_chat("System", f"Switched to model: {model}")
            self.status_bar.config(text(f"Model changed to {model}"))
        except Exception as e:
            self.status_bar.config(text=f"Error changing model: {e}")

    def pull_model_thread(self, model):
        try:
            success = self.chat_app.pull_model(model)
            if success:
                self.refresh_models()
                self.append_chat("System", f"Model '{model}' pulled and ready.")
                self.status_bar.config(text=f"Model {model} ready")
            else:
                self.append_chat("System", f"Failed to pull model '{model}'.")
                self.status_bar.config(text(f"Failed to pull {model}")
        except Exception as e:
            self.status_bar.config(text(f"Error pulling model: {e}")

    def change_temperature(self):
        try:
            temp = self.temperature_var.get()
            self.chat_app.config["temperature"] = temp
            self.chat_app.save_config(self.chat_app.config)
            self.append_chat("System", f"Temperature set to {temp}")
            self.status_bar.config(text(f"Temperature: {temp}"))
        except Exception as e:
            self.status_bar.config(text(f"Error setting temperature: {e}")

    def change_system_prompt(self):
        try:
            prompt = self.system_prompt_var.get()
            self.chat_app.config["system_prompt"] = prompt
            self.chat_app.save_config(self.chat_app.config)
            self.append_chat("System", "System prompt updated.")
            self.status_bar.config(text("System prompt updated"))
        except Exception as e:
            self.status_bar.config(text(f"Error setting prompt: {e}"))

    def send_message_event(self, event):
        self.send_message()

    def send_message(self):
        try:
            user_msg = self.input_var.get().strip()
            if not user_msg:
                return
            self.input_var.set("")
            self.append_chat("You", user_msg)
            self.chat_app.add_to_history("user", user_msg)
            self.status_bar.config(text="Sending message...")
            threading.Thread(target=self.get_response_thread, args=(user_msg,), daemon=True).start()
        except Exception as e:
            self.status_bar.config(text=f"Error sending message: {e}")

    def get_response_thread(self, user_msg):
        try:
            self.append_chat("Assistant", "Thinking...", temp=True)
            response = self.chat_app.send_message(user_msg, self.chat_app.config.get("system_prompt"))
            self.chat_app.add_to_history("assistant", response)
            self.replace_last_temp_message(response)
            self.status_bar.config(text="Message sent successfully")
        except Exception as e:
            self.status_bar.config(text=f"Error getting response: {e}")

    def append_chat(self, sender, message, temp=False):
        try:
            self.chat_text.config(state=tk.NORMAL)
            if temp:
                self.chat_text.insert(tk.END, f"{sender}: {message}\n", ("temp",))
            else:
                self.chat_text.insert(tk.END, f"{sender}: {message}\n")
            self.chat_text.see(tk.END)
            self.chat_text.config(state=tk.DISABLED)
        except Exception as e:
            self.status_bar.config(text(f"Error appending chat: {e}")

    def replace_last_temp_message(self, new_message):
        try:
            self.chat_text.config(state=tk.NORMAL)
            lines = self.chat_text.get("1.0", tk.END).splitlines()
            if lines and lines[-1].startswith("Assistant: Thinking..."):
                lines[-1] = f"Assistant: {new_message}"
                self.chat_text.delete("1.0", tk.END)
                self.chat_text.insert(tk.END, "\n".join(lines) + "\n")
            self.chat_text.see(tk.END)
            self.chat_text.config(state=tk.DISABLED)
        except Exception as e:
            self.status_bar.config(text(f"Error replacing message: {e}")

    def save_chat_history(self):
        try:
            from tkinter import filedialog
            file_path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON Files", "*.json")])
            if file_path:
                with open(file_path, 'w') as f:
                    json.dump(self.chat_app.chat_history, f, indent=2)
                messagebox.showinfo("Success", f"Chat history saved to {file_path}")
                self.status_bar.config(text(f"Chat history saved to {file_path}")
        except Exception as e:
            self.status_bar.config(text(f"Error saving chat history: {e}")

    def load_chat_history(self):
        try:
            from tkinter import filedialog
            file_path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
            if file_path:
                with open(file_path, 'r') as f:
                    self.chat_app.chat_history = json.load(f)
                self.load_history_to_gui()
                messagebox.showinfo("Success", f"Chat history loaded from {file_path}")
                self.status_bar.config(text(f"Chat history loaded from {file_path}")
        except Exception as e:
            self.status_bar.config(text(f"Error loading chat history: {e}")

    def load_history_to_gui(self):
        try:
            self.chat_text.config(state=tk.NORMAL)
            self.chat_text.delete("1.0", tk.END)
            for entry in self.chat_app.chat_history:
                sender = "You" if entry["role"] == "user" else "Assistant"
                self.chat_text.insert(tk.END, f"{sender}: {entry['content']}\n")
            self.chat_text.see(tk.END)
            self.chat_text.config(state=tk.DISABLED)
        except Exception as e:
            self.status_bar.config(text(f"Error loading history: {e}")

if __name__ == "__main__":
    print("Starting Visible Ollama Chat GUI...")
    root = tk.Tk()
    app = VisibleOllamaChatGUI(root)
    print("GUI created, starting mainloop...")
    root.mainloop()
    print("GUI closed.") 