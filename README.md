# Ollama Chat Application

bA Python application that provides a command-line interface to interact with local Ollama models via the API.

## Features

✅ **Core Features**
- Check if Ollama is installed and running
- Pull models automatically if not available
- Start Ollama server if not running
- Interactive chat interface with command-line UI
- Chat history management (in-memory and file-based)
- Graceful error handling
- Configurable settings (model, temperature, system prompt)

⚙️ **Technical Features**
- Uses Python standard libraries and requests
- Cross-platform compatibility
- Colored output for better UX
- JSON-based configuration and chat history

💡 **Bonus Features**
- Save/load chat history to/from JSON files
- Support for multiple models with easy switching
- Real-time status indicators
- Command system for various operations

## Prerequisites

1. **Python 3.7+** installed on your system
2. **Ollama** installed and accessible in your PATH
   - Download from: https://ollama.ai/
   - Follow installation instructions for your platform

## Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd ollamachat
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Make the script executable (optional)**
   ```bash
   chmod +x ollama_chat.py
   ```

## Usage

### Basic Usage

1. **Start the application**
   ```bash
   python ollama_chat.py
   ```

2. **The application will:**
   - Check if Ollama is installed
   - Verify the Ollama server is running (start it if needed)
   - Load your configuration and chat history
   - Present an interactive chat interface

3. **Start chatting!**
   - Type your messages and press Enter
   - The AI will respond using the configured model
   - Use commands (starting with `/`) for various operations

### Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help information |
| `/status` | Display current status and configuration |
| `/config` | Show current configuration settings |
| `/models` | List available models |
| `/pull <model>` | Download a specific model (e.g., `/pull llama2`) |
| `/save` | Save current chat history to file |
| `/load` | Load chat history from file |
| `/clear` | Clear current chat history |
| `/history` | Show recent chat history |
| `/quit` | Exit the application |

### Configuration

The application creates a `chat_config.json` file with default settings:

```json
{
  "model": "llama2",
  "temperature": 0.7,
  "system_prompt": "You are a helpful AI assistant.",
  "max_tokens": 2048,
  "chat_history_file": "chat_history.json"
}
```

You can modify these settings by editing the file or using the application commands.

### Popular Models

You can use various models available in Ollama:

- `llama2` - Meta's LLaMA 2 model
- `mistral` - Mistral AI's model
- `codellama` - Code-focused LLaMA model
- `llama2:7b` - Smaller LLaMA 2 model
- `llama2:13b` - Larger LLaMA 2 model
- `llama2:70b` - Largest LLaMA 2 model

To use a different model:
1. Pull it: `/pull mistral`
2. It will automatically become your active model

## File Structure

```
ollamachat/
├── ollama_chat.py          # Main application
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── chat_config.json       # Configuration (created on first run)
└── chat_history.json      # Chat history (created when saved)
```

## Troubleshooting

### Common Issues

1. **"Ollama is not installed"**
   - Install Ollama from https://ollama.ai/
   - Ensure it's in your system PATH

2. **"Ollama server is not running"**
   - The application will attempt to start it automatically
   - If it fails, start manually: `ollama serve`

3. **"Model not found"**
   - Use `/pull <model_name>` to download the model
   - Check available models with `/models`

4. **Network errors**
   - Ensure Ollama server is running on localhost:11434
   - Check firewall settings

5. **Permission errors**
   - Ensure you have write permissions in the current directory
   - Check file permissions for config and history files

### Getting Help

- Use `/help` in the application for command reference
- Use `/status` to check system status
- Check the console output for error messages

## Development

### Adding New Features

The application is structured as a single class (`OllamaChat`) with clear separation of concerns:

- **Configuration management**: `load_config()`, `save_config()`
- **Ollama interaction**: `check_ollama_server()`, `send_message()`
- **Chat history**: `add_to_history()`, `save_chat_history()`
- **User interface**: `show_help()`, `display_status()`

### Extending the Application

Potential enhancements:
- GUI interface using Tkinter or PyQt
- Streaming responses
- Model fine-tuning support
- Plugin system for custom commands
- Web interface
- Multi-user support

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests. 