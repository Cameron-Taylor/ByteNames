# Bytenames AI - Digital Spymaster Edition

A digital implementation of the popular word game Bytenames, featuring an AI spymaster that provides clues to help teams identify their agents while avoiding the enemy and the assassin.

## Features

- **AI Spymaster**: Intelligent clue generation using word associations and themes
- **Multiplayer Support**: Multiple players can join the same room
- **Role-based Gameplay**: Field operatives make guesses, observers can watch
- **Real-time Updates**: Live game state synchronization using WebSockets
- **Responsive Design**: Works on desktop and mobile devices
- **Multiple Difficulty Levels**: Easy, medium, and hard word lists

## How to Play

1. **Join a Game**: Enter your name, room ID, and select your role
2. **Start the Game**: The first player can start the game
3. **AI Provides Clues**: The AI spymaster gives clues in the format "WORD, NUMBER"
4. **Make Guesses**: Field operatives click on words they think match the clue
5. **Win Conditions**: 
   - Find all your team's agents first
   - Avoid hitting the assassin
   - Avoid revealing enemy agents

## Game Rules

- **Red Team**: 9 agents (goes first)
- **Blue Team**: 8 agents  
- **Neutral Bystanders**: 7 cards
- **Assassin**: 1 card (instant loss if revealed)

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open in Browser**:
   Navigate to `http://localhost:3000`

## Development

- **Frontend**: HTML, CSS, JavaScript (ES6+)
- **Backend**: Node.js with Express and Socket.io
- **AI Logic**: Custom clue generation algorithm
- **Styling**: Modern CSS with responsive design

## AI Spymaster Logic

The AI spymaster uses several strategies to generate clues:

1. **Theme Detection**: Identifies common themes among team words
2. **Word Associations**: Finds connections between multiple words
3. **Risk Assessment**: Avoids clues that might lead to enemy words or assassin
4. **Difficulty Scaling**: Adjusts clue complexity based on game difficulty

## Project Structure

```
codenames-ai/
├── server.js          # Express server with Socket.io
├── package.json       # Dependencies and scripts
├── public/
│   ├── index.html     # Main game interface
│   ├── styles.css     # Game styling
│   └── game.js        # Client-side game logic
└── README.md          # This file
```

## Contributing

This is a learning project demonstrating:
- Real-time multiplayer game development
- AI integration in games
- WebSocket communication
- Modern web development practices

## License

MIT License - feel free to use and modify for your own projects!
