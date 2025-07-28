#!/usr/bin/env python3
"""
Dark Theme Ollama Chat GUI using PyQt6
A beautiful, dark-themed GUI for interacting with local Ollama models.
"""

import sys
import json
import threading
import os
import subprocess
import platform
import time
from datetime import datetime
from pathlib import Path
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QTextEdit, QLineEdit, QPushButton, 
                             QLabel, QComboBox, QSpinBox, QGroupBox, QSplitter,
                             QFileDialog, QMessageBox, QProgressBar, QFrame,
                             QListWidget, QListWidgetItem, QDialog, QDialogButtonBox)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor, QTextCursor
from ollama_chat import OllamaChat
import requests # Added for streaming

class StorageDetector:
    """Detect available storage locations including external drives"""
    
    @staticmethod
    def get_available_drives():
        """Get list of available drives and their info"""
        drives = []
        
        if platform.system() == "Darwin":  # macOS
            try:
                # Use df to get mounted volumes (more reliable)
                result = subprocess.run(['df', '-h'], capture_output=True, text=True)
                if result.returncode == 0:
                    for line in result.stdout.split('\n')[1:]:  # Skip header
                        if line.strip():
                            parts = line.split()
                            if len(parts) >= 6:
                                mount_point = parts[5]
                                size = parts[1]
                                available = parts[3]
                                
                                # Skip system directories and focus on actual drives
                                if (mount_point.startswith('/Volumes/') or 
                                    mount_point.startswith('/System/') or
                                    mount_point.startswith('/private/') or
                                    mount_point == '/'):
                                    
                                    # Get a better name for the drive
                                    if mount_point == '/':
                                        name = "System Drive"
                                        drive_type = "System Drive"
                                    elif mount_point.startswith('/Volumes/'):
                                        name = os.path.basename(mount_point)
                                        drive_type = "External Drive"
                                    else:
                                        name = os.path.basename(mount_point)
                                        drive_type = "System Location"
                                    
                                    drives.append({
                                        'path': mount_point,
                                        'name': name,
                                        'size': size,
                                        'available': available,
                                        'type': drive_type
                                    })
            except:
                pass
                
            # Add common external drive locations
            common_paths = [
                '/Volumes',
                os.path.expanduser('~/Desktop'),
                os.path.expanduser('~/Documents'),
                os.path.expanduser('~/Downloads')
            ]
            
            for path in common_paths:
                if os.path.exists(path):
                    try:
                        stat = os.statvfs(path)
                        total_gb = (stat.f_blocks * stat.f_frsize) / (1024**3)
                        free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
                        drives.append({
                            'path': path,
                            'name': os.path.basename(path),
                            'size': f"{total_gb:.1f}GB",
                            'available': f"{free_gb:.1f}GB",
                            'type': 'External Drive' if '/Volumes/' in path else 'System Location'
                        })
                    except:
                        continue
                        
        elif platform.system() == "Windows":
            import string
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    try:
                        stat = os.statvfs(drive)
                        total_gb = (stat.f_blocks * stat.f_frsize) / (1024**3)
                        free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
                        drives.append({
                            'path': drive,
                            'name': f"Drive {letter}",
                            'size': f"{total_gb:.1f}GB",
                            'available': f"{free_gb:.1f}GB",
                            'type': 'External Drive' if letter != 'C' else 'System Drive'
                        })
                    except:
                        continue
        else:  # Linux
            try:
                result = subprocess.run(['df', '-h'], capture_output=True, text=True)
                if result.returncode == 0:
                    for line in result.stdout.split('\n')[1:]:  # Skip header
                        if line.strip():
                            parts = line.split()
                            if len(parts) >= 6:
                                mount_point = parts[5]
                                size = parts[1]
                                available = parts[3]
                                drives.append({
                                    'path': mount_point,
                                    'name': os.path.basename(mount_point),
                                    'size': size,
                                    'available': available,
                                    'type': 'External Drive' if '/media/' in mount_point else 'System Drive'
                                })
            except:
                pass
                
        return drives

