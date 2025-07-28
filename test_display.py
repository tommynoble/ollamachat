#!/usr/bin/env python3
"""
Minimal GUI test to check if display is working
"""

import tkinter as tk

def test_gui():
    # Create window
    root = tk.Tk()
    root.title("TEST - Can you see this?")
    root.geometry("600x400+300+200")
    root.configure(bg='red')
    
    # Force to front
    root.lift()
    root.attributes('-topmost', True)
    
    # Add big visible elements
    label = tk.Label(root, 
                    text="CAN YOU SEE THIS TEXT?", 
                    font=("Arial", 30, "bold"),
                    bg='yellow', 
                    fg='black',
                    pady=50)
    label.pack(fill=tk.BOTH, expand=True)
    
    button = tk.Button(root,
                      text="CLICK ME IF YOU CAN SEE THIS",
                      font=("Arial", 16, "bold"),
                      bg='blue',
                      fg='white',
                      command=lambda: print("BUTTON CLICKED - GUI IS WORKING!"))
    button.pack(pady=20)
    
    print("Test GUI started - look for a RED window with YELLOW text")
    print("If you can see it, the GUI system is working")
    
    # Remove topmost after 2 seconds
    root.after(2000, lambda: root.attributes('-topmost', False))
    
    root.mainloop()

if __name__ == "__main__":
    test_gui() 