#!/usr/bin/env python3
"""
Minimal test to check if ScrolledText widget works
"""

import tkinter as tk
from tkinter import scrolledtext

root = tk.Tk()
root.title("ScrolledText Test")
root.geometry("400x300")

# Add a visible label at the top
label = tk.Label(root, text="ScrolledText Test - If you see this, Tkinter is working", 
                bg="lightblue", font=("Arial", 12, "bold"))
label.pack(fill=tk.X, pady=5)

# Add the ScrolledText widget
st = scrolledtext.ScrolledText(root, wrap=tk.WORD, height=10)
st.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
st.insert(tk.END, "If you see this text in a scrollable area, ScrolledText works!\n\n")
st.insert(tk.END, "This is a test of the ScrolledText widget.\n")
st.insert(tk.END, "You should be able to scroll up and down.\n")
st.insert(tk.END, "If this text is visible, then the issue with the main GUI\n")
st.insert(tk.END, "is not with ScrolledText but with something else.\n\n")
st.insert(tk.END, "If you don't see this text, then ScrolledText is the problem.")

# Add a button at the bottom
button = tk.Button(root, text="Test Button", command=lambda: print("Button clicked!"))
button.pack(pady=5)

print("ScrolledText test window created. Do you see the text and button?")

root.mainloop() 