class StorageDialog(QDialog):
    """Dialog for selecting storage location"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("💾 Select Storage Location")
        self.setModal(True)
        self.setMinimumSize(500, 400)
        self.selected_path = None
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        # Title
        title = QLabel("Select where to store Ollama models:")
        title.setStyleSheet("font-size: 16px; font-weight: bold; color: #00d4ff; margin-bottom: 10px;")
        layout.addWidget(title)
        
        # Available drives list
        drives_label = QLabel("Available Storage Locations:")
        drives_label.setStyleSheet("font-weight: bold; color: #ffffff; margin-top: 10px;")
        layout.addWidget(drives_label)
        
        self.drives_list = QListWidget()
        self.drives_list.setStyleSheet("""
            QListWidget {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 10px;
                font-size: 13px;
            }
            QListWidget::item {
                padding: 10px;
                border-bottom: 1px solid #404040;
            }
            QListWidget::item:selected {
                background-color: #007acc;
            }
        """)
        layout.addWidget(self.drives_list)
        
        # Custom path
        custom_label = QLabel("Or specify custom path:")
        custom_label.setStyleSheet("font-weight: bold; color: #ffffff; margin-top: 15px;")
        layout.addWidget(custom_label)
        
        custom_layout = QHBoxLayout()
        self.custom_path_edit = QLineEdit()
        self.custom_path_edit.setPlaceholderText("/path/to/your/external/drive/ollama")
        self.custom_path_edit.setStyleSheet("""
            QLineEdit {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 10px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 13px;
            }
        """)
        custom_layout.addWidget(self.custom_path_edit)
        
        browse_btn = QPushButton("Browse")
        browse_btn.clicked.connect(self.browse_path)
        browse_btn.setStyleSheet("""
            QPushButton {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #005a9e;
            }
        """)
        custom_layout.addWidget(browse_btn)
        layout.addLayout(custom_layout)
        
        # Buttons
        button_box = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        button_box.setStyleSheet("""
            QPushButton {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #005a9e;
            }
        """)
        layout.addWidget(button_box)
        
        # Load available drives
        self.load_drives()
        
    def load_drives(self):
        """Load available drives into the list"""
        drives = StorageDetector.get_available_drives()
        for drive in drives:
            item_text = f"{drive['name']} ({drive['type']})\n"
            item_text += f"Path: {drive['path']}\n"
            item_text += f"Size: {drive['size']} | Available: {drive['available']}"
            
            item = QListWidgetItem(item_text)
            item.setData(Qt.ItemDataRole.UserRole, drive['path'])
            self.drives_list.addItem(item)
            
    def browse_path(self):
        """Browse for a custom path"""
        path = QFileDialog.getExistingDirectory(self, "Select Directory")
        if path:
            self.custom_path_edit.setText(path)
            
    def accept(self):
        """Handle OK button click"""
        # Check if a drive is selected
        current_item = self.drives_list.currentItem()
        if current_item:
            self.selected_path = current_item.data(Qt.ItemDataRole.UserRole)
        else:
            # Check custom path
            custom_path = self.custom_path_edit.text().strip()
            if custom_path:
                self.selected_path = custom_path
            else:
                QMessageBox.warning(self, "Warning", "Please select a storage location or enter a custom path.")
                return
        
        # Validate the selected path
        if self.selected_path:
            # Check if it's a valid path
            if not os.path.isabs(self.selected_path):
                QMessageBox.warning(self, "Warning", f"Invalid path: {self.selected_path}. Please select a valid absolute path.")
                return
                
            # Check if it looks like a reasonable storage location
            if len(self.selected_path) < 3 or self.selected_path in ['426k', '6', '1.2k']:
                QMessageBox.warning(self, "Warning", f"Invalid storage path: {self.selected_path}. Please select a valid directory.")
                return
                
        super().accept()

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
            response = self.chat_app.send_message(self.message, self.system_prompt, stream=False)
            if isinstance(response, str):
                self.response_received.emit(response)
            else:
                self.error_occurred.emit("Unexpected response type")
        except Exception as e:
            self.error_occurred.emit(str(e))



class ModelWorker(QThread):
    """Worker thread for model operations"""
    progress_updated = pyqtSignal(str)
    operation_completed = pyqtSignal(bool, str)
    
    def __init__(self, operation, model_name=None, storage_path=None):
        super().__init__()
        self.operation = operation
        self.model_name = model_name
        self.storage_path = storage_path
    
    def run(self):
        try:
            if self.operation == "pull":
                self.pull_model()
            elif self.operation == "list":
                self.list_models()
        except Exception as e:
            self.operation_completed.emit(False, str(e))
    
    def pull_model(self):
        """Pull a model to the specified storage location"""
        try:
            # Set OLLAMA_MODELS environment variable if storage path is specified
            env = os.environ.copy()
            if self.storage_path:
                env['OLLAMA_MODELS'] = self.storage_path
                self.progress_updated.emit(f"📁 Setting OLLAMA_MODELS environment variable to: {self.storage_path}")
                
                # Verify the path is absolute
                if not os.path.isabs(self.storage_path):
                    self.progress_updated.emit(f"⚠️ Warning: Storage path is not absolute: {self.storage_path}")
            else:
                self.progress_updated.emit("📁 Using default Ollama storage location")
            
            # Create directory if it doesn't exist
            if self.storage_path and not os.path.exists(self.storage_path):
                os.makedirs(self.storage_path, exist_ok=True)
                self.progress_updated.emit(f"📂 Created directory: {self.storage_path}")
            
            # Show current working directory and environment
            self.progress_updated.emit(f"📍 Current working directory: {os.getcwd()}")
            if self.storage_path:
                self.progress_updated.emit(f"🎯 Target storage location: {os.path.abspath(self.storage_path)}")
            
            self.progress_updated.emit(f"⬇️ Starting pull of model: {self.model_name}")
            
            # Run ollama pull command
            cmd = ['ollama', 'pull', self.model_name]
            self.progress_updated.emit(f"🔧 Running command: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                env=env
            )
            
            if process.stdout:
                for line in process.stdout:
                    self.progress_updated.emit(line.strip())
                
            process.wait()
            
            if process.returncode == 0:
                # Check where the model was actually saved
                if self.storage_path and os.path.exists(self.storage_path):
                    model_files = os.listdir(self.storage_path)
                    self.progress_updated.emit(f"✅ Model files found in {self.storage_path}: {model_files}")
                self.operation_completed.emit(True, f"Successfully pulled {self.model_name}")
            else:
                self.operation_completed.emit(False, f"Failed to pull {self.model_name}")
                
        except Exception as e:
            self.operation_completed.emit(False, str(e))
    
    def list_models(self):
        """List available models"""
        try:
            result = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
            if result.returncode == 0:
                self.operation_completed.emit(True, result.stdout)
            else:
                self.operation_completed.emit(False, result.stderr)
        except Exception as e:
            self.operation_completed.emit(False, str(e))

class DarkOllamaChatGUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.chat_app = None
        self.chat_worker = None
        self.model_worker = None
        self.current_storage_path = None
        self.config_file = "gui_config.json"
        
        # Thinking animation variables
        self.thinking_timer = None
        self.thinking_dots = 0
        
        self.init_ui()
        self.init_chat_app()
        self.load_storage_preference()
        
    def init_ui(self):
        self.setWindowTitle("🤖 Ollama Chat - Dark Theme")
        self.setGeometry(100, 100, 1400, 900)
        self.setMinimumSize(1000, 800)
        
        # Set dark theme styling
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1a1a1a;
                color: #ffffff;
            }
            QWidget {
                background-color: #1a1a1a;
                color: #ffffff;
            }
            QGroupBox {
                font-weight: bold;
                border: 2px solid #404040;
                border-radius: 8px;
                margin-top: 1ex;
                padding-top: 10px;
                background-color: #2d2d2d;
                color: #ffffff;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
                color: #00d4ff;
            }
            QPushButton {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #005a9e;
            }
            QPushButton:pressed {
                background-color: #004578;
            }
            QPushButton:disabled {
                background-color: #404040;
                color: #808080;
            }
            QTextEdit {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 12px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
                font-size: 13px;
                selection-background-color: #007acc;
            }
            QLineEdit {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 10px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 13px;
            }
            QLineEdit:focus {
                border: 2px solid #007acc;
            }
            QComboBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 13px;
            }
            QComboBox::drop-down {
                border: none;
                width: 20px;
            }
            QComboBox::down-arrow {
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid #ffffff;
            }
            QComboBox QAbstractItemView {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #404040;
                selection-background-color: #007acc;
            }
            QSpinBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 13px;
            }
            QSpinBox::up-button, QSpinBox::down-button {
                background-color: #404040;
                border: none;
                border-radius: 3px;
            }
            QSpinBox::up-button:hover, QSpinBox::down-button:hover {
                background-color: #007acc;
            }
            QLabel {
                color: #ffffff;
                font-size: 13px;
            }
            QSplitter::handle {
                background-color: #404040;
            }
            QSplitter::handle:horizontal {
                width: 2px;
            }
            QScrollBar:vertical {
                background-color: #2d2d2d;
                width: 12px;
                border-radius: 6px;
            }
            QScrollBar::handle:vertical {
                background-color: #404040;
                border-radius: 6px;
                min-height: 20px;
            }
            QScrollBar::handle:vertical:hover {
                background-color: #007acc;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QStatusBar {
                background-color: #2d2d2d;
                color: #ffffff;
                border-top: 1px solid #404040;
            }
            QListWidget {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 10px;
            }
            QListWidget::item {
                padding: 8px;
                border-bottom: 1px solid #404040;
            }
            QListWidget::item:selected {
                background-color: #007acc;
            }
        """)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(15)
        main_layout.setContentsMargins(20, 20, 20, 20)
        
        # Title
        title_label = QLabel("🤖 Ollama Chat - Dark Theme")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title_label.setStyleSheet("""
            font-size: 28px;
            font-weight: bold;
            color: #00d4ff;
            padding: 15px;
            background-color: #2d2d2d;
            border-radius: 10px;
            border: 2px solid #404040;
        """)
        main_layout.addWidget(title_label)
        
        # Create main content area with horizontal layout
        content_widget = QWidget()
        content_layout = QHBoxLayout(content_widget)
        content_layout.setSpacing(15)
        
        # Left section - Chat area (large and prominent)
        chat_widget = self.create_chat_panel()
        content_layout.addWidget(chat_widget, stretch=8)  # Give chat area most space
        
        # Right section - Compact controls and status
        right_widget = self.create_compact_controls_panel()
        content_layout.addWidget(right_widget, stretch=1)  # Give controls less space
        
        main_layout.addWidget(content_widget)
        
        # Status bar
        self.status_bar = self.statusBar()
        
        # Status timer
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self.update_status)
        self.status_timer.start(5000)  # Update every 5 seconds
        
    def create_controls_panel(self):
        """Create the controls panel with model settings"""
        controls_group = QGroupBox("🎛️ Model Controls")
        controls_layout = QVBoxLayout(controls_group)
        
        # Model selection
        model_layout = QHBoxLayout()
        model_label = QLabel("🤖 Model:")
        model_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.model_combo = QComboBox()
        self.model_combo.setStyleSheet("""
            QComboBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
                min-width: 150px;
            }
            QComboBox::drop-down {
                border: none;
                width: 20px;
            }
            QComboBox::down-arrow {
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid #ffffff;
                margin-right: 5px;
            }
            QComboBox QAbstractItemView {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #404040;
                selection-background-color: #007acc;
            }
        """)
        
        refresh_btn = QPushButton("🔄")
        refresh_btn.setToolTip("Refresh model list")
        refresh_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
                min-width: 40px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        refresh_btn.clicked.connect(self.refresh_models)
        
        # Connect model selection to auto-load
        self.model_combo.currentTextChanged.connect(self.on_model_selected)
        
        model_layout.addWidget(model_label)
        model_layout.addWidget(self.model_combo)
        model_layout.addWidget(refresh_btn)
        model_layout.addStretch()
        controls_layout.addLayout(model_layout)
        
        # Advanced parameters section
        advanced_group = QGroupBox("⚙️ Advanced Parameters")
        advanced_layout = QVBoxLayout(advanced_group)
        
        # Temperature control
        temp_layout = QHBoxLayout()
        temp_label = QLabel("🌡️ Temperature:")
        temp_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.temp_spin = QSpinBox()
        self.temp_spin.setRange(0, 20)
        self.temp_spin.setValue(7)
        self.temp_spin.setSuffix(" / 10")
        self.temp_spin.setToolTip("Controls randomness (0.0 = deterministic, 2.0 = very random)")
        self.temp_spin.setStyleSheet("""
            QSpinBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
                min-width: 80px;
            }
        """)
        temp_layout.addWidget(temp_label)
        temp_layout.addWidget(self.temp_spin)
        temp_layout.addStretch()
        advanced_layout.addLayout(temp_layout)
        
        # Top-p control
        top_p_layout = QHBoxLayout()
        top_p_label = QLabel("🎯 Top-p:")
        top_p_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.top_p_spin = QSpinBox()
        self.top_p_spin.setRange(1, 100)
        self.top_p_spin.setValue(90)
        self.top_p_spin.setSuffix("%")
        self.top_p_spin.setToolTip("Controls diversity via nucleus sampling (1-100)")
        self.top_p_spin.setStyleSheet("""
            QSpinBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
                min-width: 80px;
            }
        """)
        top_p_layout.addWidget(top_p_label)
        top_p_layout.addWidget(self.top_p_spin)
        top_p_layout.addStretch()
        advanced_layout.addLayout(top_p_layout)
        
        # Top-k control
        top_k_layout = QHBoxLayout()
        top_k_label = QLabel("🔝 Top-k:")
        top_k_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.top_k_spin = QSpinBox()
        self.top_k_spin.setRange(1, 100)
        self.top_k_spin.setValue(40)
        self.top_k_spin.setToolTip("Limits the number of tokens considered for each step")
        self.top_k_spin.setStyleSheet("""
            QSpinBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
                min-width: 80px;
            }
        """)
        top_k_layout.addWidget(top_k_label)
        top_k_layout.addWidget(self.top_k_spin)
        top_k_layout.addStretch()
        advanced_layout.addLayout(top_k_layout)
        
        # Repeat penalty control
        repeat_layout = QHBoxLayout()
        repeat_label = QLabel("🔄 Repeat Penalty:")
        repeat_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.repeat_spin = QSpinBox()
        self.repeat_spin.setRange(10, 20)
        self.repeat_spin.setValue(11)
        self.repeat_spin.setSuffix(" / 10")
        self.repeat_spin.setToolTip("Penalizes repetition (1.0 = no penalty, 2.0 = strong penalty)")
        self.repeat_spin.setStyleSheet("""
            QSpinBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
                min-width: 80px;
            }
        """)
        repeat_layout.addWidget(repeat_label)
        repeat_layout.addWidget(self.repeat_spin)
        repeat_layout.addStretch()
        advanced_layout.addLayout(repeat_layout)
        
        # Max tokens control
        max_tokens_layout = QHBoxLayout()
        max_tokens_label = QLabel("📏 Max Tokens:")
        max_tokens_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.max_tokens_spin = QSpinBox()
        self.max_tokens_spin.setRange(100, 8192)
        self.max_tokens_spin.setValue(2048)
        self.max_tokens_spin.setToolTip("Maximum number of tokens to generate")
        self.max_tokens_spin.setStyleSheet("""
            QSpinBox {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
                min-width: 80px;
            }
        """)
        max_tokens_layout.addWidget(max_tokens_label)
        max_tokens_layout.addWidget(self.max_tokens_spin)
        max_tokens_layout.addStretch()
        advanced_layout.addLayout(max_tokens_layout)
        
        controls_layout.addWidget(advanced_group)
        
        # System prompt
        system_group = QGroupBox("💬 System Prompt")
        system_layout = QVBoxLayout(system_group)
        
        self.system_prompt_edit = QTextEdit()
        self.system_prompt_edit.setPlaceholderText("Enter system prompt to guide the AI's behavior...")
        self.system_prompt_edit.setMaximumHeight(100)
        self.system_prompt_edit.setStyleSheet("""
            QTextEdit {
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 12px;
            }
        """)
        system_layout.addWidget(self.system_prompt_edit)
        
        # Load default system prompt
        if self.chat_app and self.chat_app.config:
            self.system_prompt_edit.setText(self.chat_app.config.get("system_prompt", "You are a helpful AI assistant."))
        
        controls_layout.addWidget(system_group)
        
        # Conversation templates
        template_group = QGroupBox("📋 Conversation Templates")
        template_layout = QVBoxLayout(template_group)
        
        template_btn_layout = QHBoxLayout()
        
        # Template buttons
        coding_btn = QPushButton("💻 Coding Assistant")
        coding_btn.setToolTip("Set up for coding help")
        coding_btn.clicked.connect(lambda: self.apply_template("coding"))
        coding_btn.setStyleSheet("""
            QPushButton {
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #138496;
            }
        """)
        
        creative_btn = QPushButton("🎨 Creative Writer")
        creative_btn.setToolTip("Set up for creative writing")
        creative_btn.clicked.connect(lambda: self.apply_template("creative"))
        creative_btn.setStyleSheet("""
            QPushButton {
                background-color: #e83e8c;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #d63384;
            }
        """)
        
        academic_btn = QPushButton("📚 Academic")
        academic_btn.setToolTip("Set up for academic/research work")
        academic_btn.clicked.connect(lambda: self.apply_template("academic"))
        academic_btn.setStyleSheet("""
            QPushButton {
                background-color: #fd7e14;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #e8690b;
            }
        """)
        
        template_btn_layout.addWidget(coding_btn)
        template_btn_layout.addWidget(creative_btn)
        template_btn_layout.addWidget(academic_btn)
        template_btn_layout.addStretch()
        template_layout.addLayout(template_btn_layout)
        
        controls_layout.addWidget(template_group)
        
        # Action buttons
        buttons_layout = QHBoxLayout()
        
        clear_btn = QPushButton("🗑️ Clear Chat")
        clear_btn.setToolTip("Clear the current chat history")
        clear_btn.clicked.connect(self.clear_chat)
        clear_btn.setStyleSheet("""
            QPushButton {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #c82333;
            }
        """)
        
        save_btn = QPushButton("💾 Save Chat")
        save_btn.setToolTip("Save current chat to file")
        save_btn.clicked.connect(self.save_chat_history)
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        
        load_btn = QPushButton("📂 Load Chat")
        load_btn.setToolTip("Load chat from file")
        load_btn.clicked.connect(self.load_chat_history)
        load_btn.setStyleSheet("""
            QPushButton {
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #138496;
            }
        """)
        
        buttons_layout.addWidget(clear_btn)
        buttons_layout.addWidget(save_btn)
        buttons_layout.addWidget(load_btn)
        buttons_layout.addStretch()
        controls_layout.addLayout(buttons_layout)
        
        # Storage management
        storage_group = QGroupBox("💾 Storage Management")
        storage_layout = QVBoxLayout(storage_group)
        
        storage_btn = QPushButton("📁 Set Storage Location")
        storage_btn.setToolTip("Set custom storage location for models")
        storage_btn.clicked.connect(self.set_storage_location)
        storage_btn.setStyleSheet("""
            QPushButton {
                background-color: #6f42c1;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #5a32a3;
            }
        """)
        storage_layout.addWidget(storage_btn)
        
        # Current storage display
        self.storage_label = QLabel("Default storage location")
        self.storage_label.setStyleSheet("""
            color: #6c757d;
            font-size: 11px;
            padding: 5px;
            background-color: #1a1a1a;
            border-radius: 4px;
        """)
        storage_layout.addWidget(self.storage_label)
        
        controls_layout.addWidget(storage_group)
        
        # Status display
        status_layout = QHBoxLayout()
        status_label = QLabel("Status:")
        status_label.setStyleSheet("font-weight: bold; color: #ffffff;")
        self.status_label = QLabel("Initializing...")
        self.status_label.setStyleSheet("""
            padding: 4px 8px;
            border-radius: 4px;
            background-color: #2d2d2d;
            color: #ffc107;
            font-weight: bold;
            font-size: 11px;
            min-width: 120px;
        """)
        status_layout.addWidget(status_label)
        status_layout.addWidget(self.status_label)
        status_layout.addStretch()
        controls_layout.addLayout(status_layout)
        
        return controls_group
        
    def create_chat_panel(self):
        """Create the chat panel"""
        chat_widget = QWidget()
        chat_layout = QVBoxLayout(chat_widget)
        chat_layout.setSpacing(15)
        
        # Chat history (prominent and large)
        chat_group = QGroupBox("💭 Chat Area")
        chat_group_layout = QVBoxLayout(chat_group)
        
        self.chat_display = QTextEdit()
        self.chat_display.setReadOnly(True)
        self.chat_display.setStyleSheet("""
            QTextEdit {
                font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
                font-size: 14px;
                line-height: 1.6;
                background-color: #1a1a1a;
                color: #ffffff;
                border: none;
                padding: 20px;
                min-height: 400px;
            }
        """)
        chat_group_layout.addWidget(self.chat_display)
        chat_layout.addWidget(chat_group)
        
        # Input area (prominent)
        input_group = QGroupBox("✍️ Send Message")
        input_layout = QHBoxLayout(input_group)
        input_layout.setSpacing(10)
        
        self.message_input = QLineEdit()
        self.message_input.setPlaceholderText("Type your message here and press Enter or click Send...")
        self.message_input.returnPressed.connect(self.send_message)
        self.message_input.setStyleSheet("""
            QLineEdit {
                border: 2px solid #404040;
                border-radius: 8px;
                padding: 15px;
                background-color: #2d2d2d;
                color: #ffffff;
                font-size: 15px;
                min-height: 20px;
            }
            QLineEdit:focus {
                border: 2px solid #007acc;
            }
            QLineEdit::placeholder {
                color: #808080;
            }
        """)
        input_layout.addWidget(self.message_input, stretch=1)
        
        send_btn = QPushButton("🚀 Send")
        send_btn.clicked.connect(self.send_message)
        send_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 15px;
                min-width: 100px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        input_layout.addWidget(send_btn)
        
        chat_layout.addWidget(input_group)
        
        return chat_widget
        
    def create_compact_controls_panel(self):
        """Create a compact controls panel for the right side"""
        controls_widget = QWidget()
        controls_layout = QVBoxLayout(controls_widget)
        controls_layout.setSpacing(10)
        
        # Model selection (compact vertical)
        model_group = QGroupBox("🤖 Model")
        model_layout = QVBoxLayout(model_group)
        model_layout.setSpacing(5)
        
        model_label = QLabel("Model:")
        model_label.setStyleSheet("font-weight: bold; color: #00d4ff; font-size: 11px;")
        model_layout.addWidget(model_label)
        
        self.model_combo = QComboBox()
        self.model_combo.setEditable(True)
        self.model_combo.setStyleSheet("""
            QComboBox {
                font-size: 11px;
                padding: 4px 8px;
            }
        """)
        # Connect model selection to auto-load
        self.model_combo.currentTextChanged.connect(self.on_model_selected)
        model_layout.addWidget(self.model_combo)
        
        # Model buttons in horizontal layout
        model_btn_layout = QHBoxLayout()
        
        refresh_btn = QPushButton("🔄")
        refresh_btn.clicked.connect(self.refresh_models)
        refresh_btn.setToolTip("Refresh Models")
        refresh_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 11px;
                min-width: 30px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        model_btn_layout.addWidget(refresh_btn)
        
        pull_btn = QPushButton("⬇️")
        pull_btn.clicked.connect(self.pull_model)
        pull_btn.setToolTip("Pull Model")
        pull_btn.setStyleSheet("""
            QPushButton {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 11px;
                min-width: 30px;
            }
            QPushButton:hover {
                background-color: #005a9e;
            }
        """)
        model_btn_layout.addWidget(pull_btn)
        
        model_layout.addLayout(model_btn_layout)
        controls_layout.addWidget(model_group)
        
        # Temperature (compact vertical)
        temp_group = QGroupBox("🌡️ Temperature")
        temp_layout = QVBoxLayout(temp_group)
        temp_layout.setSpacing(5)
        
        temp_label = QLabel("Temperature:")
        temp_label.setStyleSheet("font-weight: bold; color: #00d4ff; font-size: 11px;")
        temp_layout.addWidget(temp_label)
        
        self.temp_spin = QSpinBox()
        self.temp_spin.setRange(0, 15)
        self.temp_spin.setValue(7)
        self.temp_spin.setSuffix(" (0.7)")
        self.temp_spin.setStyleSheet("""
            QSpinBox {
                font-size: 11px;
                padding: 4px 8px;
            }
        """)
        temp_layout.addWidget(self.temp_spin)
        
        controls_layout.addWidget(temp_group)
        
        # Templates (compact)
        template_group = QGroupBox("📋 Templates")
        template_layout = QVBoxLayout(template_group)
        template_layout.setSpacing(5)
        
        template_btn_layout = QHBoxLayout()
        
        coding_btn = QPushButton("💻")
        coding_btn.setToolTip("Coding Assistant")
        coding_btn.clicked.connect(lambda: self.apply_template("coding"))
        coding_btn.setStyleSheet("""
            QPushButton {
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 10px;
                min-width: 25px;
            }
            QPushButton:hover {
                background-color: #138496;
            }
        """)
        
        creative_btn = QPushButton("🎨")
        creative_btn.setToolTip("Creative Writer")
        creative_btn.clicked.connect(lambda: self.apply_template("creative"))
        creative_btn.setStyleSheet("""
            QPushButton {
                background-color: #e83e8c;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 10px;
                min-width: 25px;
            }
            QPushButton:hover {
                background-color: #d63384;
            }
        """)
        
        academic_btn = QPushButton("📚")
        academic_btn.setToolTip("Academic")
        academic_btn.clicked.connect(lambda: self.apply_template("academic"))
        academic_btn.setStyleSheet("""
            QPushButton {
                background-color: #fd7e14;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 10px;
                min-width: 25px;
            }
            QPushButton:hover {
                background-color: #e8690b;
            }
        """)
        
        fast_btn = QPushButton("⚡")
        fast_btn.setToolTip("Fast Responses")
        fast_btn.clicked.connect(lambda: self.apply_template("fast"))
        fast_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 10px;
                min-width: 25px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        
        template_btn_layout.addWidget(coding_btn)
        template_btn_layout.addWidget(creative_btn)
        template_btn_layout.addWidget(academic_btn)
        template_btn_layout.addWidget(fast_btn)
        template_btn_layout.addStretch()
        template_layout.addLayout(template_btn_layout)
        
        controls_layout.addWidget(template_group)
        
        # Quick actions (compact vertical)
        actions_group = QGroupBox("⚡ Actions")
        actions_layout = QVBoxLayout(actions_group)
        actions_layout.setSpacing(5)
        
        save_btn = QPushButton("💾 Save")
        save_btn.clicked.connect(self.save_chat_history)
        save_btn.setToolTip("Save Chat")
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        actions_layout.addWidget(save_btn)
        
        load_btn = QPushButton("📂 Load")
        load_btn.clicked.connect(self.load_chat_history)
        load_btn.setToolTip("Load Chat")
        load_btn.setStyleSheet("""
            QPushButton {
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #138496;
            }
        """)
        actions_layout.addWidget(load_btn)
        
        clear_btn = QPushButton("🗑️ Clear")
        clear_btn.clicked.connect(self.clear_chat)
        clear_btn.setToolTip("Clear Chat")
        clear_btn.setStyleSheet("""
            QPushButton {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #c82333;
            }
        """)
        actions_layout.addWidget(clear_btn)
        
        controls_layout.addWidget(actions_group)
        
        # System prompt (compact vertical)
        prompt_group = QGroupBox("💬 System Prompt")
        prompt_layout = QVBoxLayout(prompt_group)
        prompt_layout.setSpacing(5)
        
        prompt_label = QLabel("System Prompt:")
        prompt_label.setStyleSheet("font-weight: bold; color: #00d4ff; font-size: 11px;")
        prompt_layout.addWidget(prompt_label)
        
        self.system_prompt_edit = QLineEdit()
        self.system_prompt_edit.setPlaceholderText("You are a helpful AI assistant.")
        self.system_prompt_edit.setStyleSheet("""
            QLineEdit {
                font-size: 11px;
                padding: 4px 8px;
            }
        """)
        prompt_layout.addWidget(self.system_prompt_edit)
        
        controls_layout.addWidget(prompt_group)
        
        # Status (compact vertical) - moved here under system prompt
        status_group = QGroupBox("📊 Status")
        status_layout = QVBoxLayout(status_group)
        status_layout.setSpacing(5)
        
        self.status_label = QLabel("Checking...")
        self.status_label.setStyleSheet("""
            padding: 4px 8px;
            border-radius: 4px;
            background-color: #2d2d2d;
            color: #ffc107;
            font-weight: bold;
            font-size: 11px;
        """)
        status_layout.addWidget(self.status_label)
        
        controls_layout.addWidget(status_group)
        
        # Info display (compact)
        info_group = QGroupBox("ℹ️ Info")
        info_layout = QVBoxLayout(info_group)
        info_layout.setSpacing(2)
        
        self.info_label = QLabel("Ready to chat")
        self.info_label.setStyleSheet("""
            padding: 2px 4px;
            border-radius: 2px;
            background-color: #1a1a1a;
            color: #00d4ff;
            font-weight: bold;
            font-size: 9px;
            max-height: 40px;
        """)
        self.info_label.setWordWrap(True)
        info_layout.addWidget(self.info_label)
        
        controls_layout.addWidget(info_group)
        
        # Add stretch to push everything to the top
        controls_layout.addStretch()
        
        return controls_widget
        
    def init_chat_app(self):
        """Initialize the chat application"""
        try:
            self.chat_app = OllamaChat()
            self.refresh_models()
            self.update_status()
            # Show welcome message in status instead of chat
            self.status_label.setText("🎉 GUI Ready - Select a model to start!")
        except Exception as e:
            self.status_label.setText(f"❌ Error: {e}")
            
    def update_status(self):
        """Update the connection status"""
        if not self.chat_app:
            self.status_label.setText("❌ Chat app not available")
            self.status_label.setStyleSheet("""
                padding: 4px 8px;
                border-radius: 4px;
                background-color: #2d2d2d;
                color: #dc3545;
                font-weight: bold;
                font-size: 11px;
                min-width: 120px;
            """)
            return
            
        try:
            installed = self.chat_app.check_ollama_installation()
            running = self.chat_app.check_ollama_server()
            
            if not installed:
                self.status_label.setText("❌ Ollama not installed")
                self.status_label.setStyleSheet("""
                    padding: 4px 8px;
                    border-radius: 4px;
                    background-color: #2d2d2d;
                    color: #dc3545;
                    font-weight: bold;
                    font-size: 11px;
                    min-width: 120px;
                """)
            elif not running:
                self.status_label.setText("🔴 Server offline")
                self.status_label.setStyleSheet("""
                    padding: 4px 8px;
                    border-radius: 4px;
                    background-color: #2d2d2d;
                    color: #dc3545;
                    font-weight: bold;
                    font-size: 11px;
                    min-width: 120px;
                """)
            else:
                self.status_label.setText("🟢 Connected")
                self.status_label.setStyleSheet("""
                    padding: 4px 8px;
                    border-radius: 4px;
                    background-color: #2d2d2d;
                    color: #28a745;
                    font-weight: bold;
                    font-size: 11px;
                    min-width: 120px;
                """)
        except Exception as e:
            self.status_label.setText(f"⚠️ Error")
            self.status_label.setStyleSheet("""
                padding: 4px 8px;
                border-radius: 4px;
                background-color: #2d2d2d;
                color: #ffc107;
                font-weight: bold;
                font-size: 11px;
                min-width: 120px;
            """)
            
    def refresh_models_old(self):
        """Refresh the list of available models (legacy method)"""
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
        if self.chat_app:
            self.chat_app.add_to_history("user", message)
        
        # Update configuration with basic parameters
        system_prompt = ""
        try:
            # Update temperature
            temp_value = self.temp_spin.value() / 10.0
            self.chat_app.config["temperature"] = temp_value
            
            # Update advanced parameters if they exist (for templates)
            if hasattr(self, 'top_p_spin'):
                self.chat_app.config["top_p"] = self.top_p_spin.value() / 100.0
            if hasattr(self, 'top_k_spin'):
                self.chat_app.config["top_k"] = self.top_k_spin.value()
            if hasattr(self, 'repeat_spin'):
                self.chat_app.config["repeat_penalty"] = self.repeat_spin.value() / 10.0
            if hasattr(self, 'max_tokens_spin'):
                self.chat_app.config["max_tokens"] = self.max_tokens_spin.value()
            
            # Update model - extract clean model name from dropdown text
            model_text = self.model_combo.currentText()
            if model_text and model_text != "──────────":
                # Extract clean model name
                if model_text.startswith("✅ "):
                    model = model_text.replace("✅ ", "").split(" (Downloaded")[0]
                elif model_text.startswith("⚡ "):
                    model = model_text.replace("⚡ ", "").split(" (Fast")[0]
                elif model_text.startswith("📥 "):
                    model = model_text.replace("📥 ", "").split(" (Download")[0]
                else:
                    model = model_text
                
                if model and model != self.chat_app.config["model"]:
                    self.chat_app.config["model"] = model
                    self.chat_app.save_config(self.chat_app.config)
                
            # Update system prompt
            try:
                system_prompt = self.system_prompt_edit.toPlainText()
            except AttributeError:
                system_prompt = self.system_prompt_edit.text()
            self.chat_app.config["system_prompt"] = system_prompt
            self.chat_app.save_config(self.chat_app.config)
            
        except Exception as e:
            self.add_system_message(f"⚠️ Error updating config: {e}")
        
        # Show thinking animation
        self.add_assistant_message("🤔 Thinking")
        self.start_thinking_animation()
        
        # Start worker thread with advanced parameters
        self.chat_worker = ChatWorker(self.chat_app, message, system_prompt)
        self.chat_worker.response_received.connect(self.handle_response)
        self.chat_worker.error_occurred.connect(self.handle_error)
        self.chat_worker.start()
        
    def handle_response(self, response):
        """Handle the AI response"""
        # Replace "Thinking..." with actual response
        self.replace_last_message(response)
        
        # Add to chat history
        if self.chat_app:
            self.chat_app.add_to_history("assistant", response)
        
    def handle_error(self, error):
        """Handle errors from the worker thread"""
        self.replace_last_message(f"❌ Error: {error}")
        self.current_streaming_message = ""  # Clear message on error
        self.current_streaming_timestamp = ""  # Clear timestamp
        self.streaming_worker = None  # Clear worker reference
        
    def add_user_message(self, message):
        """Add a user message to the chat display"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #007acc;"><span style="color: #007acc; font-weight: bold;">👤 You ({timestamp}):</span><br><span style="color: #ffffff;">{message}</span></div>')
        self.scroll_to_bottom()
        
    def add_assistant_message(self, message):
        """Add an assistant message to the chat display"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #28a745;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br><span style="color: #ffffff;">{message}</span></div>')
        self.scroll_to_bottom()
        
    def add_system_message(self, message):
        """Add a system message to the chat display"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #6c757d;"><span style="color: #6c757d; font-weight: bold;">⚙️ System ({timestamp}):</span><br><span style="color: #ffffff;">{message}</span></div>')
        self.scroll_to_bottom()
        
    def replace_last_message(self, new_message):
        """Replace the last message in the chat display"""
        # Stop thinking animation if running
        self.stop_thinking_animation()
        
        cursor = self.chat_display.textCursor()
        cursor.movePosition(QTextCursor.MoveOperation.End)
        cursor.movePosition(QTextCursor.MoveOperation.StartOfLine, QTextCursor.MoveMode.KeepAnchor)
        cursor.movePosition(QTextCursor.MoveOperation.Up, QTextCursor.MoveMode.KeepAnchor)
        cursor.removeSelectedText()
        cursor.deletePreviousChar()  # Remove the line break
        
        # Add the new message
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #28a745;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br><span style="color: #ffffff;">{new_message}</span></div>')
        self.scroll_to_bottom()
        
    def start_thinking_animation(self):
        """Start the thinking animation with animated dots"""
        self.thinking_dots = 0
        self.thinking_timer = QTimer()
        self.thinking_timer.timeout.connect(self.update_thinking_animation)
        self.thinking_timer.start(500)  # Update every 500ms
        
    def stop_thinking_animation(self):
        """Stop the thinking animation"""
        if self.thinking_timer:
            self.thinking_timer.stop()
            self.thinking_timer = None
            
    def update_thinking_animation(self):
        """Update the thinking animation dots"""
        self.thinking_dots = (self.thinking_dots + 1) % 4
        dots = "." * self.thinking_dots
        
        # Update the thinking message
        cursor = self.chat_display.textCursor()
        cursor.movePosition(QTextCursor.MoveOperation.End)
        cursor.movePosition(QTextCursor.MoveOperation.StartOfLine, QTextCursor.MoveMode.KeepAnchor)
        cursor.movePosition(QTextCursor.MoveOperation.Up, QTextCursor.MoveMode.KeepAnchor)
        cursor.removeSelectedText()
        cursor.deletePreviousChar()
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #28a745;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br><span style="color: #ffffff;">🤔 Thinking{dots}</span></div>')
        self.scroll_to_bottom()
        
    def scroll_to_bottom(self):
        """Scroll the chat display to the bottom"""
        scrollbar = self.chat_display.verticalScrollBar()
        if scrollbar:
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
                self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #007acc;"><span style="color: #007acc; font-weight: bold;">👤 You ({timestamp}):</span><br><span style="color: #ffffff;">{entry["content"]}</span></div>')
            else:
                self.chat_display.append(f'<div style="margin: 15px 0; padding: 10px; border-left: 4px solid #28a745;"><span style="color: #28a745; font-weight: bold;">🤖 Assistant ({timestamp}):</span><br><span style="color: #ffffff;">{entry["content"]}</span></div>')
                
        self.scroll_to_bottom()
        
    def clear_chat(self):
        """Clear the chat display and history"""
        self.chat_display.clear()
        if self.chat_app:
            self.chat_app.chat_history.clear()
        self.add_system_message("��️ Chat cleared.")

    def set_storage_location(self):
        """Open a dialog to select a storage location for Ollama models"""
        dialog = StorageDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted and dialog.selected_path:
            self.current_storage_path = dialog.selected_path
            self.storage_label.setText(f"Current: {self.current_storage_path}")
            self.add_system_message(f"💾 Storage location set to: {self.current_storage_path}")
            
            # Save the preference
            self.save_storage_preference()
            
            # Create the directory if it doesn't exist
            if not os.path.exists(self.current_storage_path):
                try:
                    os.makedirs(self.current_storage_path, exist_ok=True)
                    self.add_system_message(f"📂 Created directory: {self.current_storage_path}")
                except Exception as e:
                    self.add_system_message(f"❌ Error creating directory: {e}")
                    return
            
            # Check if Ollama server is running and restart it with new environment
            if self.chat_app and self.chat_app.check_ollama_server():
                self.add_system_message("🔄 Restarting Ollama server with new storage location...")
                self.restart_ollama_with_new_storage()
            else:
                self.add_system_message("💡 Next time you start Ollama, it will use this storage location")
        else:
            self.add_system_message("Storage location not changed.")
            
    def restart_ollama_with_new_storage(self):
        """Restart Ollama server with the new storage location"""
        try:
            # Stop current Ollama server
            self.add_system_message("🛑 Stopping Ollama server...")
            subprocess.run(['pkill', 'ollama'], capture_output=True, text=True)
            time.sleep(2)
            
            # Start Ollama with new environment
            self.add_system_message("🚀 Starting Ollama server with new storage location...")
            env = os.environ.copy()
            if self.current_storage_path:
                env['OLLAMA_MODELS'] = self.current_storage_path
            
            # Start ollama serve in background
            subprocess.Popen(['ollama', 'serve'], 
                           stdout=subprocess.DEVNULL, 
                           stderr=subprocess.DEVNULL,
                           env=env)
            
            # Wait for server to start
            for i in range(10):
                time.sleep(1)
                if self.chat_app and self.chat_app.check_ollama_server():
                    self.add_system_message("🟢 Ollama server restarted successfully with new storage location!")
                    self.update_status()
                    return
            
            self.add_system_message("⚠️ Ollama server restart may have failed. Please restart manually.")
            
        except Exception as e:
            self.add_system_message(f"❌ Error restarting Ollama: {e}")

    def detect_drives(self):
        """Open a dialog to display available drives"""
        dialog = StorageDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.current_storage_path = dialog.selected_path
            self.storage_label.setText(f"Current: {self.current_storage_path}")
            self.add_system_message(f"🔍 Detected storage location: {self.current_storage_path}")
        else:
            self.add_system_message("No storage location selected.")
            
    def start_ollama_server(self):
        """Start the Ollama server"""
        if not self.chat_app:
            self.add_system_message("❌ Chat app not available")
            return
            
        self.add_system_message("🚀 Attempting to start Ollama server...")
        
        if self.chat_app.start_ollama_server():
            self.add_system_message("🟢 Ollama server started successfully!")
            self.update_status()  # Update the status display
        else:
            self.add_system_message("❌ Failed to start Ollama server. Please check if Ollama is installed.")
            
    def load_storage_preference(self):
        """Load saved storage preference from config file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    saved_path = config.get('storage_path')
                    if saved_path and os.path.exists(saved_path):
                        self.current_storage_path = saved_path
                        self.storage_label.setText(f"Current: {self.current_storage_path}")
                        self.info_label.setText(f"💾 Storage: {self.current_storage_path}")
                    else:
                        self.info_label.setText("📁 Using default storage")
            else:
                self.info_label.setText("📁 Using default storage")
        except Exception as e:
            self.add_system_message(f"⚠️ Error loading storage preference: {e}")
            
    def save_storage_preference(self):
        """Save current storage preference to config file"""
        try:
            config = {
                'storage_path': self.current_storage_path,
                'last_updated': datetime.now().isoformat()
            }
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            self.add_system_message(f"⚠️ Error saving storage preference: {e}")
            
    def check_storage_location(self):
        """Check where models are currently stored"""
        try:
            # Check default Ollama storage location
            default_location = os.path.expanduser("~/.ollama")
            if os.path.exists(default_location):
                self.add_system_message(f"📁 Default Ollama storage: {default_location}")
                if os.path.exists(os.path.join(default_location, "models")):
                    models_dir = os.path.join(default_location, "models")
                    model_files = os.listdir(models_dir)
                    self.add_system_message(f"📋 Models in default location: {model_files}")
            
            # Check current custom storage path
            if self.current_storage_path:
                self.add_system_message(f"🎯 Custom storage path: {self.current_storage_path}")
                if os.path.exists(self.current_storage_path):
                    files = os.listdir(self.current_storage_path)
                    self.add_system_message(f"📋 Files in custom location: {files}")
                else:
                    self.add_system_message("⚠️ Custom storage path does not exist yet")
            
            # Check OLLAMA_MODELS environment variable
            ollama_models_env = os.environ.get('OLLAMA_MODELS')
            if ollama_models_env:
                self.add_system_message(f"🔧 OLLAMA_MODELS environment variable: {ollama_models_env}")
            else:
                self.add_system_message("🔧 OLLAMA_MODELS environment variable: Not set (using default)")
                
        except Exception as e:
            self.add_system_message(f"❌ Error checking storage: {e}")

    def pull_model(self):
        """Pull a model to the current storage location"""
        if not self.chat_app:
            self.add_system_message("❌ Chat app not available")
            return
            
        model_name = self.model_combo.currentText().strip()
        if not model_name:
            self.add_system_message("Please select a model from the dropdown to pull.")
            return
            
        # Extract actual model name from display text (remove indicators)
        if model_name.startswith("✅ "):
            self.add_system_message("This model is already downloaded!")
            return
        elif model_name.startswith("⚡ "):
            model_name = model_name.replace("⚡ ", "").split(" (Fast")[0]
        elif model_name.startswith("📥 "):
            model_name = model_name.replace("📥 ", "").split(" (Download")[0]
        elif model_name == "──────────":
            self.add_system_message("Please select a model to download.")
            return
            
        # Check if Ollama server is running
        if not self.chat_app.check_ollama_server():
            self.add_system_message("🔴 Ollama server not running. Attempting to start it...")
            if self.chat_app.start_ollama_server():
                self.add_system_message("🟢 Ollama server started successfully!")
            else:
                self.add_system_message("❌ Failed to start Ollama server. Please start it manually with 'ollama serve'")
                return
            
        # Check if storage path is set, if not use default
        storage_path = self.current_storage_path
        if not storage_path:
            self.add_system_message("No custom storage path set. Using default Ollama location.")
            storage_path = None
            
        self.add_system_message(f"⬇️ Starting download of model: {model_name}")
        if storage_path:
            self.add_system_message(f"📁 Storage location: {storage_path}")
        
        self.model_worker = ModelWorker("pull", model_name, storage_path)
        self.model_worker.progress_updated.connect(self.add_system_message)
        self.model_worker.operation_completed.connect(self.handle_model_operation_result)
        self.model_worker.start()
        
    def refresh_models(self):
        """Refresh the list of available models"""
        if not self.chat_app:
            self.add_system_message("❌ Chat app not available")
            return
            
        try:
            # Get available models from Ollama API
            installed_models = self.chat_app.get_available_models()
            
            # Clear and populate the dropdown
            self.model_combo.clear()
            
            # Fast models for quick access
            fast_models = [
                "orca-mini:3b", "phi:2.7b", "llama2:7b", "mistral:7b"
            ]
            
            # Popular models
            popular_models = [
                "llama2", "llama2:13b", "llama2:70b", "llama2:chat",
                "codellama", "codellama:7b", "codellama:13b", "codellama:34b",
                "mistral", "mistral:instruct", "mistral:latest",
                "neural-chat", "vicuna", "wizard-vicuna-uncensored",
                "orca-mini", "orca-mini:7b", "dolphin-phi", "phi", "phi:3.5b"
            ]
            
            # Add installed models first (with ✅ indicator)
            for model in installed_models:
                self.model_combo.addItem(f"✅ {model} (Downloaded)")
            
            # Add separator
            self.model_combo.addItem("──────────")
            
            # Add fast models that aren't installed (with ⚡ indicator)
            for model in fast_models:
                if model not in installed_models:
                    self.model_combo.addItem(f"⚡ {model} (Fast - 1.6-4GB)")
            
            # Add popular models that aren't installed (with 📥 indicator)
            for model in popular_models:
                if model not in installed_models and model not in fast_models:
                    self.model_combo.addItem(f"📥 {model} (Download)")
            
            # Set current model if it exists in the list
            current_model = self.chat_app.config["model"]
            found_current = False
            for i in range(self.model_combo.count()):
                item_text = self.model_combo.itemText(i)
                if current_model in item_text:
                    self.model_combo.setCurrentIndex(i)
                    found_current = True
                    break
            
            if not found_current:
                if installed_models:
                    # Set to first installed model
                    self.model_combo.setCurrentIndex(0)
                else:
                    # Set to first available model
                    self.model_combo.setCurrentIndex(0)
                
            # Show model info in info area
            if installed_models:
                self.info_label.setText(f"✅ {len(installed_models)} downloaded\n📥 {len(fast_models + popular_models)} available")
            else:
                self.info_label.setText(f"📥 {len(fast_models + popular_models)} models available")
                
        except Exception as e:
            self.add_system_message(f"❌ Error refreshing models: {e}")
            # Add fallback models
            fallback_models = ["llama2", "mistral", "codellama", "llama2:7b", "mistral:7b"]
            self.model_combo.clear()
            for model in fallback_models:
                self.model_combo.addItem(f"📥 {model} (Download)")
            self.model_combo.setCurrentIndex(0)
    
    def on_model_selected(self, model_text):
        """Handle model selection from dropdown"""
        if not model_text or model_text == "──────────":
            return
            
        # Extract clean model name
        if model_text.startswith("✅ "):
            # Downloaded model - load it
            model_name = model_text.replace("✅ ", "").split(" (Downloaded")[0]
            self.load_selected_model(model_name)
        elif model_text.startswith("⚡ "):
            # Fast model - download and load
            model_name = model_text.replace("⚡ ", "").split(" (Fast")[0]
            self.pull_model(model_name)
        elif model_text.startswith("📥 "):
            # Available model - download and load
            model_name = model_text.replace("📥 ", "").split(" (Download")[0]
            self.pull_model(model_name)
    
    def load_selected_model(self, model_name):
        """Load the selected model into the chat app"""
        if not self.chat_app:
            self.add_system_message("❌ Chat app not available")
            return
            
        try:
            # Update the model in chat app config
            self.chat_app.config["model"] = model_name
            self.chat_app.save_config(self.chat_app.config)
            
            self.add_system_message(f"🤖 Loaded model: {model_name}")
            self.status_label.setText(f"🤖 {model_name}")
            
        except Exception as e:
            self.add_system_message(f"❌ Error loading model {model_name}: {e}")
        
    def handle_model_operation_result(self, success, message):
        """Handle the result of a model operation (pull or list)"""
        if success:
            self.add_system_message(f"✅ {message}")
            # Refresh the model list after a successful pull
            if "Successfully pulled" in message:
                self.add_system_message("🔄 Refreshing model list...")
                QTimer.singleShot(2000, self.refresh_models)  # Refresh after 2 seconds
        else:
            self.add_system_message(f"❌ Error: {message}")

    def apply_template(self, template_type):
        """Apply a conversation template"""
        templates = {
            "coding": {
                "system_prompt": "You are an expert software developer and coding assistant. Provide clear, well-documented code examples, explain technical concepts thoroughly, and suggest best practices. Always consider security, performance, and maintainability in your recommendations.",
                "temperature": 0.3,
                "top_p": 0.8,
                "top_k": 30,
                "repeat_penalty": 1.1,
                "max_tokens": 2048
            },
            "creative": {
                "system_prompt": "You are a creative writing assistant with expertise in storytelling, poetry, and creative expression. Help users develop their ideas, provide writing prompts, and offer constructive feedback on creative works. Be imaginative and inspiring.",
                "temperature": 0.9,
                "top_p": 0.95,
                "top_k": 50,
                "repeat_penalty": 1.05,
                "max_tokens": 3072
            },
            "academic": {
                "system_prompt": "You are an academic research assistant with expertise in scholarly writing, research methodology, and critical analysis. Help users with academic writing, research questions, literature reviews, and scholarly discussions. Maintain academic rigor and cite sources when appropriate.",
                "temperature": 0.4,
                "top_p": 0.85,
                "top_k": 35,
                "repeat_penalty": 1.15,
                "max_tokens": 4096
            },
            "fast": {
                "system_prompt": "Be brief and direct. Answer in 1-2 sentences maximum.",
                "temperature": 0.2,
                "max_tokens": 200
            }
        }
        
        if template_type in templates:
            template = templates[template_type]
            
            # Apply template settings
            try:
                self.system_prompt_edit.setPlainText(template["system_prompt"])
            except AttributeError:
                self.system_prompt_edit.setText(template["system_prompt"])
                
            self.temp_spin.setValue(int(template["temperature"] * 10))
            
            # Only apply parameters that exist in the template and UI
            if "top_p" in template and hasattr(self, 'top_p_spin'):
                self.top_p_spin.setValue(int(template["top_p"] * 100))
            if "top_k" in template and hasattr(self, 'top_k_spin'):
                self.top_k_spin.setValue(template["top_k"])
            if "repeat_penalty" in template and hasattr(self, 'repeat_spin'):
                self.repeat_spin.setValue(int(template["repeat_penalty"] * 10))
            if "max_tokens" in template and hasattr(self, 'max_tokens_spin'):
                self.max_tokens_spin.setValue(template["max_tokens"])
            
            # Update config
            if self.chat_app:
                self.chat_app.config.update(template)
                self.chat_app.save_config(self.chat_app.config)
            
            self.add_system_message(f"📋 Applied {template_type} template")

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Ollama Chat Dark")
    app.setApplicationVersion("1.0")
    
    # Set application style
    app.setStyle('Fusion')
    
    window = DarkOllamaChatGUI()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main() 