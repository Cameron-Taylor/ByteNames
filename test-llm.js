// Test script to debug LLM integration
require('dotenv').config();

console.log('🧪 Testing LLM Integration...');

// Check environment variables
console.log('Environment check:');
console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('- OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('- OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.startsWith('sk-') : false);

// Test OpenAI import
let OpenAI;
try {
  OpenAI = require('openai');
  console.log('✅ OpenAI package imported successfully');
} catch (error) {
  console.log('❌ Failed to import OpenAI:', error.message);
  process.exit(1);
}

// Test client initialization
let client;
try {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI client created successfully');
} catch (error) {
  console.log('❌ Failed to create OpenAI client:', error.message);
  process.exit(1);
}

// Test API call
async function testAPI() {
  try {
    console.log('🧪 Testing API call...');
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: "system",
          content: "You are an expert Bytenames spymaster. You must provide clues that are exactly ONE WORD and help your team identify their words while avoiding enemy, neutral, and assassin words."
        },
        {
          role: "user",
          content: `You are playing Bytenames as the RED team spymaster.

YOUR TEAM'S WORDS (you want your team to guess these): CAT, DOG, LION

ENEMY TEAM'S WORDS (avoid these - they belong to the other team): BIRD, FISH

NEUTRAL WORDS (avoid these - they don't belong to either team): TREE, SUN

ASSASSIN WORDS (CRITICAL - avoid these at all costs, they end the game): DEATH

RULES:
1. Give exactly ONE WORD as your clue
2. The clue should help your team identify as many of YOUR TEAM'S WORDS as possible
3. NEVER give a clue that could lead to enemy, neutral, or assassin words
4. After your clue, specify how many words it connects to (maximum 3)
5. If no safe clue exists, respond with "PASS 0"

RESPONSE FORMAT: "CLUE NUMBER"
Example: "ANIMAL 2" means the clue "ANIMAL" connects to 2 of your team's words.

Your clue:`
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    console.log('✅ API call successful!');
    console.log('Response:', response.choices[0].message.content);
    
    // Test parsing
    const responseText = response.choices[0].message.content.trim();
    console.log('Raw response:', responseText);
    
    const parts = responseText.split(/\s+/);
    console.log('Response parts:', parts);
    
    if (parts.length >= 2) {
      const clue = parts[0].toUpperCase();
      const number = parseInt(parts[1]);
      console.log('Parsed clue:', clue);
      console.log('Parsed number:', number);
      
      if (!isNaN(number) && number >= 0 && number <= 3) {
        console.log('✅ Parsing successful!');
      } else {
        console.log('❌ Invalid number');
      }
    } else {
      console.log('❌ Invalid format - need at least 2 parts');
    }
    
  } catch (error) {
    console.log('❌ API call failed:', error.message);
    console.log('Error details:', error);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testAPI();
