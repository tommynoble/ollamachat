#!/usr/bin/env python3
"""
Ollama Chat GUI Application
A Tkinter-based GUI for interacting with local Ollama models via the API.
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import threading
import os
import json
from ollama_chat import OllamaChat

class OllamaChatGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Ollama Chat GUI")
        self.root.geometry("700x600")
        self.root.minsize(500, 400)
        try:
            # Add a visible label at the top for debugging
            self.debug_label = tk.Label(self.root, text="Ollama Chat GUI Loaded", bg="lightblue", font=("Arial", 16, "bold"))
            self.debug_label.pack(fill=tk.X)

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
        except Exception as e:
            import traceback
            messagebox.showerror("Initialization Error", f"An error occurred during GUI initialization:\n{e}\n\n{traceback.format_exc()}")
            print(traceback.format_exc())

    def create_widgets(self):
        try:
            # Menu
            menubar = tk.Menu(self.root)
            filemenu = tk.Menu(menubar, tearoff=0)
            filemenu.add_command(label="Save Chat History", command=self.save_chat_history)
            filemenu.add_command(label="Load Chat History", command=self.load_chat_history)
            filemenu.add_separator()
            filemenu.add_command(label="Exit", command=self.root.quit)
            menubar.add_cascade(label="File", menu=filemenu)
            self.root.config(menu=menubar)

            # Top frame for model and status
            top_frame = ttk.Frame(self.root)
            top_frame.pack(fill=tk.X, padx=8, pady=4)

            ttk.Label(top_frame, text="Model:").pack(side=tk.LEFT)
            self.model_combo = ttk.Combobox(top_frame, textvariable=self.model_var, values=self.models, width=18, state="readonly")
            self.model_combo.pack(side=tk.LEFT, padx=4)
            self.model_combo.bind("<<ComboboxSelected>>", self.change_model)
            ttk.Button(top_frame, text="Refresh Models", command=self.refresh_models).pack(side=tk.LEFT, padx=4)
            ttk.Label(top_frame, text="Temperature:").pack(side=tk.LEFT, padx=(16,0))
            self.temp_spin = ttk.Spinbox(top_frame, from_=0.0, to=1.5, increment=0.05, textvariable=self.temperature_var, width=5, command=self.change_temperature)
            self.temp_spin.pack(side=tk.LEFT, padx=4)
            ttk.Label(top_frame, text="Status:").pack(side=tk.LEFT, padx=(16,0))
            self.status_label = ttk.Label(top_frame, textvariable=self.status_var, foreground="green")
            self.status_label.pack(side=tk.LEFT, padx=4)

            # System prompt
            sys_frame = ttk.Frame(self.root)
            sys_frame.pack(fill=tk.X, padx=8, pady=2)
            ttk.Label(sys_frame, text="System Prompt:").pack(side=tk.LEFT)
            self.sys_entry = ttk.Entry(sys_frame, textvariable=self.system_prompt_var, width=60)
            self.sys_entry.pack(side=tk.LEFT, padx=4, fill=tk.X, expand=True)
            ttk.Button(sys_frame, text="Set", command=self.change_system_prompt).pack(side=tk.LEFT, padx=4)

            # Chat history area
            self.chat_text = scrolledtext.ScrolledText(self.root, wrap=tk.WORD, state=tk.DISABLED, height=25)
            self.chat_text.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)

            # Bottom frame for input
            bottom_frame = ttk.Frame(self.root)
            bottom_frame.pack(fill=tk.X, padx=8, pady=4)
            self.input_var = tk.StringVar()
            self.input_entry = ttk.Entry(bottom_frame, textvariable=self.input_var)
            self.input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,8))
            self.input_entry.bind("<Return>", self.send_message_event)
            send_btn = ttk.Button(bottom_frame, text="Send", command=self.send_message)
            send_btn.pack(side=tk.LEFT)
        except Exception as e:
            import traceback
            messagebox.showerror("Widget Error", f"An error occurred while creating widgets:\n{e}\n\n{traceback.format_exc()}")
            print(traceback.format_exc())

    def update_status(self):
        installed = self.chat_app.check_ollama_installation()
        running = self.chat_app.check_ollama_server()
        if not installed:
            self.status_var.set("Ollama not installed")
            self.status_label.config(foreground="red")
        elif not running:
            self.status_var.set("Offline")
            self.status_label.config(foreground="red")
        else:
            self.status_var.set("Online")
            self.status_label.config(foreground="green")
        # Schedule next status update
        self.root.after(5000, self.update_status)

    def refresh_models(self):
        self.models = self.chat_app.get_available_models()
        self.model_combo["values"] = self.models
        if self.chat_app.config["model"] in self.models:
            self.model_var.set(self.chat_app.config["model"])
        elif self.models:
            self.model_var.set(self.models[0])
            self.change_model()

    def change_model(self, event=None):
        model = self.model_var.get()
        if model not in self.models:
            if messagebox.askyesno("Pull Model", f"Model '{model}' not found. Pull it now?"):
                self.append_chat("System", f"Pulling model '{model}'...")
                threading.Thread(target=self.pull_model_thread, args=(model,), daemon=True).start()
            return
        self.chat_app.config["model"] = model
        self.chat_app.save_config(self.chat_app.config)
        self.append_chat("System", f"Switched to model: {model}")

    def pull_model_thread(self, model):
        success = self.chat_app.pull_model(model)
        if success:
            self.refresh_models()
            self.append_chat("System", f"Model '{model}' pulled and ready.")
        else:
            self.append_chat("System", f"Failed to pull model '{model}'.")

    def change_temperature(self):
        temp = self.temperature_var.get()
        self.chat_app.config["temperature"] = temp
        self.chat_app.save_config(self.chat_app.config)
        self.append_chat("System", f"Temperature set to {temp}")

    def change_system_prompt(self):
        prompt = self.system_prompt_var.get()
        self.chat_app.config["system_prompt"] = prompt
        self.chat_app.save_config(self.chat_app.config)
        self.append_chat("System", "System prompt updated.")

    def send_message_event(self, event):
        self.send_message()

    def send_message(self):
        user_msg = self.input_var.get().strip()
        if not user_msg:
            return
        self.input_var.set("")
        self.append_chat("You", user_msg)
        self.chat_app.add_to_history("user", user_msg)
        threading.Thread(target=self.get_response_thread, args=(user_msg,), daemon=True).start()

    def get_response_thread(self, user_msg):
        self.append_chat("Assistant", "...", temp=True)
        response = self.chat_app.send_message(user_msg, self.chat_app.config.get("system_prompt"))
        self.chat_app.add_to_history("assistant", response)
        self.replace_last_temp_message(response)

    def append_chat(self, sender, message, temp=False):
        self.chat_text.config(state=tk.NORMAL)
        if temp:
            self.chat_text.insert(tk.END, f"{sender}: {message}\n", ("temp",))
        else:
            self.chat_text.insert(tk.END, f"{sender}: {message}\n")
        self.chat_text.see(tk.END)
        self.chat_text.config(state=tk.DISABLED)

    def replace_last_temp_message(self, new_message):
        self.chat_text.config(state=tk.NORMAL)
        # Remove last line (the temp message)
        lines = self.chat_text.get("1.0", tk.END).splitlines()
        if lines and lines[-1].startswith("Assistant: ..."):
            lines[-1] = f"Assistant: {new_message}"
            self.chat_text.delete("1.0", tk.END)
            self.chat_text.insert(tk.END, "\n".join(lines) + "\n")
        self.chat_text.see(tk.END)
        self.chat_text.config(state=tk.DISABLED)

    def save_chat_history(self):
        file_path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON Files", "*.json")])
        if file_path:
            try:
                with open(file_path, 'w') as f:
                    json.dump(self.chat_app.chat_history, f, indent=2)
                messagebox.showinfo("Success", f"Chat history saved to {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save chat history: {e}")

    def load_chat_history(self):
        file_path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
        if file_path:
            try:
                with open(file_path, 'r') as f:
                    self.chat_app.chat_history = json.load(f)
                self.load_history_to_gui()
                messagebox.showinfo("Success", f"Chat history loaded from {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load chat history: {e}")

    def load_history_to_gui(self):
        self.chat_text.config(state=tk.NORMAL)
        self.chat_text.delete("1.0", tk.END)
        for entry in self.chat_app.chat_history:
            sender = "You" if entry["role"] == "user" else "Assistant"
            self.chat_text.insert(tk.END, f"{sender}: {entry['content']}\n")
        self.chat_text.see(tk.END)
        self.chat_text.config(state=tk.DISABLED)

if __name__ == "__main__":
    root = tk.Tk()
    app = OllamaChatGUI(root)
    root.mainloop() 