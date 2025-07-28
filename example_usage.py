#!/usr/bin/env python3
"""
Example usage of the OllamaChat application.
This script demonstrates how to use the OllamaChat class programmatically.
"""

from ollama_chat import OllamaChat
import time

def example_basic_chat():
    """Example of basic chat functionality."""
    print("=== Basic Chat Example ===")
    
    # Create chat instance
    chat = OllamaChat()
    
    # Check if everything is ready
    if not chat.check_ollama_installation():
        print("Ollama is not installed. Please install it first.")
        return
    
    if not chat.check_ollama_server():
        print("Ollama server is not running. Please start it first.")
        return
    
    # Send a simple message
    response = chat.send_message("Hello! How are you today?")
    print(f"Response: {response}")
    print()

def example_with_custom_config():
    """Example with custom configuration."""
    print("=== Custom Configuration Example ===")
    
    # Create chat instance with custom config
    chat = OllamaChat("custom_config.json")
    
    # Modify configuration
    chat.config["temperature"] = 0.9  # More creative responses
    chat.config["system_prompt"] = "You are a witty and humorous AI assistant."
    chat.save_config(chat.config)
    
    # Send a message with the new configuration
    response = chat.send_message("Tell me a joke!")
    print(f"Response: {response}")
    print()

def example_chat_history():
    """Example demonstrating chat history functionality."""
    print("=== Chat History Example ===")
    
    chat = OllamaChat()
    
    # Add some messages to history
    chat.add_to_history("user", "What's the weather like?")
    chat.add_to_history("assistant", "I don't have access to real-time weather data, but I can help you find weather information!")
    chat.add_to_history("user", "Can you help me with Python programming?")
    chat.add_to_history("assistant", "Absolutely! I'd be happy to help you with Python programming. What specific question do you have?")
    
    # Save history
    chat.save_chat_history()
    print("Chat history saved!")
    
    # Show history
    chat.show_history()
    
    # Clear history
    chat.clear_history()
    print("Chat history cleared!")
    print()

def example_model_management():
    """Example of model management."""
    print("=== Model Management Example ===")
    
    chat = OllamaChat()
    
    # List available models
    print("Available models:")
    models = chat.get_available_models()
    for model in models:
        print(f"  - {model}")
    
    # Show current model
    print(f"\nCurrent model: {chat.config['model']}")
    
    # Note: Uncomment the following lines to actually pull a model
    # print("\nPulling llama2 model...")
    # if chat.pull_model("llama2"):
    #     print("Model pulled successfully!")
    #     chat.config["model"] = "llama2"
    #     chat.save_config(chat.config)
    print()

def example_error_handling():
    """Example of error handling."""
    print("=== Error Handling Example ===")
    
    chat = OllamaChat()
    
    # Try to send a message when server might not be running
    try:
        response = chat.send_message("Test message")
        print(f"Response: {response}")
    except Exception as e:
        print(f"Error occurred: {e}")
    
    print()

if __name__ == "__main__":
    print("Ollama Chat Application - Example Usage")
    print("=" * 50)
    
    # Run examples
    example_basic_chat()
    example_with_custom_config()
    example_chat_history()
    example_model_management()
    example_error_handling()
    
    print("Examples completed!")
    print("\nTo run the interactive chat application, use:")
    print("python ollama_chat.py") 