#!/usr/bin/env python3
"""
Modern Ollama Chat GUI using PyQt6
A beautiful, responsive GUI for interacting with local Ollama models.
"""

import sys
import json
import threading
from datetime import datetime
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QTextEdit, QLineEdit, QPushButton, 
                             QLabel, QComboBox, QSpinBox, QGroupBox, QSplitter,
                             QFileDialog, QMessageBox, QProgressBar, QFrame)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor, QTextCursor
from ollama_chat import OllamaChat

class ChatWorker(QThread):
    """Worker thread for handling chat requests"""
    response_received = pyqtSignal(str)
    error_occurred = pyqtSignal(str)
    
    def __init__(self, chat_app, message, system_prompt):
        super().__init__()
        self.chat_app = chat_app
        self.message = message
        self.system_prompt = system_prompt
    
    def run(self):
        try:
            response = self.chat_app.send_message(self.message, self.system_prompt)
            self.response_received.emit(response)
        except Exception as e:
            self.error_occurred.emit(str(e))

class OllamaChatGUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.chat_app = None
        self.chat_worker = None
        self.init_ui()
        self.init_chat_app()
        
    def init_ui(self):
        self.setWindowTitle("🤖 Ollama Chat - Modern GUI")
        self.setGeometry(100, 100, 1000, 700)
        self.setMinimumSize(800, 600)
        
        # Set modern styling
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f8f9fa;
            }
            QGroupBox {
                font-weight: bold;
                border: 2px solid #dee2e6;
                border-radius: 8px;
                margin-top: 1ex;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
            QPushButton {
                background-color: #007bff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #0056b3;
            }
            QPushButton:pressed {
                background-color: #004085;
            }
            QPushButton:disabled {
                background-color: #6c757d;
            }
            QTextEdit {
                border: 1px solid #ced4da;
                border-radius: 4px;
                padding: 8px;
                background-color: white;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 12px;
            }
            QLineEdit {
                border: 1px solid #ced4da;
                border-radius: 4px;
                padding: 8px;
                background-color: white;
            }
            QComboBox {
                border: 1px solid #ced4da;
                border-radius: 4px;
                padding: 6px;
                background-color: white;
            }
            QSpinBox {
                border: 1px solid #ced4da;
                border-radius: 4px;
                padding: 6px;
                background-color: white;
            }
        """)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(10)
        main_layout.setContentsMargins(15, 15, 15, 15)
        
        # Title
        title_label = QLabel("🤖 Ollama Chat - Modern GUI")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title_label.setStyleSheet("""
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            padding: 10px;
            background-color: #e9ecef;
            border-radius: 8px;
        """)
        main_layout.addWidget(title_label)
        
        # Create splitter for controls and chat
        splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(splitter)
        
        # Left panel - Controls
        controls_widget = self.create_controls_panel()
        splitter.addWidget(controls_widget)
        
        # Right panel - Chat
        chat_widget = self.create_chat_panel()
        splitter.addWidget(chat_widget)
        
        # Set splitter proportions
        splitter.setSizes([300, 700])
        
        # Status bar
        self.status_bar = self.statusBar()
        self.status_bar.setStyleSheet("""
            QStatusBar {
                background-color: #f8f9fa;
                border-top: 1px solid #dee2e6;
            }
        """)
        
        # Status timer
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self.update_status)
        self.status_timer.start(5000)  # Update every 5 seconds
        
    def create_controls_panel(self):
        """Create the controls panel"""
        controls_widget = QWidget()
        controls_layout = QVBoxLayout(controls_widget)
        controls_layout.setSpacing(15)
        
        # Connection status
        status_group = QGroupBox("📊 Connection Status")
        status_layout = QVBoxLayout(status_group)
        
        self.status_label = QLabel("Checking...")
        self.status_label.setStyleSheet("""
            padding: 10px;
            border-radius: 4px;
            background-color: #fff3cd;
            color: #856404;
            font-weight: bold;
        """)
        status_layout.addWidget(self.status_label)
        controls_layout.addWidget(status_group)
        
        # Model configuration
        model_group = QGroupBox("🤖 Model Configuration")
        model_layout = QVBoxLayout(model_group)
        
        # Model selection
        model_row = QHBoxLayout()
        model_row.addWidget(QLabel("Model:"))
        self.model_combo = QComboBox()
        self.model_combo.setEditable(True)
        model_row.addWidget(self.model_combo)
        model_layout.addLayout(model_row)
        
        # Refresh models button
        refresh_btn = QPushButton("🔄 Refresh Models")
        refresh_btn.clicked.connect(self.refresh_models)
        model_layout.addWidget(refresh_btn)
        
        controls_layout.addWidget(model_group)
        
        # Parameters
        params_group = QGroupBox("⚙️ Parameters")
        params_layout = QVBoxLayout(params_group)
        
        # Temperature
        temp_row = QHBoxLayout()
        temp_row.addWidget(QLabel("Temperature:"))
        self.temp_spin = QSpinBox()
        self.temp_spin.setRange(0, 20)
        self.temp_spin.setValue(7)
        self.temp_spin.setSuffix(" (0.7)")
        self.temp_spin.setSingleStep(1)
        temp_row.addWidget(self.temp_spin)
        params_layout.addLayout(temp_row)
        
        # System prompt
        params_layout.addWidget(QLabel("System Prompt:"))
        self.system_prompt_edit = QTextEdit()
        self.system_prompt_edit.setMaximumHeight(80)
        self.system_prompt_edit.setPlainText("You are a helpful AI assistant.")
        params_layout.addWidget(self.system_prompt_edit)
        
        controls_layout.addWidget(params_group)
        
        # Actions
        actions_group = QGroupBox("📁 Actions")
        actions_layout = QVBoxLayout(actions_group)
        
        save_btn = QPushButton("💾 Save Chat History")
        save_btn.clicked.connect(self.save_chat_history)
        actions_layout.addWidget(save_btn)
        
        load_btn = QPushButton("📂 Load Chat History")
        load_btn.clicked.connect(self.load_chat_history)
        actions_layout.addWidget(load_btn)
        
        clear_btn = QPushButton("🗑️ Clear Chat")
        clear_btn.clicked.connect(self.clear_chat)
        actions_layout.addWidget(clear_btn)
        
        controls_layout.addWidget(actions_group)
        
        # Add stretch to push everything to the top
        controls_layout.addStretch()
        
        return controls_widget
        
    def create_chat_panel(self):
        """Create the chat panel"""
        chat_widget = QWidget()
        chat_layout = QVBoxLayout(chat_widget)
        chat_layout.setSpacing(10)
        
        # Chat history
        chat_group = QGroupBox("💭 Chat History")
        chat_group_layout = QVBoxLayout(chat_group)
        
        self.chat_display = QTextEdit()
        self.chat_display.setReadOnly(True)
        self.chat_display.setStyleSheet("""
            QTextEdit {
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 12px;
                line-height: 1.4;
            }
        """)
        chat_group_layout.addWidget(self.chat_display)
        chat_layout.addWidget(chat_group)
        
        # Input area
        input_group = QGroupBox("✍️ Send Message")
        input_layout = QVBoxLayout(input_group)
        
        self.message_input = QLineEdit()
        self.message_input.setPlaceholderText("Type your message here...")
        self.message_input.returnPressed.connect(self.send_message)
        input_layout.addWidget(self.message_input)
        
        send_btn = QPushButton("🚀 Send Message")
        send_btn.clicked.connect(self.send_message)
        input_layout.addWidget(send_btn)
        
        chat_layout.addWidget(input_group)
        
        return chat_widget
        
    def init_chat_app(self):
        """Initialize the chat application"""
        try:
            self.chat_app = OllamaChat()
            self.refresh_models()
            self.update_status()
            self.add_system_message("🎉 Welcome to Ollama Chat! The GUI is ready.")
        except Exception as e:
            self.add_system_message(f"❌ Error initializing chat app: {e}")
            
    def update_status(self):
        """Update the connection status"""
        if not self.chat_app:
            self.status_label.setText("❌ Chat app not available")
            self.status_label.setStyleSheet("""
                padding: 10px;
                border-radius: 4px;
                background-color: #f8d7da;
                color: #721c24;
                font-weight: bold;
            """)
            return
            
        try:
            installed = self.chat_app.check_ollama_installation()
            running = self.chat_app.check_ollama_server()
            
            if not installed:
                self.status_label.setText("❌ Ollama not installed")
                self.status_label.setStyleSheet("""
                    padding: 10px;
                    border-radius: 4px;
                    background-color: #f8d7da;
                    color: #721c24;
                    font-weight: bold;
                """)
            elif not running:
                self.status_label.setText("🔴 Ollama server offline")
                self.status_label.setStyleSheet("""
                    padding: 10px;
                    border-radius: 4px;
                    background-color: #f8d7da;
                    color: #721c24;
                    font-weight: bold;
                """)
            else:
                self.status_label.setText("🟢 Connected to Ollama")
                self.status_label.setStyleSheet("""
                    padding: 10px;
                    border-radius: 4px;
                    background-color: #d4edda;
                    color: #155724;
                    font-weight: bold;
                """)
        except Exception as e:
            self.status_label.setText(f"⚠️ Error: {e}")
            self.status_label.setStyleSheet("""
                padding: 10px;
                border-radius: 4px;
                background-color: #fff3cd;
                color: #856404;
                font-weight: bold;
            """)
            
    def refresh_models(self):
        """Refresh the list of available models"""
        if not self.chat_app:
            return
            
        try:
            models = self.chat_app.get_available_models()
            self.model_combo.clear()
            self.model_combo.addItems(models)
            
            if self.chat_app.config["model"] in models:
                self.model_combo.setCurrentText(self.chat_app.config["model"])
            elif models:
                self.model_combo.setCurrentText(models[0])
                
            self.add_system_message(f"📋 Found {len(models)} models: {', '.join(models)}")
        except Exception as e:
            self.add_system_message(f"❌ Error refreshing models: {e}")
            
    def send_message(self):
        """Send a message to the AI"""
        if not self.chat_app:
            self.add_system_message("❌ Chat app not available")
            return
            
        message = self.message_input.text().strip()
        if not message:
            return
            
        # Clear input
        self.message_input.clear()
        
        # Add user message to display
        self.add_user_message(message)
        
        # Add to chat history
        self.chat_app.add_to_history("user", message)
        
        # Update configuration
        try:
            # Update temperature
            temp_value = self.temp_spin.value() / 10.0
            self.chat_app.config["temperature"] = temp_value
            
            # Update model
            model = self.model_combo.currentText()
            if model and model != self.chat_app.config["model"]:
                self.chat_app.config["model"] = model
                self.chat_app.save_config(self.chat_app.config)
                
            # Update system prompt
            system_prompt = self.system_prompt_edit.toPlainText()
            self.chat_app.config["system_prompt"] = system_prompt
            self.chat_app.save_config(self.chat_app.config)
            
        except Exception as e:
            self.add_system_message(f"⚠️ Error updating config: {e}")
        
        # Show thinking message
        self.add_assistant_message("🤔 Thinking...")
        
        # Start worker thread
        self.chat_worker = ChatWorker(self.chat_app, message, system_prompt)
        self.chat_worker.response_received.connect(self.handle_response)
        self.chat_worker.error_occurred.connect(self.handle_error)
        self.chat_worker.start()
        
    def handle_response(self, response):
        """Handle the AI response"""
        # Replace "Thinking..." with actual response
        self.replace_last_message(response)
        
        # Add to chat history
        self.chat_app.add_to_history("assistant", response)
        
    def handle_error(self, error):
        """Handle errors from the worker thread"""
        self.replace_last_message(f"❌ Error: {error}")
        
    def add_user_message(self, message):
        """Add a user message to the chat display"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 10px 0;"><span style="color: #007bff; font-weight: bold;">👤 You ({timestamp}):</span><br>{message}</div>')
        self.scroll_to_bottom()
        
    def add_assistant_message(self, message):
        """Add an assistant message to the chat display"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 10px 0;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br>{message}</div>')
        self.scroll_to_bottom()
        
    def add_system_message(self, message):
        """Add a system message to the chat display"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 10px 0;"><span style="color: #6c757d; font-weight: bold;">⚙️ System ({timestamp}):</span><br>{message}</div>')
        self.scroll_to_bottom()
        
    def replace_last_message(self, new_message):
        """Replace the last message in the chat display"""
        cursor = self.chat_display.textCursor()
        cursor.movePosition(QTextCursor.MoveOperation.End)
        cursor.movePosition(QTextCursor.MoveOperation.StartOfLine, QTextCursor.MoveMode.KeepAnchor)
        cursor.movePosition(QTextCursor.MoveOperation.Up, QTextCursor.MoveMode.KeepAnchor)
        cursor.removeSelectedText()
        cursor.deletePreviousChar()  # Remove the line break
        
        # Add the new message
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 10px 0;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br>{new_message}</div>')
        self.scroll_to_bottom()
        
    def scroll_to_bottom(self):
        """Scroll the chat display to the bottom"""
        scrollbar = self.chat_display.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
        
    def save_chat_history(self):
        """Save chat history to a file"""
        if not self.chat_app:
            QMessageBox.warning(self, "Error", "Chat app not available")
            return
            
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self, "Save Chat History", "", "JSON Files (*.json)"
            )
            if file_path:
                with open(file_path, 'w') as f:
                    json.dump(self.chat_app.chat_history, f, indent=2)
                self.add_system_message(f"💾 Chat history saved to {file_path}")
        except Exception as e:
            self.add_system_message(f"❌ Error saving chat history: {e}")
            
    def load_chat_history(self):
        """Load chat history from a file"""
        if not self.chat_app:
            QMessageBox.warning(self, "Error", "Chat app not available")
            return
            
        try:
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Load Chat History", "", "JSON Files (*.json)"
            )
            if file_path:
                with open(file_path, 'r') as f:
                    self.chat_app.chat_history = json.load(f)
                self.load_history_to_display()
                self.add_system_message(f"📂 Chat history loaded from {file_path}")
        except Exception as e:
            self.add_system_message(f"❌ Error loading chat history: {e}")
            
    def load_history_to_display(self):
        """Load chat history into the display"""
        self.chat_display.clear()
        if not self.chat_app:
            return
            
        for entry in self.chat_app.chat_history:
            timestamp = entry.get("timestamp", "Unknown")
            if isinstance(timestamp, str) and "T" in timestamp:
                # Parse ISO timestamp
                try:
                    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                    timestamp = dt.strftime("%H:%M:%S")
                except:
                    timestamp = "Unknown"
                    
            if entry["role"] == "user":
                self.chat_display.append(f'<div style="margin: 10px 0;"><span style="color: #007bff; font-weight: bold;">👤 You ({timestamp}):</span><br>{entry["content"]}</div>')
            else:
                self.chat_display.append(f'<div style="margin: 10px 0;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br>{entry["content"]}</div>')
                
        self.scroll_to_bottom()
        
    def clear_chat(self):
        """Clear the chat display and history"""
        self.chat_display.clear()
        if self.chat_app:
            self.chat_app.chat_history.clear()
        self.add_system_message("🗑️ Chat cleared.")

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Ollama Chat")
    app.setApplicationVersion("1.0")
    
    # Set application style
    app.setStyle('Fusion')
    
    window = OllamaChatGUI()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main() 