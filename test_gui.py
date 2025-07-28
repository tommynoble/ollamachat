#!/usr/bin/env python3
"""
Simple test GUI to check if Tkinter is working.
"""

import tkinter as tk
from tkinter import ttk, messagebox

def test_gui():
    root = tk.Tk()
    root.title("Test GUI")
    root.geometry("400x300")
    
    # Add a simple label
    label = tk.Label(root, text="Hello World! This is a test.", font=("Arial", 16))
    label.pack(pady=20)
    
    # Add a button
    def show_message():
        messagebox.showinfo("Test", "Button clicked!")
    
    button = tk.Button(root, text="Click Me", command=show_message)
    button.pack(pady=10)
    
    # Add an entry
    entry = tk.Entry(root, width=30)
    entry.pack(pady=10)
    entry.insert(0, "Type something here...")
    
    print("Test GUI created successfully!")
    print("If you see a window with 'Hello World!', Tkinter is working.")
    
    root.mainloop()

if __name__ == "__main__":
    test_gui() 