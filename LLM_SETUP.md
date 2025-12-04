# LLM Integration Setup

## 🤖 AI Spymaster with LLM Support

The Bytenames AI now supports LLM-powered clue generation using OpenAI's GPT models!

### 🚀 Quick Setup

1. **Get an OpenAI API Key**
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key

2. **Configure the Environment**
   - Open `.env` file in the project root
   - Replace `your_openai_api_key_here` with your actual API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Start the Server**
   ```bash
   npm start
   ```

### ⚙️ Configuration Options

You can customize the LLM behavior in `.env`:

```env
# LLM Provider (currently only OpenAI supported)
LLM_PROVIDER=openai

# Model to use (gpt-3.5-turbo is recommended for cost/performance)
LLM_MODEL=gpt-3.5-turbo

# Creativity level (0.0 = very focused, 1.0 = very creative)
LLM_TEMPERATURE=0.7

# Maximum tokens for response (keeps responses concise)
LLM_MAX_TOKENS=100
```

### 🔄 How It Works

1. **LLM First**: The AI tries to generate clues using the LLM
2. **Smart Fallback**: If LLM fails, it falls back to the rule-based system
3. **Safety Checks**: All LLM responses are validated for safety and format
4. **Real-time**: Clues are generated fresh for each turn

### 🛡️ Safety Features

- **Format Validation**: Ensures clues are single words
- **Safety Checking**: Validates clues don't connect to dangerous words
- **Real Word Validation**: Only accepts real, accessible English words
- **Error Handling**: Graceful fallback if LLM is unavailable

### 💡 Benefits of LLM Integration

- **Creative Clues**: More imaginative and contextual connections
- **Better Grouping**: Smarter multi-word clue generation
- **Contextual Understanding**: Understands nuanced word relationships
- **Adaptive Intelligence**: Learns from the specific board state

### 🔧 Troubleshooting

**"LLM client not initialized"**
- Check your API key in `.env`
- Ensure you have credits in your OpenAI account

**"LLM API error"**
- Check your internet connection
- Verify API key is valid and has credits
- The system will automatically fall back to rule-based clues

**Slow Response**
- LLM calls take 1-3 seconds
- This is normal for AI-powered clues
- Consider using `gpt-3.5-turbo` for faster responses

### 💰 Cost Considerations

- **GPT-3.5-turbo**: ~$0.001-0.002 per clue (very affordable)
- **GPT-4**: ~$0.01-0.03 per clue (more expensive but higher quality)
- **Rule-based fallback**: Free (always available)

The system is designed to be cost-effective while providing intelligent clues!
