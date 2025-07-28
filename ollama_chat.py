#!/usr/bin/env python3
"""
Ollama Chat Application
A Python application to interact with local Ollama models via the API.
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union

import requests
from colorama import Fore, Style, init

# Initialize colorama for cross-platform colored output
init(autoreset=True)

class OllamaChat:
    """Main class for the Ollama chat application."""
    
    def __init__(self, config_file: str = "chat_config.json"):
        self.config_file = config_file
        self.api_base_url = "http://localhost:11434"
        self.chat_history: List[Dict] = []
        self.config = self.load_config()
        
    def load_config(self) -> Dict:
        """Load configuration from file or create default."""
        default_config = {
            "model": "llama2",
            "temperature": 0.7,
            "system_prompt": "You are a helpful AI assistant.",
            "max_tokens": 2048,
            "top_p": 0.9,
            "top_k": 40,
            "repeat_penalty": 1.1,
            "chat_history_file": "chat_history.json"
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults to ensure all keys exist
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
                    return config
            except (json.JSONDecodeError, IOError) as e:
                print(f"{Fore.YELLOW}Warning: Could not load config file: {e}")
                return default_config
        else:
            # Create default config file
            self.save_config(default_config)
            return default_config
    
    def save_config(self, config: Dict) -> None:
        """Save configuration to file."""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except IOError as e:
            print(f"{Fore.RED}Error saving config: {e}")
    
    def check_ollama_installation(self) -> bool:
        """Check if Ollama is installed on the system."""
        try:
            result = subprocess.run(['which', 'ollama'], 
                                  capture_output=True, text=True, check=False)
            if result.returncode == 0:
                return True
            else:
                # Try alternative method for Windows
                result = subprocess.run(['ollama', '--version'], 
                                      capture_output=True, text=True, check=False)
                return result.returncode == 0
        except FileNotFoundError:
            return False
    
    def check_ollama_server(self) -> bool:
        """Check if Ollama server is running and accessible."""
        try:
            response = requests.get(f"{self.api_base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def start_ollama_server(self) -> bool:
        """Attempt to start the Ollama server."""
        print(f"{Fore.YELLOW}Attempting to start Ollama server...")
        try:
            # Start ollama in background
            subprocess.Popen(['ollama', 'serve'], 
                           stdout=subprocess.DEVNULL, 
                           stderr=subprocess.DEVNULL)
            
            # Wait for server to start
            for _ in range(10):
                time.sleep(1)
                if self.check_ollama_server():
                    print(f"{Fore.GREEN}Ollama server started successfully!")
                    return True
            
            print(f"{Fore.RED}Failed to start Ollama server within timeout.")
            return False
        except Exception as e:
            print(f"{Fore.RED}Error starting Ollama server: {e}")
            return False
    
    def get_available_models(self) -> List[str]:
        """Get list of available models from Ollama."""
        try:
            response = requests.get(f"{self.api_base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return [model['name'] for model in data.get('models', [])]
            return []
        except requests.RequestException:
            return []
    
    def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama."""
        print(f"{Fore.YELLOW}Pulling model '{model_name}'... This may take a while.")
        try:
            response = requests.post(
                f"{self.api_base_url}/api/pull",
                json={"name": model_name},
                timeout=300  # 5 minutes timeout for model download
            )
            if response.status_code == 200:
                print(f"{Fore.GREEN}Model '{model_name}' pulled successfully!")
                return True
            else:
                print(f"{Fore.RED}Failed to pull model '{model_name}': {response.text}")
                return False
        except requests.RequestException as e:
            print(f"{Fore.RED}Error pulling model: {e}")
            return False
    
    def send_message(self, message: str, system_prompt: Optional[str] = None, stream: bool = False) -> Union[str, requests.Response]:
        """Send a message to the Ollama API and get response."""
        payload = {
            "model": self.config["model"],
            "messages": [],
            "stream": stream,
            "options": {
                "temperature": self.config["temperature"],
                "num_predict": self.config["max_tokens"]
            }
        }
        
        # Add advanced parameters if they exist in config
        if "top_p" in self.config:
            payload["options"]["top_p"] = self.config["top_p"]
        if "top_k" in self.config:
            payload["options"]["top_k"] = self.config["top_k"]
        if "repeat_penalty" in self.config:
            payload["options"]["repeat_penalty"] = self.config["repeat_penalty"]
        
        # Add system prompt if provided
        if system_prompt:
            payload["messages"].append({
                "role": "system",
                "content": system_prompt
            })
        
        # Add chat history
        for entry in self.chat_history[-10:]:  # Keep last 10 messages for context
            payload["messages"].append({
                "role": entry["role"],
                "content": entry["content"]
            })
        
        # Add current message
        payload["messages"].append({
            "role": "user",
            "content": message
        })
        
        try:
            if stream:
                # For streaming, return the response object for the caller to handle
                response = requests.post(
                    f"{self.api_base_url}/api/chat",
                    json=payload,
                    timeout=60,
                    stream=True
                )
                return response
            else:
                # Non-streaming response
                response = requests.post(
                    f"{self.api_base_url}/api/chat",
                    json=payload,
                    timeout=60
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("message", {}).get("content", "No response received")
                else:
                    return f"Error: {response.status_code} - {response.text}"
                    
        except requests.RequestException as e:
            return f"Network error: {e}"
    
    def add_to_history(self, role: str, content: str) -> None:
        """Add a message to chat history."""
        self.chat_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
    
    def save_chat_history(self) -> None:
        """Save chat history to file."""
        try:
            with open(self.config["chat_history_file"], 'w') as f:
                json.dump(self.chat_history, f, indent=2)
            print(f"{Fore.GREEN}Chat history saved to {self.config['chat_history_file']}")
        except IOError as e:
            print(f"{Fore.RED}Error saving chat history: {e}")
    
    def load_chat_history(self) -> None:
        """Load chat history from file."""
        if os.path.exists(self.config["chat_history_file"]):
            try:
                with open(self.config["chat_history_file"], 'r') as f:
                    self.chat_history = json.load(f)
                print(f"{Fore.GREEN}Chat history loaded from {self.config['chat_history_file']}")
            except (json.JSONDecodeError, IOError) as e:
                print(f"{Fore.YELLOW}Could not load chat history: {e}")
    
    def display_status(self) -> None:
        """Display current status and configuration."""
        print(f"\n{Fore.CYAN}=== Ollama Chat Status ===")
        print(f"{Fore.WHITE}Ollama installed: {Fore.GREEN if self.check_ollama_installation() else Fore.RED}{'✓' if self.check_ollama_installation() else '✗'}")
        print(f"{Fore.WHITE}Server running: {Fore.GREEN if self.check_ollama_server() else Fore.RED}{'✓' if self.check_ollama_server() else '✗'}")
        print(f"{Fore.WHITE}Current model: {Fore.YELLOW}{self.config['model']}")
        print(f"{Fore.WHITE}Temperature: {Fore.YELLOW}{self.config['temperature']}")
        print(f"{Fore.WHITE}Chat history: {Fore.YELLOW}{len(self.chat_history)} messages")
        print(f"{Fore.CYAN}========================\n")
    
    def show_help(self) -> None:
        """Display help information."""
        help_text = f"""
{Fore.CYAN}Available Commands:
{Fore.WHITE}/help          - Show this help message
{Fore.WHITE}/status        - Show current status
{Fore.WHITE}/config        - Show current configuration
{Fore.WHITE}/models        - List available models
{Fore.WHITE}/pull <model>  - Pull a specific model
{Fore.WHITE}/save          - Save chat history
{Fore.WHITE}/load          - Load chat history
{Fore.WHITE}/clear         - Clear chat history
{Fore.WHITE}/quit          - Exit the application
{Fore.WHITE}/history       - Show recent chat history
{Style.RESET_ALL}
"""
        print(help_text)
    
    def show_config(self) -> None:
        """Display current configuration."""
        print(f"\n{Fore.CYAN}=== Current Configuration ===")
        for key, value in self.config.items():
            print(f"{Fore.WHITE}{key}: {Fore.YELLOW}{value}")
        print(f"{Fore.CYAN}==============================\n")
    
    def list_models(self) -> None:
        """List available models."""
        models = self.get_available_models()
        if models:
            print(f"\n{Fore.CYAN}Available Models:")
            for model in models:
                print(f"{Fore.WHITE}  - {Fore.YELLOW}{model}")
        else:
            print(f"{Fore.YELLOW}No models found or unable to connect to Ollama server.")
        print()
    
    def show_history(self) -> None:
        """Show recent chat history."""
        if not self.chat_history:
            print(f"{Fore.YELLOW}No chat history available.")
            return
        
        print(f"\n{Fore.CYAN}=== Recent Chat History ===")
        for i, entry in enumerate(self.chat_history[-10:], 1):  # Show last 10 messages
            role = entry["role"]
            content = entry["content"][:100] + "..." if len(entry["content"]) > 100 else entry["content"]
            timestamp = entry.get("timestamp", "Unknown")
            
            if role == "user":
                print(f"{Fore.GREEN}[{i}] User: {Fore.WHITE}{content}")
            else:
                print(f"{Fore.BLUE}[{i}] Assistant: {Fore.WHITE}{content}")
            print(f"{Style.DIM}    {timestamp}")
        print(f"{Fore.CYAN}=============================\n")
    
    def clear_history(self) -> None:
        """Clear chat history."""
        self.chat_history.clear()
        print(f"{Fore.GREEN}Chat history cleared.")
    
    def run(self) -> None:
        """Main application loop."""
        print(f"{Fore.CYAN}Welcome to Ollama Chat!")
        print(f"{Fore.CYAN}Type /help for available commands.\n")
        
        # Check Ollama installation
        if not self.check_ollama_installation():
            print(f"{Fore.RED}Error: Ollama is not installed or not found in PATH.")
            print(f"{Fore.YELLOW}Please install Ollama from https://ollama.ai/")
            return
        
        # Check and start server if needed
        if not self.check_ollama_server():
            print(f"{Fore.YELLOW}Ollama server is not running.")
            if not self.start_ollama_server():
                print(f"{Fore.RED}Could not start Ollama server. Please start it manually.")
                return
        
        # Load chat history
        self.load_chat_history()
        
        # Check if current model is available
        available_models = self.get_available_models()
        if self.config["model"] not in available_models:
            print(f"{Fore.YELLOW}Model '{self.config['model']}' is not available.")
            print(f"{Fore.YELLOW}Available models: {', '.join(available_models) if available_models else 'None'}")
            print(f"{Fore.YELLOW}Use /pull {self.config['model']} to download it.")
        
        # Main chat loop
        while True:
            try:
                user_input = input(f"{Fore.GREEN}You: {Style.RESET_ALL}").strip()
                
                if not user_input:
                    continue
                
                # Handle commands
                if user_input.startswith('/'):
                    command = user_input.lower().split()[0]
                    
                    if command == '/quit':
                        print(f"{Fore.CYAN}Goodbye!")
                        break
                    elif command == '/help':
                        self.show_help()
                    elif command == '/status':
                        self.display_status()
                    elif command == '/config':
                        self.show_config()
                    elif command == '/models':
                        self.list_models()
                    elif command == '/save':
                        self.save_chat_history()
                    elif command == '/load':
                        self.load_chat_history()
                    elif command == '/clear':
                        self.clear_history()
                    elif command == '/history':
                        self.show_history()
                    elif command.startswith('/pull'):
                        parts = user_input.split()
                        if len(parts) > 1:
                            model_name = parts[1]
                            if self.pull_model(model_name):
                                self.config["model"] = model_name
                                self.save_config(self.config)
                        else:
                            print(f"{Fore.RED}Usage: /pull <model_name>")
                    else:
                        print(f"{Fore.RED}Unknown command. Type /help for available commands.")
                    continue
                
                # Add user message to history
                self.add_to_history("user", user_input)
                
                # Get response from Ollama
                print(f"{Fore.BLUE}Assistant: {Style.RESET_ALL}", end="", flush=True)
                response = self.send_message(user_input, self.config.get("system_prompt"), stream=False)
                
                # Add assistant response to history (ensure it's a string)
                if isinstance(response, str):
                    self.add_to_history("assistant", response)
                else:
                    print(f"{Fore.RED}Error: Unexpected response type")
                    continue
                
                print(response)
                print()  # Empty line for readability
                
            except KeyboardInterrupt:
                print(f"\n{Fore.YELLOW}Interrupted by user.")
                break
            except Exception as e:
                print(f"{Fore.RED}Error: {e}")
        
        # Save chat history on exit
        if self.chat_history:
            save_choice = input(f"{Fore.YELLOW}Save chat history before exiting? (y/n): ").strip().lower()
            if save_choice in ['y', 'yes']:
                self.save_chat_history()

def main():
    """Main entry point."""
    try:
        chat_app = OllamaChat()
        chat_app.run()
    except Exception as e:
        print(f"{Fore.RED}Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 