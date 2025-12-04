const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// LLM Integration
let OpenAI;
try {
  OpenAI = require('openai');
} catch (error) {
  console.log('OpenAI package not installed. Run: npm install openai');
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// LLM Configuration
const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'openai',
  model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
  temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 100,
  apiKey: process.env.OPENAI_API_KEY
};

// Initialize LLM client
let llmClient = null;
if (OpenAI && LLM_CONFIG.apiKey && LLM_CONFIG.apiKey !== 'your_openai_api_key_here') {
  try {
    llmClient = new OpenAI({
      apiKey: LLM_CONFIG.apiKey
    });
    console.log('✅ LLM client initialized successfully');
  } catch (error) {
    console.log('❌ Failed to initialize LLM client:', error.message);
  }
} else {
  console.log('⚠️  LLM client not initialized. Set OPENAI_API_KEY in .env file to enable AI clues');
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Game state management
const games = new Map();

// Word lists for the game - all objects only (nouns)
const WORD_LISTS = {
  easy: [
    // Animals (50 words)
    'CAT', 'DOG', 'BIRD', 'FISH', 'LION', 'BEAR', 'TIGER', 'ELEPHANT', 'MONKEY', 'RABBIT',
    'MOUSE', 'HORSE', 'COW', 'PIG', 'SHEEP', 'GOAT', 'CHICKEN', 'DUCK', 'GOOSE', 'TURKEY',
    'OWL', 'EAGLE', 'HAWK', 'PARROT', 'PENGUIN', 'SEAL', 'WHALE', 'DOLPHIN', 'SHARK', 'OCTOPUS',
    'CRAB', 'LOBSTER', 'BUTTERFLY', 'BEE', 'SPIDER', 'ANT', 'LADYBUG', 'SNAIL', 'FROG', 'SNAKE',
    'TURTLE', 'LIZARD', 'HAMSTER', 'GUINEA', 'FERRET', 'RACCOON', 'SKUNK', 'OPOSSUM', 'DEER', 'WOLF',
    
    // Food & Drinks (50 words)
    'APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'STRAWBERRY', 'CHERRY', 'LEMON', 'LIME', 'PEACH', 'PEAR',
    'BREAD', 'CAKE', 'COOKIE', 'PIE', 'PIZZA', 'BURGER', 'HOTDOG', 'SANDWICH', 'SALAD', 'SOUP',
    'CHICKEN', 'BEEF', 'PORK', 'FISH', 'EGG', 'CHEESE', 'MILK', 'JUICE', 'SODA', 'COFFEE',
    'TEA', 'WATER', 'BEER', 'WINE', 'ICE', 'CANDY', 'CHOCOLATE', 'GUM', 'POPCORN', 'CHIPS',
    'CEREAL', 'YOGURT', 'BUTTER', 'SUGAR', 'SALT', 'PEPPER', 'HONEY', 'JAM', 'JELLY', 'SYRUP',
    
    // Household Items (50 words)
    'CHAIR', 'TABLE', 'BED', 'SOFA', 'DESK', 'SHELF', 'CABINET', 'DRAWER', 'MIRROR', 'PICTURE',
    'CLOCK', 'LAMP', 'CANDLE', 'VASE', 'BOWL', 'PLATE', 'CUP', 'GLASS', 'MUG', 'SPOON',
    'FORK', 'KNIFE', 'BOTTLE', 'CAN', 'JAR', 'BOX', 'BAG', 'BASKET', 'BUCKET', 'BOWL',
    'TOWEL', 'BLANKET', 'PILLOW', 'SHEET', 'CURTAIN', 'RUG', 'CARPET', 'DOOR', 'WINDOW', 'KEY',
    'LOCK', 'HANDLE', 'BUTTON', 'ZIPPER', 'BELT', 'HAT', 'GLOVE', 'SCARF', 'SOCK', 'SHOE',
    
    // Transportation (30 words)
    'CAR', 'TRUCK', 'BUS', 'TRAIN', 'PLANE', 'BOAT', 'SHIP', 'BIKE', 'MOTORCYCLE', 'SCOOTER',
    'SKATEBOARD', 'ROLLER', 'WAGON', 'CART', 'WHEEL', 'TIRE', 'ENGINE', 'MOTOR', 'GAS', 'FUEL',
    'ROAD', 'STREET', 'BRIDGE', 'TUNNEL', 'STATION', 'AIRPORT', 'HARBOR', 'DOCK', 'PARKING', 'GARAGE',
    
    // Nature & Weather (40 words)
    'TREE', 'FLOWER', 'GRASS', 'LEAF', 'BRANCH', 'ROOT', 'SEED', 'FRUIT', 'NUT', 'BERRY',
    'SUN', 'MOON', 'STAR', 'CLOUD', 'RAIN', 'SNOW', 'WIND', 'STORM', 'LIGHTNING', 'THUNDER',
    'FIRE', 'SMOKE', 'ASH', 'ICE', 'FROST', 'DEW', 'MIST', 'FOG', 'SUNSHINE', 'SHADOW',
    'MOUNTAIN', 'HILL', 'VALLEY', 'RIVER', 'LAKE', 'OCEAN', 'BEACH', 'SAND', 'ROCK', 'STONE',
    
    // Body Parts (30 words)
    'HEAD', 'FACE', 'EYE', 'NOSE', 'MOUTH', 'EAR', 'TOOTH', 'TONGUE', 'CHIN', 'CHEEK',
    'NECK', 'SHOULDER', 'ARM', 'HAND', 'FINGER', 'THUMB', 'NAIL', 'CHEST', 'BACK', 'STOMACH',
    'LEG', 'KNEE', 'FOOT', 'TOE', 'HEEL', 'ANKLE', 'WRIST', 'ELBOW', 'HIP', 'WAIST',
    
    // Clothing (30 words)
    'SHIRT', 'PANTS', 'DRESS', 'SKIRT', 'JACKET', 'COAT', 'SWEATER', 'VEST', 'TIE', 'BOW',
    'HAT', 'CAP', 'HELMET', 'GLOVE', 'MITTEN', 'SCARF', 'BELT', 'SOCK', 'SHOE', 'BOOT',
    'SANDAL', 'SLIPPER', 'SOCK', 'UNDERWEAR', 'BRA', 'PANTY', 'PJ', 'ROBE', 'APRON', 'UNIFORM',
    
    // Sports & Games (30 words)
    'BALL', 'BAT', 'STICK', 'CLUB', 'RACKET', 'POOL', 'GOLF', 'TENNIS', 'BASEBALL', 'FOOTBALL',
    'BASKETBALL', 'SOCCER', 'HOCKEY', 'BOXING', 'WRESTLING', 'RUNNING', 'JUMPING', 'SWIMMING', 'DIVING', 'SKATING',
    'SKIING', 'SURFING', 'CLIMBING', 'CYCLING', 'RACING', 'DANCING', 'SINGING', 'ACTING', 'PAINTING', 'DRAWING',
    
    // Colors (20 words)
    'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BROWN', 'BLACK', 'WHITE',
    'GRAY', 'SILVER', 'GOLD', 'BRONZE', 'COPPER', 'TAN', 'BEIGE', 'NAVY', 'MAROON', 'LIME',
    
    // Numbers & Shapes (20 words)
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'CIRCLE', 'SQUARE', 'TRIANGLE', 'RECTANGLE', 'OVAL', 'DIAMOND', 'HEART', 'STAR', 'CROSS', 'LINE'
  ],
  medium: [
    // Buildings & Structures (50 words)
    'CASTLE', 'PALACE', 'BRIDGE', 'LIGHTHOUSE', 'TOWER', 'CHURCH', 'TEMPLE', 'MOSQUE', 'SYNAGOGUE', 'CATHEDRAL',
    'MUSEUM', 'LIBRARY', 'SCHOOL', 'HOSPITAL', 'BANK', 'STORE', 'RESTAURANT', 'HOTEL', 'THEATER', 'CINEMA',
    'STADIUM', 'ARENA', 'GYM', 'POOL', 'PARK', 'GARDEN', 'ZOO', 'AQUARIUM', 'PLANETARIUM', 'OBSERVATORY',
    'FACTORY', 'WAREHOUSE', 'GARAGE', 'BARN', 'SHED', 'CABIN', 'COTTAGE', 'MANSION', 'APARTMENT', 'CONDO',
    'SKYSCRAPER', 'MONUMENT', 'STATUE', 'FOUNTAIN', 'SCULPTURE', 'MEMORIAL', 'TRIBUTE', 'SHRINE', 'ALTAR', 'PODIUM',
    
    // Technology & Electronics (50 words)
    'COMPUTER', 'LAPTOP', 'TABLET', 'PHONE', 'CAMERA', 'TELEVISION', 'RADIO', 'SPEAKER', 'HEADPHONE', 'MICROPHONE',
    'KEYBOARD', 'MOUSE', 'SCREEN', 'MONITOR', 'PRINTER', 'SCANNER', 'ROUTER', 'MODEM', 'CHARGER', 'BATTERY',
    'REMOTE', 'CONTROLLER', 'JOYSTICK', 'GAMEPAD', 'CONSOLE', 'ARCADE', 'PINBALL', 'SLOT', 'VENDING', 'ATM',
    'CREDIT', 'DEBIT', 'CARD', 'WALLET', 'PURSE', 'HANDBAG', 'BACKPACK', 'SUITCASE', 'LUGGAGE', 'BRIEFCASE',
    'WATCH', 'CLOCK', 'TIMER', 'STOPWATCH', 'CALENDAR', 'PLANNER', 'DIARY', 'JOURNAL', 'NOTEBOOK', 'BINDER',
    
    // Musical Instruments (30 words)
    'GUITAR', 'PIANO', 'DRUM', 'TRUMPET', 'FLUTE', 'HARP', 'ORGAN', 'SAXOPHONE', 'TROMBONE', 'VIOLIN',
    'CELLO', 'BASS', 'CLARINET', 'OBOE', 'BASSOON', 'FRENCH', 'TUBA', 'CORNET', 'BUGLE', 'TRIANGLE',
    'TAMBOURINE', 'MARACAS', 'CYMBAL', 'XYLOPHONE', 'BELL', 'CHIME', 'WHISTLE', 'HARMONICA', 'ACCORDION', 'BANJO',
    
    // Sports & Recreation (50 words)
    'BASKETBALL', 'FOOTBALL', 'TENNIS', 'GOLF', 'SOCCER', 'BASEBALL', 'HOCKEY', 'VOLLEYBALL', 'SWIMMING', 'RUNNING',
    'CYCLING', 'SKATING', 'SKIING', 'SURFING', 'DIVING', 'CLIMBING', 'BOXING', 'WRESTLING', 'FENCING', 'ARCHERY',
    'BOWLING', 'BILLIARDS', 'DART', 'CHESS', 'CHECKERS', 'MONOPOLY', 'PUZZLE', 'CROSSWORD', 'SUDOKU', 'RUBIK',
    'YOGA', 'PILATES', 'AEROBICS', 'WEIGHTLIFTING', 'GYMNASTICS', 'BALLET', 'DANCING', 'SINGING', 'ACTING', 'COMEDY',
    'MAGIC', 'JUGGLING', 'ACROBATICS', 'TIGHTROPE', 'TRAPEZE', 'CIRCUS', 'CARNIVAL', 'FAIR', 'FESTIVAL', 'PARADE',
    
    // Nature & Geography (50 words)
    'MOUNTAIN', 'HILL', 'VALLEY', 'PLAIN', 'DESERT', 'FOREST', 'JUNGLE', 'SWAMP', 'MARSH', 'MEADOW',
    'PRAIRIE', 'SAVANNA', 'TUNDRA', 'GLACIER', 'ICEBERG', 'VOLCANO', 'CRATER', 'CAVE', 'CAVERN', 'GROTTO',
    'RIVER', 'STREAM', 'CREEK', 'BROOK', 'LAKE', 'POND', 'OCEAN', 'SEA', 'BAY', 'GULF',
    'ISLAND', 'PENINSULA', 'CAPE', 'COAST', 'BEACH', 'SHORE', 'CLIFF', 'BLUFF', 'RIDGE', 'PEAK',
    'CANYON', 'GORGE', 'WATERFALL', 'RAPIDS', 'WHIRLPOOL', 'TIDAL', 'WAVE', 'TSUNAMI', 'HURRICANE', 'TORNADO',
    
    // Weather & Sky (30 words)
    'SUN', 'MOON', 'STAR', 'PLANET', 'GALAXY', 'UNIVERSE', 'COMET', 'METEOR', 'AURORA', 'ECLIPSE',
    'CLOUD', 'FOG', 'MIST', 'DEW', 'FROST', 'SNOW', 'SLEET', 'HAIL', 'RAIN', 'DRIZZLE',
    'STORM', 'LIGHTNING', 'THUNDER', 'WIND', 'BREEZE', 'GALE', 'HURRICANE', 'TORNADO', 'BLIZZARD', 'DROUGHT',
    
    // Food & Cooking (50 words)
    'RESTAURANT', 'KITCHEN', 'DINING', 'COOKING', 'BAKING', 'GRILLING', 'FRYING', 'BOILING', 'STEAMING', 'ROASTING',
    'SPAGHETTI', 'PASTA', 'NOODLE', 'RICE', 'BREAD', 'ROLL', 'BAGEL', 'MUFFIN', 'DONUT', 'CROISSANT',
    'PIZZA', 'BURGER', 'SANDWICH', 'TACO', 'BURRITO', 'WRAP', 'SALAD', 'SOUP', 'STEW', 'CHILI',
    'STEAK', 'CHICKEN', 'TURKEY', 'HAM', 'BACON', 'SAUSAGE', 'HOTDOG', 'BRATWURST', 'MEATBALL', 'RIBS',
    'FISH', 'SHRIMP', 'CRAB', 'LOBSTER', 'OYSTER', 'MUSSEL', 'SALMON', 'TUNA', 'COD', 'HALIBUT',
    
    // Clothing & Fashion (40 words)
    'FASHION', 'STYLE', 'TREND', 'DESIGN', 'PATTERN', 'STRIPE', 'POLKA', 'PLAID', 'SOLID', 'PRINT',
    'FORMAL', 'CASUAL', 'SPORTY', 'ELEGANT', 'CHIC', 'VINTAGE', 'MODERN', 'CLASSIC', 'TRENDY', 'OUTDATED',
    'JEWELRY', 'NECKLACE', 'BRACELET', 'EARRING', 'RING', 'BROOCH', 'PENDANT', 'CHARM', 'WATCH', 'CLOCK',
    'PERFUME', 'COLOGNE', 'LOTION', 'CREAM', 'POWDER', 'LIPSTICK', 'MASCARA', 'EYELINER', 'BLUSH', 'FOUNDATION',
    
    // Transportation (40 words)
    'AIRPLANE', 'HELICOPTER', 'JET', 'ROCKET', 'SPACESHIP', 'SATELLITE', 'DRONE', 'GLIDER', 'BALLOON', 'PARACHUTE',
    'CAR', 'TRUCK', 'VAN', 'SUV', 'COUPE', 'CONVERTIBLE', 'SEDAN', 'HATCHBACK', 'WAGON', 'PICKUP',
    'MOTORCYCLE', 'SCOOTER', 'MOPED', 'ATV', 'SNOWMOBILE', 'JETSKI', 'BOAT', 'SHIP', 'YACHT', 'CRUISE',
    'TRAIN', 'SUBWAY', 'TRAM', 'TROLLEY', 'BUS', 'COACH', 'TAXI', 'UBER', 'LYFT', 'RIDESHARE',
    
    // Tools & Equipment (30 words)
    'HAMMER', 'SCREWDRIVER', 'WRENCH', 'PLIERS', 'SAW', 'DRILL', 'SCREW', 'NAIL', 'BOLT', 'NUT',
    'SCREW', 'HINGE', 'HANDLE', 'KNOB', 'SWITCH', 'BUTTON', 'LEVER', 'PEDAL', 'BRAKE', 'ACCELERATOR',
    'GEAR', 'CHAIN', 'BELT', 'PULLEY', 'WHEEL', 'AXLE', 'SPRING', 'COIL', 'CABLE', 'WIRE'
  ],
  hard: [
    // Science & Technology (50 words)
    'ASTRONAUT', 'SATELLITE', 'TELESCOPE', 'MICROSCOPE', 'BINOCULARS', 'KALEIDOSCOPE', 'PERISCOPE', 'STETHOSCOPE', 'GYROSCOPE', 'ENDOSCOPE',
    'RADIOSCOPE', 'SPECTROSCOPE', 'LABORATORY', 'OBSERVATORY', 'PLANETARIUM', 'AQUARIUM', 'MUSEUM', 'UNIVERSITY', 'HOSPITAL', 'STADIUM',
    'COMPUTER', 'LAPTOP', 'TABLET', 'SMARTPHONE', 'CAMERA', 'TELEVISION', 'RADIO', 'SPEAKER', 'HEADPHONE', 'MICROPHONE',
    'KEYBOARD', 'MOUSE', 'SCREEN', 'MONITOR', 'PRINTER', 'SCANNER', 'ROUTER', 'MODEM', 'CHARGER', 'BATTERY',
    'REMOTE', 'CONTROLLER', 'JOYSTICK', 'GAMEPAD', 'CONSOLE', 'ARCADE', 'PINBALL', 'SLOT', 'VENDING', 'ATM',
    
    // Space & Astronomy (40 words)
    'GALAXY', 'UNIVERSE', 'PLANET', 'STAR', 'COMET', 'METEOR', 'METEORITE', 'AURORA', 'ECLIPSE', 'ORBIT',
    'ROCKET', 'SPACESHIP', 'SATELLITE', 'ASTRONAUT', 'COSMONAUT', 'PILOT', 'NAVIGATOR', 'EXPLORER', 'DISCOVERER', 'INVENTOR',
    'JUPITER', 'MARS', 'VENUS', 'MERCURY', 'SATURN', 'NEPTUNE', 'URANUS', 'PLUTO', 'MOON', 'SUN',
    'EARTH', 'GRAVITY', 'ATMOSPHERE', 'OXYGEN', 'NITROGEN', 'CARBON', 'HYDROGEN', 'HELIUM', 'NEON', 'ARGON',
    
    // Geography & Landforms (50 words)
    'MOUNTAIN', 'VOLCANO', 'CRATER', 'CAVE', 'CAVERN', 'GROTTO', 'CANYON', 'GORGE', 'WATERFALL', 'RAPIDS',
    'WHIRLPOOL', 'TIDAL', 'WAVE', 'TSUNAMI', 'HURRICANE', 'TORNADO', 'BLIZZARD', 'DROUGHT', 'FLOOD', 'EARTHQUAKE',
    'ISLAND', 'PENINSULA', 'CAPE', 'COAST', 'BEACH', 'SHORE', 'CLIFF', 'BLUFF', 'RIDGE', 'PEAK',
    'VALLEY', 'PLAIN', 'DESERT', 'FOREST', 'JUNGLE', 'SWAMP', 'MARSH', 'MEADOW', 'PRAIRIE', 'SAVANNA',
    'TUNDRA', 'GLACIER', 'ICEBERG', 'POLAR', 'ARCTIC', 'ANTARCTIC', 'EQUATOR', 'TROPIC', 'HEMISPHERE', 'CONTINENT',
    
    // Architecture & Buildings (40 words)
    'CATHEDRAL', 'MONASTERY', 'CHAPEL', 'TEMPLE', 'MOSQUE', 'SYNAGOGUE', 'CHURCH', 'SHRINE', 'SANCTUARY', 'ALTAR',
    'CASTLE', 'PALACE', 'MANSION', 'VILLA', 'COTTAGE', 'CABIN', 'IGLOO', 'TENT', 'PAVILION', 'GAZEBO',
    'BRIDGE', 'TUNNEL', 'VIADUCT', 'AQUEDUCT', 'DAM', 'RESERVOIR', 'CANAL', 'LOCK', 'HARBOR', 'PIER',
    'LIGHTHOUSE', 'BEACON', 'TOWER', 'SPIRE', 'DOME', 'ARCH', 'COLUMN', 'PILLAR', 'FOUNDATION', 'BASEMENT',
    
    // Transportation & Vehicles (40 words)
    'AIRPLANE', 'HELICOPTER', 'JET', 'ROCKET', 'SPACESHIP', 'SATELLITE', 'DRONE', 'GLIDER', 'BALLOON', 'PARACHUTE',
    'YACHT', 'CRUISE', 'FERRY', 'BARGE', 'TUG', 'TANKER', 'CARGO', 'FREIGHT', 'CONTAINER', 'SHIPPING',
    'TRAIN', 'SUBWAY', 'TRAM', 'TROLLEY', 'CABLE', 'FUNICULAR', 'MONORAIL', 'MAGLEV', 'BULLET', 'EXPRESS',
    'MOTORCYCLE', 'SCOOTER', 'MOPED', 'ATV', 'SNOWMOBILE', 'JETSKI', 'BOAT', 'SHIP', 'VESSEL', 'CRAFT',
    
    // Tools & Equipment (30 words)
    'HAMMER', 'SCREWDRIVER', 'WRENCH', 'PLIERS', 'SAW', 'DRILL', 'SCREW', 'NAIL', 'BOLT', 'NUT',
    'HINGE', 'HANDLE', 'KNOB', 'SWITCH', 'BUTTON', 'LEVER', 'PEDAL', 'BRAKE', 'ACCELERATOR', 'GEAR',
    'CHAIN', 'BELT', 'PULLEY', 'WHEEL', 'AXLE', 'SPRING', 'COIL', 'CABLE', 'WIRE', 'CORD',
    
    // Musical Instruments (30 words)
    'GUITAR', 'PIANO', 'DRUM', 'TRUMPET', 'FLUTE', 'HARP', 'ORGAN', 'SAXOPHONE', 'TROMBONE', 'VIOLIN',
    'CELLO', 'BASS', 'CLARINET', 'OBOE', 'BASSOON', 'FRENCH', 'TUBA', 'CORNET', 'BUGLE', 'TRIANGLE',
    'TAMBOURINE', 'MARACAS', 'CYMBAL', 'XYLOPHONE', 'BELL', 'CHIME', 'WHISTLE', 'HARMONICA', 'ACCORDION', 'BANJO',
    
    // Sports & Recreation (40 words)
    'BASKETBALL', 'FOOTBALL', 'TENNIS', 'GOLF', 'SOCCER', 'BASEBALL', 'HOCKEY', 'VOLLEYBALL', 'SWIMMING', 'RUNNING',
    'CYCLING', 'SKATING', 'SKIING', 'SURFING', 'DIVING', 'CLIMBING', 'BOXING', 'WRESTLING', 'FENCING', 'ARCHERY',
    'BOWLING', 'BILLIARDS', 'DART', 'CHESS', 'CHECKERS', 'MONOPOLY', 'PUZZLE', 'CROSSWORD', 'SUDOKU', 'RUBIK',
    'YOGA', 'PILATES', 'AEROBICS', 'WEIGHTLIFTING', 'GYMNASTICS', 'BALLET', 'DANCING', 'SINGING', 'ACTING', 'COMEDY',
    
    // Food & Cooking (30 words)
    'RESTAURANT', 'KITCHEN', 'DINING', 'COOKING', 'BAKING', 'GRILLING', 'FRYING', 'BOILING', 'STEAMING', 'ROASTING',
    'SPAGHETTI', 'PASTA', 'NOODLE', 'RICE', 'BREAD', 'ROLL', 'BAGEL', 'MUFFIN', 'DONUT', 'CROISSANT',
    'PIZZA', 'BURGER', 'SANDWICH', 'TACO', 'BURRITO', 'WRAP', 'SALAD', 'SOUP', 'STEW', 'CHILI',
    
    // Clothing & Fashion (30 words)
    'FASHION', 'STYLE', 'TREND', 'DESIGN', 'PATTERN', 'STRIPE', 'POLKA', 'PLAID', 'SOLID', 'PRINT',
    'FORMAL', 'CASUAL', 'SPORTY', 'ELEGANT', 'CHIC', 'VINTAGE', 'MODERN', 'CLASSIC', 'TRENDY', 'OUTDATED',
    'JEWELRY', 'NECKLACE', 'BRACELET', 'EARRING', 'RING', 'BROOCH', 'PENDANT', 'CHARM', 'WATCH', 'CLOCK'
  ]
};

// Game logic
class BytenamesGame {
  static usedWords = new Set(); // Track all words used across all games
  
  constructor(roomId, difficulty = 'medium') {
    this.roomId = roomId;
    this.difficulty = difficulty;
    this.words = []; // Will be populated by initializeGame
    this.agentCards = []; // Will be populated by initializeGame
    this.currentTeam = 'red'; // red starts first
    this.gamePhase = 'waiting'; // waiting, playing, ended
    this.revealedWords = new Set();
    this.redScore = 0;
    this.blueScore = 0;
    this.redRemaining = 9;
    this.blueRemaining = 8;
    this.assassinRevealed = false;
    this.currentClue = null;
    this.guessesRemaining = 0;
    this.previousClues = []; // Track all clues used in this game
    this.clueHistory = []; // Track detailed clue history for display
  }

  static async create(roomId, difficulty = 'medium') {
    const game = new BytenamesGame(roomId, difficulty);
    await game.initializeGame();
    return game;
  }

  static resetUsedWords() {
    BytenamesGame.usedWords.clear();
    console.log('🔄 Reset used words tracking');
  }

  async initializeGame() {
    this.words = await this.generateWordGrid();
    this.agentCards = this.generateAgentCards();
  }

  async generateWordGrid() {
    // Try LLM-generated words first, fallback to static list
    if (llmClient) {
      try {
        console.log('🤖 Generating game board with LLM...');
        const llmWords = await this.generateLLMWords();
        if (llmWords && llmWords.length >= 25) {
          console.log(`✅ LLM generated ${llmWords.length} unique words`);
          return llmWords.slice(0, 25);
        }
        console.log('⚠️ LLM generated insufficient words, falling back to static list');
      } catch (error) {
        console.log('❌ LLM word generation failed:', error.message);
      }
    }
    
    // Fallback to static word list
    console.log('📋 Using static word list');
    const wordList = WORD_LISTS[this.difficulty];
    const shuffled = [...wordList].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 25);
  }

  async generateLLMWords() {
    if (!llmClient) return null;

    try {
      // Get previously used words to avoid repetition
      const usedWordsList = Array.from(BytenamesGame.usedWords);
      const usedWordsText = usedWordsList.length > 0 ? 
        `\n\nPREVIOUSLY USED WORDS (DO NOT USE THESE): ${usedWordsList.join(', ')}` : 
        '';

      const prompt = `Generate 30 unique, fun, and accessible English words for a word game. Requirements:
- All words must be NOUNS (objects, things, places, concepts)
- NO people, names, or proper nouns
- Words should be commonly known and understandable
- Mix of easy, medium, and slightly challenging words
- Avoid abstract or overly complex terms
- Each word should be a single word (no phrases)
- Make them interesting and varied
- Try not to use words that are too similar to each other. (Example: cyclone, tornado, hurricane)
- try to have a varied range of words, not all the same type. (Don't have 4 animals, 4 colors, 4 tools, etc.)
- CRITICAL: Do not use any words from the "PREVIOUSLY USED WORDS" list below

Examples of good words: APPLE, MOUNTAIN, GUITAR, BUTTERFLY, CASTLE, RAINBOW, VOLCANO, TREASURE, LIGHTHOUSE, SPACESHIP${usedWordsText}

Return ONLY the words, one per line, in ALL CAPS.`;

      console.log('\n=== LLM WORD GENERATION PROMPT ===');
      console.log(prompt);
      console.log('=== END WORD GENERATION PROMPT ===\n');

      const response = await llmClient.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: [
          {
            role: "system",
            content: "You are a word game expert. Generate fun, accessible English nouns for a word guessing game."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8, // Higher creativity for word generation
        max_tokens: 500
      });

      const llmResponse = response.choices[0].message.content.trim();
      console.log('LLM word generation response:', llmResponse);

      // Parse the response into individual words
      const words = llmResponse
        .split('\n')
        .map(line => line.trim().toUpperCase())
        .filter(word => {
          // Basic validation
          return word.length > 2 && 
                 word.length < 15 && 
                 /^[A-Z]+$/.test(word) && 
                 !word.includes(' ') &&
                 !word.includes('-');
        })
        .filter((word, index, array) => array.indexOf(word) === index); // Remove duplicates

      console.log(`Generated ${words.length} unique words:`, words.slice(0, 10), '...');
      
      // Track these words as used
      words.forEach(word => BytenamesGame.usedWords.add(word));
      console.log(`Total words tracked: ${BytenamesGame.usedWords.size}`);
      
      return words;

    } catch (error) {
      console.log('LLM word generation error:', error.message);
      return null;
    }
  }

  generateAgentCards() {
    const cards = Array(25).fill('neutral');
    
    // Red agents (9)
    let redCount = 0;
    while (redCount < 9) {
      const index = Math.floor(Math.random() * 25);
      if (cards[index] === 'neutral') {
        cards[index] = 'red';
        redCount++;
      }
    }
    
    // Blue agents (8)
    let blueCount = 0;
    while (blueCount < 8) {
      const index = Math.floor(Math.random() * 25);
      if (cards[index] === 'neutral') {
        cards[index] = 'blue';
        blueCount++;
      }
    }
    
    // Assassin (1)
    let assassinPlaced = false;
    while (!assassinPlaced) {
      const index = Math.floor(Math.random() * 25);
      if (cards[index] === 'neutral') {
        cards[index] = 'assassin';
        assassinPlaced = true;
      }
    }
    
    return cards;
  }

  makeGuess(wordIndex) {
    if (this.gamePhase !== 'playing' || this.guessesRemaining <= 0) {
      return { success: false, message: 'Invalid move' };
    }

    if (this.revealedWords.has(wordIndex)) {
      return { success: false, message: 'Word already revealed' };
    }

    this.revealedWords.add(wordIndex);
    const cardType = this.agentCards[wordIndex];
    
    this.guessesRemaining--;

    // Always give points to the team that owns the card (if it's red or blue)
    if (cardType === 'red') {
      this.redScore++;
      this.redRemaining--;
    } else if (cardType === 'blue') {
      this.blueScore++;
      this.blueRemaining--;
    }
    
    // Check win condition
    if (this.redRemaining === 0 || this.blueRemaining === 0) {
      this.gamePhase = 'ended';
      return { 
        success: true, 
        cardType, 
        gameOver: true, 
        winner: this.redRemaining === 0 ? 'red' : 'blue',
        clueHistory: this.clueHistory,
        allCards: this.words.map((word, index) => ({
          word,
          type: this.agentCards[index]
        }))
      };
    }
    
    if (cardType === this.currentTeam) {
      // Correct guess - continue if guesses remaining
      if (this.guessesRemaining > 0) {
        return { success: true, cardType, continueGuessing: true };
      } else {
        // Switch teams
        this.currentTeam = this.currentTeam === 'red' ? 'blue' : 'red';
        return { success: true, cardType, switchTeams: true };
      }
    } else if (cardType === 'assassin') {
      // Game over - assassin hit
      this.gamePhase = 'ended';
      this.assassinRevealed = true;
      return { 
        success: true, 
        cardType, 
        gameOver: true, 
        winner: this.currentTeam === 'red' ? 'blue' : 'red',
        clueHistory: this.clueHistory,
        allCards: this.words.map((word, index) => ({
          word,
          type: this.agentCards[index]
        }))
      };
    } else {
      // Wrong team or neutral - switch teams
      this.currentTeam = this.currentTeam === 'red' ? 'blue' : 'red';
      return { success: true, cardType, switchTeams: true };
    }
  }

  async generateAIClue() {
    console.log(`\n=== AI SPYMASTER GENERATING CLUE FOR ${this.currentTeam.toUpperCase()} TEAM ===`);
    
    // 1. Try LLM-powered clue generation first
    if (llmClient) {
      console.log('🤖 Attempting LLM-powered clue generation...');
      const llmClue = await this.generateLLMClue();
      if (llmClue) {
        return llmClue;
      }
      console.log('🔄 LLM failed, falling back to rule-based system...');
    }
    
    // 2. Fallback to rule-based system
    console.log('📋 Using rule-based clue generation...');
    
    // Identify all unrevealed cards and categorize them
    const unrevealedWords = this.words
      .map((word, index) => ({ word, index, type: this.agentCards[index] }))
      .filter((_, index) => !this.revealedWords.has(index));

    const teamWords = unrevealedWords.filter(w => w.type === this.currentTeam);
    const enemyWords = unrevealedWords.filter(w => w.type !== this.currentTeam && w.type !== 'neutral' && w.type !== 'assassin');
    const neutralWords = unrevealedWords.filter(w => w.type === 'neutral');
    const assassinWords = unrevealedWords.filter(w => w.type === 'assassin');

    console.log(`Team words (${this.currentTeam}):`, teamWords.map(w => w.word));
    console.log(`Enemy words:`, enemyWords.map(w => w.word));
    console.log(`Neutral words:`, neutralWords.map(w => w.word));
    console.log(`Assassin words:`, assassinWords.map(w => w.word));

    if (teamWords.length === 0) {
      console.log('No team words left - PASSING');
      return { clue: 'PASS', number: 0 };
    }

    // Generate dynamic clues based on actual word relationships
    const dynamicClues = this.generateDynamicClues(teamWords, enemyWords, neutralWords, assassinWords);
    
    if (dynamicClues.length > 0) {
      // Choose the best clue (most words connected, safest)
      const bestClue = dynamicClues.reduce((best, current) => {
        const bestScore = best.connectedWords.length * (best.safetyScore || 1);
        const currentScore = current.connectedWords.length * (current.safetyScore || 1);
        return currentScore > bestScore ? current : best;
      });
      
      console.log(`Best dynamic clue: "${bestClue.clue}" for ${bestClue.connectedWords.length} words (safety: ${bestClue.safetyScore})`);
      // Track this clue as used
      this.previousClues.push(bestClue.clue);
      
      // Add to clue history
      this.clueHistory.push({
        team: this.currentTeam,
        clue: bestClue.clue,
        number: bestClue.connectedWords.length,
        targetWords: bestClue.connectedWords.map(w => w.word) || []
      });
      
      return { clue: bestClue.clue, number: bestClue.connectedWords.length };
    }

    // Fallback: single word clues
    const singleClues = this.generateSingleWordCluesForTeam(teamWords, enemyWords, neutralWords, assassinWords);
    if (singleClues.length > 0) {
      const randomClue = singleClues[Math.floor(Math.random() * singleClues.length)];
      console.log(`Single word clue: "${randomClue.clue}"`);
      // Track this clue as used
      this.previousClues.push(randomClue.clue);
      return { clue: randomClue.clue, number: 1 };
    }

    // Last resort: pass
    console.log('No safe clues found - PASSING');
    return { clue: 'PASS', number: 0 };
  }

  generateDynamicClues(teamWords, enemyWords, neutralWords, assassinWords) {
    const dynamicClues = [];
    
    // 1. Find common themes among team words
    const teamThemes = this.findCommonThemes(teamWords);
    
    for (const theme of teamThemes) {
      const connectedWords = teamWords.filter(w => this.wordBelongsToTheme(w.word, theme));
      const safetyScore = this.calculateSafetyScore(theme, enemyWords, neutralWords, assassinWords);
      
      if (connectedWords.length >= 1 && safetyScore > 0) {
        dynamicClues.push({
          clue: theme,
          connectedWords: connectedWords,
          safetyScore: safetyScore
        });
      }
    }
    
    // 2. Find semantic connections between team words
    const semanticClues = this.findSemanticConnections(teamWords, enemyWords, neutralWords, assassinWords);
    dynamicClues.push(...semanticClues);
    
    // 3. Find contextual connections between team words
    const contextualClues = this.findContextualConnections(teamWords, enemyWords, neutralWords, assassinWords);
    dynamicClues.push(...contextualClues);
    
    return dynamicClues;
  }

  findCommonThemes(teamWords) {
    const themes = [];
    const wordList = teamWords.map(w => w.word.toUpperCase());
    
    // Check for animal themes
    if (this.hasAnimalWords(wordList)) {
      themes.push('ANIMAL');
    }
    
    // Check for nature themes
    if (this.hasNatureWords(wordList)) {
      themes.push('NATURE');
    }
    
    // Check for color themes
    if (this.hasColorWords(wordList)) {
      themes.push('COLOR');
    }
    
    // Check for food themes
    if (this.hasFoodWords(wordList)) {
      themes.push('FOOD');
    }
    
    // Check for body part themes
    if (this.hasBodyWords(wordList)) {
      themes.push('BODY');
    }
    
    // Check for transportation themes
    if (this.hasTransportWords(wordList)) {
      themes.push('VEHICLE');
    }
    
    // Check for tool themes
    if (this.hasToolWords(wordList)) {
      themes.push('TOOL');
    }
    
    // Check for furniture themes
    if (this.hasFurnitureWords(wordList)) {
      themes.push('FURNITURE');
    }
    
    // Check for electronic themes
    if (this.hasElectronicWords(wordList)) {
      themes.push('ELECTRONIC');
    }
    
    // Check for building themes
    if (this.hasBuildingWords(wordList)) {
      themes.push('BUILDING');
    }
    
    return themes;
  }

  wordBelongsToTheme(word, theme) {
    const wordUpper = word.toUpperCase();
    
    switch (theme) {
      case 'ANIMAL':
        return this.hasAnimalWords([wordUpper]);
      case 'NATURE':
        return this.hasNatureWords([wordUpper]);
      case 'COLOR':
        return this.hasColorWords([wordUpper]);
      case 'FOOD':
        return this.hasFoodWords([wordUpper]);
      case 'BODY':
        return this.hasBodyWords([wordUpper]);
      case 'VEHICLE':
        return this.hasTransportWords([wordUpper]);
      case 'TOOL':
        return this.hasToolWords([wordUpper]);
      case 'FURNITURE':
        return this.hasFurnitureWords([wordUpper]);
      case 'ELECTRONIC':
        return this.hasElectronicWords([wordUpper]);
      case 'BUILDING':
        return this.hasBuildingWords([wordUpper]);
      default:
        return false;
    }
  }

  calculateSafetyScore(theme, enemyWords, neutralWords, assassinWords) {
    // Safety checks to ensure all parameters are arrays
    const safeEnemyWords = Array.isArray(enemyWords) ? enemyWords : [];
    const safeNeutralWords = Array.isArray(neutralWords) ? neutralWords : [];
    const safeAssassinWords = Array.isArray(assassinWords) ? assassinWords : [];
    
    const allDangerWords = [...safeEnemyWords, ...safeNeutralWords, ...safeAssassinWords];
    let safetyScore = 1.0;
    
    // Check if theme connects to any dangerous words
    for (const word of allDangerWords) {
      if (this.wordBelongsToTheme(word.word, theme)) {
        safetyScore -= 0.5; // Reduce safety score for each dangerous connection
      }
    }
    
    // Extra penalty for assassin connections
    for (const word of safeAssassinWords) {
      if (this.wordBelongsToTheme(word.word, theme)) {
        safetyScore -= 0.8; // Heavy penalty for assassin connections
      }
    }
    
    return Math.max(0, safetyScore);
  }

  findSemanticConnections(teamWords, enemyWords, neutralWords, assassinWords) {
    const semanticClues = [];
    
    // Look for words that share semantic properties
    for (let i = 0; i < teamWords.length; i++) {
      for (let j = i + 1; j < teamWords.length; j++) {
        const word1 = teamWords[i].word;
        const word2 = teamWords[j].word;
        
        // Find common semantic properties
        const commonProperties = this.findCommonProperties(word1, word2);
        
        for (const property of commonProperties) {
          const safetyScore = this.calculateSafetyScore(property, enemyWords, neutralWords, assassinWords);
          
          if (safetyScore > 0) {
            semanticClues.push({
              clue: property,
              connectedWords: [teamWords[i], teamWords[j]],
              safetyScore: safetyScore
            });
          }
        }
      }
    }
    
    return semanticClues;
  }

  findCommonProperties(word1, word2) {
    const properties = [];
    const w1 = word1.toUpperCase();
    const w2 = word2.toUpperCase();
    
    // Check for common themes
    const themes = ['ANIMAL', 'NATURE', 'COLOR', 'FOOD', 'BODY', 'VEHICLE', 'TOOL', 'FURNITURE', 'ELECTRONIC', 'BUILDING'];
    
    for (const theme of themes) {
      if (this.wordBelongsToTheme(w1, theme) && this.wordBelongsToTheme(w2, theme)) {
        properties.push(theme);
      }
    }
    
    // Check for common properties
    if (this.bothAreAnimals(w1, w2)) properties.push('ANIMAL');
    if (this.bothAreColors(w1, w2)) properties.push('COLOR');
    if (this.bothAreFood(w1, w2)) properties.push('FOOD');
    if (this.bothAreBodyParts(w1, w2)) properties.push('BODY');
    if (this.bothAreVehicles(w1, w2)) properties.push('VEHICLE');
    if (this.bothAreTools(w1, w2)) properties.push('TOOL');
    if (this.bothAreFurniture(w1, w2)) properties.push('FURNITURE');
    if (this.bothAreElectronics(w1, w2)) properties.push('ELECTRONIC');
    if (this.bothAreBuildings(w1, w2)) properties.push('BUILDING');
    
    return properties;
  }

  bothAreAnimals(word1, word2) {
    return this.hasAnimalWords([word1]) && this.hasAnimalWords([word2]);
  }

  bothAreColors(word1, word2) {
    return this.hasColorWords([word1]) && this.hasColorWords([word2]);
  }

  bothAreFood(word1, word2) {
    return this.hasFoodWords([word1]) && this.hasFoodWords([word2]);
  }

  bothAreBodyParts(word1, word2) {
    return this.hasBodyWords([word1]) && this.hasBodyWords([word2]);
  }

  bothAreVehicles(word1, word2) {
    return this.hasTransportWords([word1]) && this.hasTransportWords([word2]);
  }

  bothAreTools(word1, word2) {
    return this.hasToolWords([word1]) && this.hasToolWords([word2]);
  }

  bothAreFurniture(word1, word2) {
    return this.hasFurnitureWords([word1]) && this.hasFurnitureWords([word2]);
  }

  bothAreElectronics(word1, word2) {
    return this.hasElectronicWords([word1]) && this.hasElectronicWords([word2]);
  }

  bothAreBuildings(word1, word2) {
    return this.hasBuildingWords([word1]) && this.hasBuildingWords([word2]);
  }

  findContextualConnections(teamWords, enemyWords, neutralWords, assassinWords) {
    const contextualClues = [];
    
    // Look for words that share contextual meaning
    for (let i = 0; i < teamWords.length; i++) {
      for (let j = i + 1; j < teamWords.length; j++) {
        const word1 = teamWords[i].word;
        const word2 = teamWords[j].word;
        
        // Find contextual similarities
        const contextualSimilarities = this.findContextualSimilarities(word1, word2);
        
        for (const similarity of contextualSimilarities) {
          const safetyScore = this.calculateSafetyScore(similarity, enemyWords, neutralWords, assassinWords);
          
          if (safetyScore > 0) {
            contextualClues.push({
              clue: similarity,
              connectedWords: [teamWords[i], teamWords[j]],
              safetyScore: safetyScore
            });
          }
        }
      }
    }
    
    return contextualClues;
  }

  findContextualSimilarities(word1, word2) {
    const similarities = [];
    const w1 = word1.toUpperCase();
    const w2 = word2.toUpperCase();
    
    // Check for shared contextual themes
    const sharedThemes = this.findSharedContextualThemes(w1, w2);
    similarities.push(...sharedThemes);
    
    // Check for shared associations
    const sharedAssociations = this.findSharedAssociations(w1, w2);
    similarities.push(...sharedAssociations);
    
    return similarities;
  }

  findSharedContextualThemes(word1, word2) {
    const themes = [];
    
    // Check if both are animals
    if (this.hasAnimalWords([word1]) && this.hasAnimalWords([word2])) {
      themes.push('ANIMAL', 'CREATURE', 'WILD', 'FUR');
    }
    
    // Check if both are nature-related
    if (this.hasNatureWords([word1]) && this.hasNatureWords([word2])) {
      themes.push('NATURE', 'OUTDOORS', 'EARTH', 'GREEN');
    }
    
    // Check if both are colors
    if (this.hasColorWords([word1]) && this.hasColorWords([word2])) {
      themes.push('COLOR', 'HUE', 'BRIGHT', 'DARK');
    }
    
    // Check if both are food
    if (this.hasFoodWords([word1]) && this.hasFoodWords([word2])) {
      themes.push('FOOD', 'EAT', 'TASTE', 'MEAL');
    }
    
    // Check if both are body parts
    if (this.hasBodyWords([word1]) && this.hasBodyWords([word2])) {
      themes.push('BODY', 'HUMAN', 'PHYSICAL', 'PART');
    }
    
    // Check if both are vehicles
    if (this.hasTransportWords([word1]) && this.hasTransportWords([word2])) {
      themes.push('VEHICLE', 'TRAVEL', 'MOVE', 'RIDE');
    }
    
    // Check if both are tools
    if (this.hasToolWords([word1]) && this.hasToolWords([word2])) {
      themes.push('TOOL', 'WORK', 'BUILD', 'REPAIR');
    }
    
    // Check if both are furniture
    if (this.hasFurnitureWords([word1]) && this.hasFurnitureWords([word2])) {
      themes.push('FURNITURE', 'HOME', 'ROOM', 'COMFORT');
    }
    
    // Check if both are electronics
    if (this.hasElectronicWords([word1]) && this.hasElectronicWords([word2])) {
      themes.push('ELECTRONIC', 'DIGITAL', 'TECH', 'DEVICE');
    }
    
    // Check if both are buildings
    if (this.hasBuildingWords([word1]) && this.hasBuildingWords([word2])) {
      themes.push('BUILDING', 'STRUCTURE', 'PLACE', 'HOME');
    }
    
    return themes;
  }

  findSharedAssociations(word1, word2) {
    const associations = [];
    
    // Check for shared emotional associations
    if (this.hasEmotionalAssociation(word1) && this.hasEmotionalAssociation(word2)) {
      associations.push('EMOTION', 'FEELING', 'HEART');
    }
    
    // Check for shared action associations
    if (this.hasActionAssociation(word1) && this.hasActionAssociation(word2)) {
      associations.push('ACTION', 'MOVE', 'DO');
    }
    
    // Check for shared sensory associations
    if (this.hasSensoryAssociation(word1) && this.hasSensoryAssociation(word2)) {
      associations.push('SENSORY', 'FEEL', 'TOUCH');
    }
    
    return associations;
  }

  hasEmotionalAssociation(word) {
    const emotionalWords = ['HEART', 'LOVE', 'HAPPY', 'SAD', 'ANGER', 'FEAR', 'JOY', 'PEACE', 'HOPE', 'DREAM'];
    return emotionalWords.includes(word);
  }

  hasActionAssociation(word) {
    const actionWords = ['RUN', 'WALK', 'JUMP', 'FLY', 'SWIM', 'DIVE', 'CLIMB', 'CRAWL', 'SIT', 'STAND', 'LIE', 'SLEEP', 'WAKE', 'EAT', 'DRINK', 'COOK', 'BAKE', 'FRY', 'BOIL', 'STEAM', 'CUT', 'CHOP', 'SLICE', 'DICE', 'MIX', 'STIR', 'POUR', 'SPILL', 'DROP', 'CATCH', 'THROW', 'HIT', 'MISS', 'WIN', 'LOSE', 'PLAY', 'WORK', 'REST', 'RELAX'];
    return actionWords.includes(word);
  }

  hasSensoryAssociation(word) {
    const sensoryWords = ['HOT', 'COLD', 'WARM', 'COOL', 'WET', 'DRY', 'SOFT', 'HARD', 'HEAVY', 'LIGHT', 'BRIGHT', 'DARK', 'LOUD', 'QUIET', 'SWEET', 'SOUR', 'SALTY', 'BITTER', 'SPICY', 'MILD'];
    return sensoryWords.includes(word);
  }

  hasAnimalWords(words) {
    const animalWords = ['CAT', 'DOG', 'BIRD', 'FISH', 'LION', 'BEAR', 'TIGER', 'ELEPHANT', 'MONKEY', 'RABBIT', 'MOUSE', 'HORSE', 'COW', 'PIG', 'SHEEP', 'GOAT', 'CHICKEN', 'DUCK', 'GOOSE', 'TURKEY', 'OWL', 'EAGLE', 'HAWK', 'PARROT', 'PENGUIN', 'SEAL', 'WHALE', 'DOLPHIN', 'SHARK', 'OCTOPUS', 'CRAB', 'LOBSTER', 'BUTTERFLY', 'BEE', 'SPIDER', 'ANT', 'LADYBUG', 'SNAIL', 'FROG', 'SNAKE', 'TURTLE', 'LIZARD', 'HAMSTER', 'GUINEA', 'FERRET', 'RACCOON', 'SKUNK', 'OPOSSUM', 'DEER', 'WOLF'];
    return words.some(word => animalWords.includes(word));
  }

  hasNatureWords(words) {
    const natureWords = ['TREE', 'FLOWER', 'GRASS', 'LEAF', 'BRANCH', 'ROOT', 'SEED', 'FRUIT', 'NUT', 'BERRY', 'SUN', 'MOON', 'STAR', 'CLOUD', 'RAIN', 'SNOW', 'WIND', 'STORM', 'LIGHTNING', 'THUNDER', 'FIRE', 'SMOKE', 'ASH', 'ICE', 'FROST', 'DEW', 'MIST', 'FOG', 'SUNSHINE', 'SHADOW', 'MOUNTAIN', 'HILL', 'VALLEY', 'RIVER', 'LAKE', 'OCEAN', 'BEACH', 'SAND', 'ROCK', 'STONE'];
    return words.some(word => natureWords.includes(word));
  }

  hasColorWords(words) {
    const colorWords = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BROWN', 'BLACK', 'WHITE', 'GRAY', 'SILVER', 'GOLD', 'BRONZE', 'COPPER', 'TAN', 'BEIGE', 'NAVY', 'MAROON', 'LIME'];
    return words.some(word => colorWords.includes(word));
  }

  hasFoodWords(words) {
    const foodWords = ['APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'STRAWBERRY', 'CHERRY', 'LEMON', 'LIME', 'PEACH', 'PEAR', 'BREAD', 'CAKE', 'COOKIE', 'PIE', 'PIZZA', 'BURGER', 'HOTDOG', 'SANDWICH', 'SALAD', 'SOUP', 'CHICKEN', 'BEEF', 'PORK', 'FISH', 'EGG', 'CHEESE', 'MILK', 'JUICE', 'SODA', 'COFFEE', 'TEA', 'WATER', 'BEER', 'WINE', 'ICE', 'CANDY', 'CHOCOLATE', 'GUM', 'POPCORN', 'CHIPS', 'CEREAL', 'YOGURT', 'BUTTER', 'SUGAR', 'SALT', 'PEPPER', 'HONEY', 'JAM', 'JELLY', 'SYRUP'];
    return words.some(word => foodWords.includes(word));
  }

  hasBodyWords(words) {
    const bodyWords = ['HEAD', 'FACE', 'EYE', 'NOSE', 'MOUTH', 'EAR', 'TOOTH', 'TONGUE', 'CHIN', 'CHEEK', 'NECK', 'SHOULDER', 'ARM', 'HAND', 'FINGER', 'THUMB', 'NAIL', 'CHEST', 'BACK', 'STOMACH', 'LEG', 'KNEE', 'FOOT', 'TOE', 'HEEL', 'ANKLE', 'WRIST', 'ELBOW', 'HIP', 'WAIST'];
    return words.some(word => bodyWords.includes(word));
  }

  hasTransportWords(words) {
    const transportWords = ['CAR', 'TRUCK', 'BUS', 'TRAIN', 'PLANE', 'BOAT', 'SHIP', 'BIKE', 'MOTORCYCLE', 'SCOOTER', 'SKATEBOARD', 'ROLLER', 'WAGON', 'CART', 'WHEEL', 'TIRE', 'ENGINE', 'MOTOR', 'GAS', 'FUEL', 'ROAD', 'STREET', 'BRIDGE', 'TUNNEL', 'STATION', 'AIRPORT', 'HARBOR', 'DOCK', 'PARKING', 'GARAGE'];
    return words.some(word => transportWords.includes(word));
  }

  hasToolWords(words) {
    const toolWords = ['HAMMER', 'SCREWDRIVER', 'WRENCH', 'PLIERS', 'SAW', 'DRILL', 'SCREW', 'NAIL', 'BOLT', 'NUT', 'HINGE', 'HANDLE', 'KNOB', 'SWITCH', 'BUTTON', 'LEVER', 'PEDAL', 'BRAKE', 'ACCELERATOR', 'GEAR', 'CHAIN', 'BELT', 'PULLEY', 'WHEEL', 'AXLE', 'SPRING', 'COIL', 'CABLE', 'WIRE', 'CORD'];
    return words.some(word => toolWords.includes(word));
  }

  hasFurnitureWords(words) {
    const furnitureWords = ['CHAIR', 'TABLE', 'BED', 'SOFA', 'DESK', 'SHELF', 'CABINET', 'DRAWER', 'MIRROR', 'PICTURE', 'CLOCK', 'LAMP', 'CANDLE', 'VASE', 'BOWL', 'PLATE', 'CUP', 'GLASS', 'MUG', 'SPOON', 'FORK', 'KNIFE', 'BOTTLE', 'CAN', 'JAR', 'BOX', 'BAG', 'BASKET', 'BUCKET', 'TOWEL', 'BLANKET', 'PILLOW', 'SHEET', 'CURTAIN', 'RUG', 'CARPET', 'DOOR', 'WINDOW', 'KEY', 'LOCK'];
    return words.some(word => furnitureWords.includes(word));
  }

  hasElectronicWords(words) {
    const electronicWords = ['COMPUTER', 'LAPTOP', 'TABLET', 'PHONE', 'CAMERA', 'TELEVISION', 'RADIO', 'SPEAKER', 'HEADPHONE', 'MICROPHONE', 'KEYBOARD', 'MOUSE', 'SCREEN', 'MONITOR', 'PRINTER', 'SCANNER', 'ROUTER', 'MODEM', 'CHARGER', 'BATTERY', 'REMOTE', 'CONTROLLER', 'JOYSTICK', 'GAMEPAD', 'CONSOLE', 'ARCADE', 'PINBALL', 'SLOT', 'VENDING', 'ATM', 'WATCH', 'CLOCK', 'TIMER', 'STOPWATCH', 'CALENDAR', 'PLANNER', 'DIARY', 'JOURNAL', 'NOTEBOOK', 'BINDER'];
    return words.some(word => electronicWords.includes(word));
  }

  hasBuildingWords(words) {
    const buildingWords = ['CASTLE', 'PALACE', 'BRIDGE', 'LIGHTHOUSE', 'TOWER', 'CHURCH', 'TEMPLE', 'MOSQUE', 'SYNAGOGUE', 'CATHEDRAL', 'MUSEUM', 'LIBRARY', 'SCHOOL', 'HOSPITAL', 'BANK', 'STORE', 'RESTAURANT', 'HOTEL', 'THEATER', 'CINEMA', 'STADIUM', 'ARENA', 'GYM', 'POOL', 'PARK', 'GARDEN', 'ZOO', 'AQUARIUM', 'PLANETARIUM', 'OBSERVATORY', 'FACTORY', 'WAREHOUSE', 'GARAGE', 'BARN', 'SHED', 'CABIN', 'COTTAGE', 'MANSION', 'APARTMENT', 'CONDO', 'SKYSCRAPER', 'MONUMENT', 'STATUE', 'FOUNTAIN', 'SCULPTURE', 'MEMORIAL', 'TRIBUTE', 'SHRINE', 'ALTAR', 'PODIUM'];
    return words.some(word => buildingWords.includes(word));
  }

  generateSingleWordClues(teamWords, enemyWords, neutralWords, assassinWords) {
    const singleClues = [];
    
    for (const teamWord of teamWords) {
      console.log(`\nAnalyzing single word: "${teamWord.word}"`);
      
      // Generate dynamic clues for this word
      const dynamicClues = this.generateDynamicSingleWordClues(teamWord, enemyWords, neutralWords, assassinWords);
      
      console.log(`Generated ${dynamicClues.length} potential clues for "${teamWord.word}":`, dynamicClues.map(c => c.clue));
      
      for (const clue of dynamicClues) {
        if (this.isClueSafe(clue.clue, teamWord.word, enemyWords, neutralWords, assassinWords)) {
          console.log(`✓ Safe clue found: "${clue.clue}" for "${teamWord.word}"`);
          singleClues.push({
            clue: clue.clue,
            connectedWords: [teamWord],
            safetyScore: clue.safetyScore
          });
        } else {
          console.log(`✗ Unsafe clue: "${clue.clue}" for "${teamWord.word}" - would connect to enemy/neutral/assassin`);
        }
      }
    }
    
    return singleClues;
  }

  generateDynamicSingleWordClues(teamWord, enemyWords, neutralWords, assassinWords) {
    const clues = [];
    const word = teamWord.word.toUpperCase();
    
    // 1. Generate semantic clues based on word properties
    const semanticClues = this.generateSemanticClues(word);
    
    for (const clue of semanticClues) {
      const safetyScore = this.calculateSafetyScore(clue, enemyWords, neutralWords, assassinWords);
      if (safetyScore > 0) {
        clues.push({
          clue: clue,
          safetyScore: safetyScore
        });
      }
    }
    
    // 2. Generate contextual clues based on word meaning and associations
    const contextualClues = this.generateContextualClues(word);
    
    for (const clue of contextualClues) {
      const safetyScore = this.calculateSafetyScore(clue, enemyWords, neutralWords, assassinWords);
      if (safetyScore > 0) {
        clues.push({
          clue: clue,
          safetyScore: safetyScore
        });
      }
    }
    
    return clues;
  }

  generateSemanticClues(word) {
    const clues = [];
    
    // Check what category this word belongs to and generate appropriate clues
    if (this.hasAnimalWords([word])) {
      clues.push('ANIMAL', 'CREATURE', 'PET', 'WILD', 'FUR');
    }
    
    if (this.hasNatureWords([word])) {
      clues.push('NATURE', 'GREEN', 'OUTDOORS', 'EARTH', 'PLANT');
    }
    
    if (this.hasColorWords([word])) {
      clues.push('COLOR', 'HUE', 'SHADE', 'BRIGHT', 'DARK');
    }
    
    if (this.hasFoodWords([word])) {
      clues.push('FOOD', 'EAT', 'MEAL', 'TASTE', 'COOK');
    }
    
    if (this.hasBodyWords([word])) {
      clues.push('BODY', 'HUMAN', 'PHYSICAL', 'ORGAN', 'PART');
    }
    
    if (this.hasTransportWords([word])) {
      clues.push('VEHICLE', 'TRAVEL', 'MOVE', 'RIDE', 'DRIVE');
    }
    
    if (this.hasToolWords([word])) {
      clues.push('TOOL', 'DEVICE', 'EQUIPMENT', 'MACHINE', 'INSTRUMENT');
    }
    
    if (this.hasFurnitureWords([word])) {
      clues.push('FURNITURE', 'CHAIR', 'TABLE', 'DECOR', 'ROOM');
    }
    
    if (this.hasElectronicWords([word])) {
      clues.push('ELECTRONIC', 'DIGITAL', 'TECH', 'DEVICE', 'GADGET');
    }
    
    if (this.hasBuildingWords([word])) {
      clues.push('BUILDING', 'HOUSE', 'STRUCTURE', 'PLACE', 'HOME');
    }
    
    return clues;
  }

  generateContextualClues(word) {
    const clues = [];
    
    // Generate contextual clues based on word meaning and associations
    const contextualMappings = {
      // Animals
      'CAT': ['FELINE', 'PET', 'MEOW', 'WHISKERS', 'CLAWS'],
      'DOG': ['CANINE', 'PET', 'BARK', 'TAIL', 'PAW'],
      'LION': ['FELINE', 'WILD', 'MANE', 'KING', 'ROAR'],
      'BIRD': ['WING', 'FEATHER', 'FLY', 'BEAK', 'NEST'],
      'FISH': ['SWIM', 'GILL', 'WATER', 'SCALE', 'FIN'],
      'BEAR': ['WILD', 'FUR', 'HIBERNATE', 'CLAW', 'DEN'],
      'TIGER': ['FELINE', 'WILD', 'STRIPE', 'ORANGE', 'ROAR'],
      'ELEPHANT': ['LARGE', 'TRUNK', 'TUSK', 'MEMORY', 'HERD'],
      'MONKEY': ['SWING', 'BANANA', 'TREE', 'CURIOUS', 'TROOP'],
      'RABBIT': ['HOP', 'EAR', 'CARROT', 'BURROW', 'FUR'],
      
      // Nature
      'TREE': ['PLANT', 'LEAF', 'BRANCH', 'ROOT', 'WOOD'],
      'FLOWER': ['BLOOM', 'PETAL', 'GARDEN', 'BEAUTIFUL', 'COLOR'],
      'SUN': ['STAR', 'LIGHT', 'HEAT', 'DAY', 'BRIGHT'],
      'MOON': ['NIGHT', 'PHASE', 'SILVER', 'ROUND', 'SKY'],
      'WATER': ['LIQUID', 'WET', 'DRINK', 'OCEAN', 'CLEAR'],
      'FIRE': ['FLAME', 'HOT', 'BURN', 'RED', 'HEAT'],
      'ICE': ['COLD', 'FROZEN', 'WINTER', 'CRYSTAL', 'MELT'],
      'MOUNTAIN': ['HIGH', 'PEAK', 'CLIMB', 'ROCK', 'SNOW'],
      'OCEAN': ['WATER', 'WAVE', 'BLUE', 'DEEP', 'FISH'],
      'RAIN': ['WATER', 'WET', 'CLOUD', 'DROP', 'STORM'],
      
      // Colors
      'RED': ['COLOR', 'FIRE', 'LOVE', 'STOP', 'ROSE'],
      'BLUE': ['COLOR', 'SKY', 'OCEAN', 'SAD', 'COOL'],
      'GREEN': ['COLOR', 'NATURE', 'GRASS', 'MONEY', 'FRESH'],
      'YELLOW': ['COLOR', 'SUN', 'BRIGHT', 'HAPPY', 'BANANA'],
      'BLACK': ['COLOR', 'NIGHT', 'DARK', 'SHADOW', 'MYSTERY'],
      'WHITE': ['COLOR', 'SNOW', 'PURE', 'CLEAN', 'LIGHT'],
      
      // Food
      'APPLE': ['FRUIT', 'RED', 'SWEET', 'TREE', 'HEALTHY'],
      'BREAD': ['FOOD', 'WHEAT', 'BAKE', 'SANDWICH', 'FRESH'],
      'PIZZA': ['FOOD', 'CHEESE', 'ITALIAN', 'ROUND', 'HOT'],
      'CAKE': ['SWEET', 'BIRTHDAY', 'FROSTING', 'CELEBRATE', 'DESSERT'],
      'COFFEE': ['DRINK', 'HOT', 'MORNING', 'BEAN', 'ENERGY'],
      'CHOCOLATE': ['SWEET', 'BROWN', 'CANDY', 'DESSERT', 'COCOA'],
      
      // Body Parts
      'HEAD': ['BODY', 'FACE', 'THINK', 'TOP', 'BRAIN'],
      'HAND': ['BODY', 'FINGER', 'TOUCH', 'WAVE', 'WORK'],
      'EYE': ['BODY', 'SEE', 'VISION', 'LOOK', 'WATCH'],
      'FOOT': ['BODY', 'WALK', 'SHOE', 'STEP', 'TOE'],
      'HEART': ['BODY', 'LOVE', 'BEAT', 'BLOOD', 'EMOTION'],
      
      // Transportation
      'CAR': ['VEHICLE', 'DRIVE', 'ROAD', 'WHEEL', 'SPEED'],
      'PLANE': ['FLY', 'SKY', 'TRAVEL', 'WING', 'PILOT'],
      'BOAT': ['WATER', 'SAIL', 'WAVE', 'OCEAN', 'FLOAT'],
      'TRAIN': ['TRACK', 'RAIL', 'TRAVEL', 'STEAM', 'STATION'],
      'BIKE': ['PEDAL', 'WHEEL', 'RIDE', 'EXERCISE', 'SPEED'],
      
      // Tools
      'HAMMER': ['TOOL', 'NAIL', 'HIT', 'BUILD', 'WORK'],
      'SCREWDRIVER': ['TOOL', 'SCREW', 'TURN', 'REPAIR', 'WORK'],
      'SAW': ['TOOL', 'CUT', 'WOOD', 'TEETH', 'WORK'],
      'KNIFE': ['TOOL', 'CUT', 'SHARP', 'BLADE', 'KITCHEN'],
      
      // Furniture
      'CHAIR': ['SIT', 'FURNITURE', 'COMFORT', 'LEG', 'BACK'],
      'TABLE': ['FURNITURE', 'EAT', 'SURFACE', 'LEG', 'WOOD'],
      'BED': ['SLEEP', 'FURNITURE', 'REST', 'PILLOW', 'COMFORT'],
      'LAMP': ['LIGHT', 'BRIGHT', 'ELECTRIC', 'ROOM', 'SHADE'],
      
      // Electronics
      'PHONE': ['CALL', 'TALK', 'RING', 'COMMUNICATION', 'MOBILE'],
      'COMPUTER': ['SCREEN', 'KEYBOARD', 'WORK', 'INTERNET', 'DIGITAL'],
      'CAMERA': ['PHOTO', 'PICTURE', 'LENS', 'MEMORY', 'CAPTURE'],
      'WATCH': ['TIME', 'WRIST', 'CLOCK', 'HAND', 'TICK'],
      
      // Buildings
      'HOUSE': ['HOME', 'LIVE', 'ROOF', 'WALL', 'FAMILY'],
      'CASTLE': ['PALACE', 'KING', 'TOWER', 'ROYAL', 'STONE'],
      'HOSPITAL': ['DOCTOR', 'SICK', 'HEALTH', 'MEDICAL', 'CARE'],
      'SCHOOL': ['LEARN', 'TEACHER', 'STUDENT', 'EDUCATION', 'CLASS']
    };
    
    const wordUpper = word.toUpperCase();
    if (contextualMappings[wordUpper]) {
      clues.push(...contextualMappings[wordUpper]);
    }
    
    return clues;
  }

  isThemeSafe(theme, enemyWords, neutralWords, assassinWords) {
    // Safety checks to ensure all parameters are arrays
    const safeEnemyWords = Array.isArray(enemyWords) ? enemyWords : [];
    const safeNeutralWords = Array.isArray(neutralWords) ? neutralWords : [];
    const safeAssassinWords = Array.isArray(assassinWords) ? assassinWords : [];
    
    const allWords = [...safeEnemyWords, ...safeNeutralWords, ...safeAssassinWords];
    const themes = this.getWordThemes();
    const themeWords = themes[theme] || [];
    
    // Check if any enemy/neutral/assassin words match this theme
    return !allWords.some(word => themeWords.includes(word.word.toUpperCase()));
  }

  isClueSafe(clue, targetWord, enemyWords, neutralWords, assassinWords) {
    // Safety checks to ensure all parameters are arrays
    const safeEnemyWords = Array.isArray(enemyWords) ? enemyWords : [];
    const safeNeutralWords = Array.isArray(neutralWords) ? neutralWords : [];
    const safeAssassinWords = Array.isArray(assassinWords) ? assassinWords : [];
    
    const allWords = [...safeEnemyWords, ...safeNeutralWords, ...safeAssassinWords];
    
    console.log(`Checking clue safety for "${clue}" targeting "${targetWord}":`);
    console.log(`Dangerous words to check:`, allWords.map(w => w.word));
    
    // Check if the clue matches any enemy/neutral/assassin words
    for (const word of allWords) {
      if (this.wordMatchesClue(word.word, clue)) {
        console.log(`✗ Clue "${clue}" is UNSAFE - matches dangerous word "${word.word}"`);
        return false;
      }
    }
    
    console.log(`✓ Clue "${clue}" is SAFE`);
    return true;
  }

  generateSingleWordClues(word) {
    // Generate real, accessible clues for a single word
    const abstractClues = [];
    
    // Simple, accessible category-based clues
    const categories = {
      'ANIMALS': ['ANIMAL', 'CREATURE', 'PET', 'WILD', 'FUR'],
      'NATURE': ['NATURE', 'GREEN', 'OUTDOORS', 'EARTH', 'PLANT'],
      'COLORS': ['COLOR', 'HUE', 'SHADE', 'BRIGHT', 'DARK'],
      'FOOD': ['FOOD', 'EAT', 'MEAL', 'TASTE', 'COOK'],
      'WEATHER': ['WEATHER', 'SKY', 'STORM', 'WIND', 'RAIN'],
      'MUSIC': ['MUSIC', 'SOUND', 'SONG', 'MELODY', 'RHYTHM'],
      'BODY': ['BODY', 'HUMAN', 'PHYSICAL', 'ORGAN', 'PART'],
      'TRANSPORT': ['VEHICLE', 'TRAVEL', 'MOVE', 'RIDE', 'DRIVE'],
      'TOOLS': ['TOOL', 'DEVICE', 'EQUIPMENT', 'MACHINE', 'INSTRUMENT'],
      'FURNITURE': ['FURNITURE', 'CHAIR', 'TABLE', 'DECOR', 'ROOM'],
      'ELECTRONICS': ['ELECTRONIC', 'DIGITAL', 'TECH', 'DEVICE', 'GADGET'],
      'JEWELRY': ['JEWELRY', 'ORNAMENT', 'DECORATION', 'ACCESSORY', 'RING'],
      'GAMES': ['GAME', 'TOY', 'PLAY', 'FUN', 'SPORT'],
      'BUILDINGS': ['BUILDING', 'HOUSE', 'STRUCTURE', 'PLACE', 'HOME'],
      'SPACE': ['SPACE', 'STAR', 'PLANET', 'SKY', 'UNIVERSE'],
      'GEOGRAPHY': ['PLACE', 'LAND', 'EARTH', 'WORLD', 'COUNTRY']
    };
    
    for (const [category, clues] of Object.entries(categories)) {
      if (this.getWordThemes()[category]?.includes(word.toUpperCase())) {
        abstractClues.push(...clues);
      }
    }
    
    // Simple word-based clues (only if they're real words)
    const wordUpper = word.toUpperCase();
    if (wordUpper.length >= 4) {
      // Try first 4 letters if it makes sense
      const prefix = wordUpper.substring(0, 4);
      if (this.isRealWord(prefix)) {
        abstractClues.push(prefix);
      }
    }
    
    return abstractClues;
  }

  generateSingleWordCluesForTeam(teamWords, enemyWords, neutralWords, assassinWords) {
    // Generate single word clues for team words, avoiding dangerous words
    const safeClues = [];
    
    for (const teamWord of teamWords) {
      const word = teamWord.word;
      const clues = this.generateSingleWordClues(word);
      
      for (const clue of clues) {
        // Check if this clue is safe (doesn't match enemy/neutral/assassin words)
        if (this.isClueSafe(clue, word, enemyWords, neutralWords, assassinWords)) {
          safeClues.push({ clue, word: word });
        }
      }
    }
    
    return safeClues;
  }

  generateDirectClues(word) {
    const directClues = [];
    const wordUpper = word.toUpperCase();
    
    // Direct semantic clues based on word meaning - only real, accessible words
    const semanticClues = {
      'CAT': ['ANIMAL', 'PET', 'FUR', 'MEOW'],
      'DOG': ['ANIMAL', 'PET', 'FUR', 'BARK'],
      'LION': ['ANIMAL', 'WILD', 'FUR', 'KING'],
      'BIRD': ['ANIMAL', 'FLY', 'WING', 'FEATHER'],
      'FISH': ['ANIMAL', 'SWIM', 'WATER', 'GILL'],
      'TREE': ['PLANT', 'LEAF', 'BRANCH', 'NATURE'],
      'SUN': ['STAR', 'LIGHT', 'HEAT', 'DAY'],
      'MOON': ['NIGHT', 'SKY', 'STAR', 'ROUND'],
      'WATER': ['WET', 'DRINK', 'LIQUID', 'CLEAN'],
      'FIRE': ['HOT', 'BURN', 'RED', 'FLAME'],
      'ICE': ['COLD', 'FROZEN', 'WINTER', 'WATER'],
      'CAR': ['VEHICLE', 'DRIVE', 'ROAD', 'WHEEL'],
      'HOUSE': ['HOME', 'BUILDING', 'ROOF', 'WALL'],
      'BOOK': ['READ', 'PAGE', 'STORY', 'PAPER'],
      'BALL': ['ROUND', 'SPORT', 'PLAY', 'CIRCLE'],
      'PHONE': ['CALL', 'RING', 'TALK', 'DEVICE'],
      'WATCH': ['TIME', 'CLOCK', 'WRIST', 'HAND'],
      'RING': ['JEWELRY', 'FINGER', 'GOLD', 'ROUND'],
      'HAT': ['HEAD', 'WEAR', 'CAP', 'CLOTHING'],
      'SHOE': ['FOOT', 'WALK', 'LEATHER', 'WEAR'],
      'BAG': ['CARRY', 'HOLD', 'PURSE', 'CONTAINER'],
      'BOX': ['CONTAINER', 'SQUARE', 'PACKAGE', 'STORE'],
      'CUP': ['DRINK', 'HOLD', 'LIQUID', 'CONTAINER'],
      'PLATE': ['EAT', 'FOOD', 'DISH', 'DINNER'],
      'CHAIR': ['SIT', 'FURNITURE', 'SEAT', 'COMFORT'],
      'TABLE': ['FURNITURE', 'EAT', 'SURFACE', 'WOOD'],
      'LAMP': ['LIGHT', 'BRIGHT', 'ELECTRIC', 'ROOM'],
      'CLOCK': ['TIME', 'HOUR', 'MINUTE', 'WATCH'],
      'PEN': ['WRITE', 'INK', 'PAPER', 'TOOL'],
      'PAPER': ['WRITE', 'WHITE', 'SHEET', 'DOCUMENT'],
      'PENCIL': ['WRITE', 'DRAW', 'LEAD', 'TOOL'],
      'SPOON': ['EAT', 'SILVER', 'UTENSIL', 'SOUP'],
      'FORK': ['EAT', 'UTENSIL', 'PRONG', 'DINNER'],
      'KNIFE': ['CUT', 'SHARP', 'BLADE', 'TOOL'],
      'BOTTLE': ['DRINK', 'GLASS', 'CONTAINER', 'LIQUID'],
      'CAN': ['CONTAINER', 'METAL', 'DRINK', 'STORE']
    };
    
    if (semanticClues[wordUpper]) {
      // Filter to only include real words
      const validClues = semanticClues[wordUpper].filter(clue => this.isRealWord(clue));
      directClues.push(...validClues);
    }
    
    return directClues;
  }

  isRealWord(word) {
    // List of common, accessible English words that make good clues
    const realWords = new Set([
      // Basic words
      'ANIMAL', 'CREATURE', 'PET', 'WILD', 'FUR', 'FEATHER', 'WING', 'TAIL', 'CLAW', 'HORN', 'FELINE', 'CANINE', 'BIRD', 'FISH', 'MAMMAL', 'REPTILE', 'AMPHIBIAN', 'INSECT', 'BEAST', 'FAUNA',
      'NATURE', 'GREEN', 'OUTDOORS', 'EARTH', 'PLANT', 'TREE', 'FLOWER', 'LEAF', 'ROOT', 'SEED', 'FOREST', 'GARDEN', 'PARK', 'WOODS', 'JUNGLE', 'DESERT', 'OCEAN', 'RIVER', 'LAKE', 'MOUNTAIN',
      'COLOR', 'HUE', 'SHADE', 'BRIGHT', 'DARK', 'LIGHT', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BROWN', 'BLACK', 'WHITE', 'GRAY', 'SILVER', 'GOLD',
      'FOOD', 'EAT', 'MEAL', 'TASTE', 'COOK', 'BAKE', 'FRY', 'BOIL', 'SWEET', 'SALTY', 'FRUIT', 'VEGETABLE', 'MEAT', 'BREAD', 'CAKE', 'PIZZA', 'SANDWICH', 'SOUP', 'SALAD', 'DESSERT',
      'WEATHER', 'SKY', 'STORM', 'WIND', 'RAIN', 'SNOW', 'SUN', 'MOON', 'STAR', 'CLOUD',
      'MUSIC', 'SOUND', 'SONG', 'MELODY', 'RHYTHM', 'BEAT', 'TUNE', 'HARMONY', 'CHORD', 'NOTE',
      'BODY', 'HUMAN', 'PHYSICAL', 'ORGAN', 'PART', 'HEAD', 'HAND', 'FOOT', 'EYE', 'EAR',
      'VEHICLE', 'TRAVEL', 'MOVE', 'RIDE', 'DRIVE', 'FLY', 'SAIL', 'WALK', 'RUN', 'JUMP',
      'TOOL', 'DEVICE', 'EQUIPMENT', 'MACHINE', 'INSTRUMENT', 'HAMMER', 'SAW', 'DRILL', 'SCREW', 'NAIL',
      'FURNITURE', 'CHAIR', 'TABLE', 'DECOR', 'ROOM', 'BED', 'SOFA', 'DESK', 'SHELF', 'CABINET',
      'ELECTRONIC', 'DIGITAL', 'TECH', 'DEVICE', 'GADGET', 'PHONE', 'COMPUTER', 'CAMERA', 'WATCH', 'CLOCK',
      'JEWELRY', 'ORNAMENT', 'DECORATION', 'ACCESSORY', 'RING', 'NECKLACE', 'BRACELET', 'EARRING', 'WATCH', 'CHARM',
      'GAME', 'TOY', 'PLAY', 'FUN', 'SPORT', 'BALL', 'BAT', 'STICK', 'CLUB', 'RACKET',
      'BUILDING', 'HOUSE', 'STRUCTURE', 'PLACE', 'HOME', 'CASTLE', 'PALACE', 'CHURCH', 'SCHOOL', 'HOSPITAL',
      'SPACE', 'STAR', 'PLANET', 'SKY', 'UNIVERSE', 'GALAXY', 'MOON', 'SUN', 'EARTH', 'MARS',
      'PLACE', 'LAND', 'EARTH', 'WORLD', 'COUNTRY', 'CITY', 'TOWN', 'VILLAGE', 'ISLAND', 'MOUNTAIN',
      
      // Simple descriptive words
      'BIG', 'SMALL', 'LONG', 'SHORT', 'TALL', 'WIDE', 'NARROW', 'THICK', 'THIN', 'ROUND',
      'SQUARE', 'TRIANGLE', 'CIRCLE', 'OVAL', 'STRAIGHT', 'CURVED', 'BENT', 'FLAT', 'SMOOTH', 'ROUGH',
      'HOT', 'COLD', 'WARM', 'COOL', 'WET', 'DRY', 'SOFT', 'HARD', 'HEAVY', 'LIGHT',
      'FAST', 'SLOW', 'QUICK', 'QUIET', 'LOUD', 'BRIGHT', 'DARK', 'CLEAN', 'DIRTY', 'NEW',
      'OLD', 'YOUNG', 'FRESH', 'STALE', 'SWEET', 'SOUR', 'SALTY', 'BITTER', 'SPICY', 'MILD',
      
      // Action words
      'RUN', 'WALK', 'JUMP', 'FLY', 'SWIM', 'DIVE', 'CLIMB', 'CRAWL', 'SIT', 'STAND',
      'LIE', 'SLEEP', 'WAKE', 'EAT', 'DRINK', 'COOK', 'BAKE', 'FRY', 'BOIL', 'STEAM',
      'CUT', 'CHOP', 'SLICE', 'DICE', 'MIX', 'STIR', 'POUR', 'SPILL', 'DROP', 'CATCH',
      'THROW', 'CATCH', 'HIT', 'MISS', 'WIN', 'LOSE', 'PLAY', 'WORK', 'REST', 'RELAX',
      
      // Time words
      'TIME', 'HOUR', 'MINUTE', 'SECOND', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'YEAR', 'MONTH',
      'WEEK', 'TODAY', 'YESTERDAY', 'TOMORROW', 'NOW', 'THEN', 'BEFORE', 'AFTER', 'EARLY', 'LATE',
      
      // Family words
      'FAMILY', 'MOTHER', 'FATHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER', 'BABY', 'CHILD', 'ADULT',
      'GRANDFATHER', 'GRANDMOTHER', 'UNCLE', 'AUNT', 'COUSIN', 'FRIEND', 'NEIGHBOR', 'TEACHER', 'STUDENT', 'DOCTOR',
      
      // Common objects
      'BOOK', 'PAPER', 'PEN', 'PENCIL', 'BRUSH', 'PAINT', 'PICTURE', 'PHOTO', 'FRAME', 'MIRROR',
      'WINDOW', 'DOOR', 'KEY', 'LOCK', 'HANDLE', 'KNOB', 'BUTTON', 'ZIPPER', 'BELT', 'BUCKLE',
      'BAG', 'BOX', 'BOTTLE', 'CAN', 'JAR', 'CUP', 'GLASS', 'PLATE', 'BOWL', 'SPOON',
      'FORK', 'KNIFE', 'CHOPSTICK', 'NAPKIN', 'TISSUE', 'TOWEL', 'SOAP', 'SHAMPOO', 'TOOTHBRUSH', 'COMB'
    ]);
    
    return realWords.has(word.toUpperCase());
  }

  wordMatchesClue(word, clue) {
    // Check if a word matches a clue (for safety checking)
    const wordUpper = word.toUpperCase();
    const clueUpper = clue.toUpperCase();
    
    // Direct match
    if (wordUpper === clueUpper) {
      console.log(`Direct match: "${word}" === "${clue}"`);
      return true;
    }
    
    // Contains match (either direction)
    if (wordUpper.includes(clueUpper) || clueUpper.includes(wordUpper)) {
      console.log(`Contains match: "${word}" contains "${clue}" or vice versa`);
      return true;
    }
    
    // Theme match
    const themes = this.getWordThemes();
    for (const [theme, words] of Object.entries(themes)) {
      if (theme === clueUpper && words.includes(wordUpper)) {
        console.log(`Theme match: "${word}" is in theme "${clue}"`);
        return true;
      }
    }
    
    // Semantic similarity (check if clue could relate to word)
    const semanticConnections = this.getSemanticConnections(wordUpper, clueUpper);
    if (semanticConnections) {
      console.log(`Semantic match: "${word}" relates to "${clue}" via ${semanticConnections}`);
      return true;
    }
    
    return false;
  }

  getSemanticConnections(word, clue) {
    // Check for semantic connections between word and clue
    const connections = {
      'ANIMAL': ['PET', 'CREATURE', 'BEAST', 'WILD', 'FAUNA'],
      'NATURE': ['EARTH', 'GREEN', 'OUTDOORS', 'NATURAL', 'LANDSCAPE'],
      'WATER': ['LIQUID', 'WET', 'DRINK', 'OCEAN', 'SWIM'],
      'FIRE': ['FLAME', 'HOT', 'BURN', 'RED', 'HEAT'],
      'LIGHT': ['BRIGHT', 'ILLUMINATION', 'ELECTRIC', 'SUN', 'LAMP'],
      'TIME': ['CLOCK', 'HOUR', 'MINUTE', 'WATCH', 'TEMPORAL'],
      'VEHICLE': ['CAR', 'DRIVE', 'ROAD', 'WHEEL', 'TRANSPORT'],
      'BUILDING': ['HOUSE', 'HOME', 'ROOF', 'WALL', 'STRUCTURE'],
      'FOOD': ['EAT', 'MEAL', 'TASTE', 'NUTRITION', 'DINNER'],
      'TOOL': ['INSTRUMENT', 'DEVICE', 'EQUIPMENT', 'APPARATUS', 'UTENSIL']
    };
    
    for (const [category, keywords] of Object.entries(connections)) {
      if (keywords.includes(clue)) {
        // Check if word belongs to this category
        const categoryWords = this.getWordThemes()[category] || [];
        if (categoryWords.includes(word)) {
          return category;
        }
      }
    }
    
    return null;
  }

  getWordThemes() {
    return {
      'ANIMALS': ['CAT', 'DOG', 'LION', 'BIRD', 'FISH', 'RABBIT', 'ELEPHANT', 'ZEBRA', 'KANGAROO', 'DOLPHIN', 'EAGLE', 'OCTOPUS'],
      'NATURE': ['TREE', 'SUN', 'MOON', 'OCEAN', 'WATER', 'MOUNTAIN', 'VOLCANO', 'RAINBOW', 'LIGHTHOUSE', 'ISLAND', 'WATERFALL'],
      'COLORS': ['YELLOW', 'XRAY'],
      'FOOD': ['APPLE', 'JUICE', 'ICE'],
      'WEATHER': ['HURRICANE', 'SUN', 'MOON'],
      'MUSIC': ['VIOLIN'],
      'BODY': ['NOSE', 'EAR', 'HAND', 'FOOT'],
      'TRANSPORT': ['CAR', 'AIRPLANE', 'BICYCLE', 'AIRCRAFT', 'BALLOON', 'ROCKET', 'YACHT'],
      'SPACE': ['SUN', 'MOON', 'GALAXY', 'UNIVERSE', 'SATELLITE', 'TELESCOPE', 'ASTRONAUT', 'JUPITER', 'NEPTUNE', 'METEORITE', 'QUASAR'],
      'BUILDINGS': ['CASTLE', 'PALACE', 'BRIDGE', 'LIGHTHOUSE', 'CATHEDRAL', 'PYRAMID', 'HOUSE', 'IGLOO'],
      'TOOLS': ['PEN', 'KEY', 'LOCK', 'COMPASS', 'BINOCULARS', 'MICROSCOPE', 'STETHOSCOPE', 'GYROSCOPE', 'ENDOSCOPE', 'RADIOSCOPE', 'SPECTROSCOPE', 'PERISCOPE', 'KALEIDOSCOPE'],
      'FURNITURE': ['CHAIR', 'TABLE', 'LAMP', 'CLOCK', 'MIRROR', 'WINDOW', 'DOOR'],
      'ELECTRONICS': ['PHONE', 'WATCH', 'COMPUTER', 'TELEVISION', 'CAMERA'],
      'JEWELRY': ['RING', 'NECKLACE', 'JEWEL', 'DIAMOND', 'QUARTZ'],
      'GAMES': ['BALL', 'KITE', 'GAME', 'DANCE'],
      'INSTRUMENTS': ['VIOLIN', 'UMBRELLA'],
      'READING': ['BOOK', 'MAGAZINE', 'NEWSPAPER', 'PICTURE'],
      'CLOTHING': ['HELMET', 'WATCH'],
      'GEOGRAPHY': ['GLOBE', 'ISLAND', 'MOUNTAIN', 'VOLCANO', 'OCEAN', 'WATERFALL']
    };
  }

  findConnection(word1, word2) {
    // Simple connection finding - look for common themes, sounds, etc.
    const commonThemes = {
      'ANIMALS': ['CAT', 'DOG', 'LION', 'BIRD', 'FISH', 'RABBIT', 'ELEPHANT', 'ZEBRA'],
      'NATURE': ['TREE', 'SUN', 'MOON', 'OCEAN', 'WATER', 'NATURE'],
      'COLORS': ['RED', 'BLUE', 'GREEN', 'YELLOW', 'BLACK', 'WHITE'],
      'FOOD': ['APPLE', 'JUICE', 'BALL'],
      'WEATHER': ['RAIN', 'SNOW', 'WIND', 'SUN', 'MOON'],
      'MUSIC': ['SONG', 'MUSIC', 'VIOLIN', 'DANCE'],
      'BODY': ['NOSE', 'EAR', 'HAND', 'FOOT', 'EYE'],
      'TRANSPORT': ['CAR', 'BIKE', 'PLANE', 'TRAIN', 'BOAT']
    };

    for (const [theme, words] of Object.entries(commonThemes)) {
      if (words.includes(word1.toUpperCase()) && words.includes(word2.toUpperCase())) {
        return theme;
      }
    }

    // Look for phonetic similarities
    if (this.soundsSimilar(word1, word2)) {
      return word1; // Use one of the words as the clue
    }

    return null;
  }

  soundsSimilar(word1, word2) {
    // Very basic phonetic similarity check
    const vowels1 = word1.replace(/[^AEIOU]/g, '');
    const vowels2 = word2.replace(/[^AEIOU]/g, '');
    return vowels1 === vowels2 && Math.abs(word1.length - word2.length) <= 2;
  }

  // LLM-powered clue generation
  async generateLLMClue() {
    if (!llmClient) {
      console.log('LLM client not available, falling back to rule-based system');
      return null;
    }

    try {
      console.log(`\n=== LLM SPYMASTER GENERATING CLUE FOR ${this.currentTeam.toUpperCase()} TEAM ===`);
      
      // Prepare the game state for the LLM
      const unrevealedWords = this.words
        .map((word, index) => ({ word, index, type: this.agentCards[index] }))
        .filter((_, index) => !this.revealedWords.has(index));

      const teamWords = unrevealedWords.filter(w => w.type === this.currentTeam);
      const enemyWords = unrevealedWords.filter(w => w.type !== this.currentTeam && w.type !== 'neutral' && w.type !== 'assassin');
      const neutralWords = unrevealedWords.filter(w => w.type === 'neutral');
      const assassinWords = unrevealedWords.filter(w => w.type === 'assassin');

      if (teamWords.length === 0) {
        console.log('No team words left - LLM will suggest PASS');
        return { clue: 'PASS', number: 0 };
      }

      // Create the prompt for the LLM
      const prompt = this.createLLMPrompt(teamWords, enemyWords, neutralWords, assassinWords);

      console.log('\n=== LLM PROMPT ===');
      console.log(prompt);
      console.log('=== END PROMPT ===\n');
      
      console.log('Sending prompt to LLM...');
      const response = await llmClient.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: [
          {
            role: "system",
            content: "You are an expert Bytenames spymaster. You must provide clues that are exactly ONE WORD and help your team identify their words while avoiding enemy, neutral, and assassin words. CRITICAL: Your clue must ONLY connect to your team's words - consider ALL possible interpretations and associations. If ANY interpretation could lead to a dangerous word, choose a different clue or PASS."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: LLM_CONFIG.temperature,
        max_tokens: LLM_CONFIG.maxTokens
      });

      const llmResponse = response.choices[0].message.content.trim();
      console.log('LLM response:', llmResponse);

      // Parse the LLM response
      const parsedClue = this.parseLLMResponse(llmResponse, teamWords);
      
      if (parsedClue) {
        console.log(`✅ LLM generated clue: "${parsedClue.clue}" for ${parsedClue.number} words`);
        // Track this clue as used
        this.previousClues.push(parsedClue.clue);
        
        // Add to clue history
        this.clueHistory.push({
          team: this.currentTeam,
          clue: parsedClue.clue,
          number: parsedClue.number,
          targetWords: parsedClue.targetWords || []
        });
        
        return parsedClue;
      } else {
        console.log('Failed to parse LLM response, falling back to rule-based system');
        return null;
      }

    } catch (error) {
      console.log('LLM API error:', error.message);
      console.log('Falling back to rule-based system');
      return null;
    }
  }

  createLLMPrompt(teamWords, enemyWords, neutralWords, assassinWords) {
    // Safety checks to ensure all parameters are arrays
    const safeTeamWords = Array.isArray(teamWords) ? teamWords : [];
    const safeEnemyWords = Array.isArray(enemyWords) ? enemyWords : [];
    const safeNeutralWords = Array.isArray(neutralWords) ? neutralWords : [];
    const safeAssassinWords = Array.isArray(assassinWords) ? assassinWords : [];
    
    const teamWordList = safeTeamWords.map(w => w.word).join(', ');
    const enemyWordList = safeEnemyWords.map(w => w.word).join(', ');
    const neutralWordList = safeNeutralWords.map(w => w.word).join(', ');
    const assassinWordList = safeAssassinWords.map(w => w.word).join(', ');
    
    // Get previously used clues
    const usedClues = this.previousClues || [];
    const usedCluesList = usedClues.length > 0 ? usedClues.join(', ') : 'None yet';

    return `You are playing Bytenames as the ${this.currentTeam.toUpperCase()} team spymaster.

YOUR TEAM'S WORDS (you want your team to guess these): ${teamWordList}

ENEMY TEAM'S WORDS (CRITICAL - avoid these completely, they belong to the other team): ${enemyWordList}

NEUTRAL WORDS (CRITICAL - avoid these at all costs, they end a turn): ${neutralWordList}

ASSASSIN WORDS (CRITICAL - avoid these at all costs, they end the game): ${assassinWordList}

PREVIOUSLY USED CLUES (do not reuse these): ${usedCluesList}

CRITICAL SAFETY RULES:
1. Your clue must ONLY connect to YOUR TEAM'S WORDS
2. Your clue must NOT connect to ANY enemy, neutral, or assassin words
3. ENEMY WORDS are as dangerous as ASSASSIN WORDS - avoid them completely
4. Think of ALL possible interpretations of your clue - if ANY interpretation could lead to a dangerous word, DON'T use that clue
5. Consider indirect connections, associations, and common phrases
6. NEVER reuse a clue that has been used before in this game
7. If unsure, choose a safer, more specific clue
8. Your clue cannot be the word itself it must describe the word

BEFORE GIVING YOUR CLUE, ANALYZE:
- What words could your clue connect to?
- Are ALL those words in YOUR TEAM'S WORDS list?
- Could your clue be interpreted differently?
- Are there any indirect associations that could lead to dangerous words?
- Have I used this clue before in this game?
- Does this clue avoid ALL enemy words (treat them as dangerous as assassin)?

EXAMPLES OF DANGEROUS CLUES TO AVOID:
- "SUMMER" could connect to "GRILLING" (summer barbecues) - DON'T use if GRILLING is dangerous
- "WATER" could connect to "OCEAN", "RIVER", "SWIM" - check all these words
- "ANIMAL" could connect to "PET", "WILD", "FUR" - check all these words
- "FOOD" could connect to "COOK", "EAT", "MEAL" - check all these words

RULES:
1. Give exactly ONE WORD as your clue
2. The clue should help your team identify as many of YOUR TEAM'S WORDS as possible
3. NEVER give a clue that could lead to enemy, neutral, or assassin words
4. After your clue, specify how many words it rationally connects to, do not include words that are not clearly related to the clue for normal human understanding.
5. List the specific words your clue connects to
6. Do your best to give clues that are not overly vague. If a clue relates to a word but the relation is not likely to be guessed, consider reducing the number of words it connects to.

Final safety check:
Does this clue connect only to my teams words, and to no enemy, neutral, or assassin words under any interpretation? If the answer is no, start over. Clue can not be Pass, give a clue for at least one word.

RESPONSE FORMAT: "CLUE NUMBER: WORD1, WORD2, WORD3"
Example: "ANIMAL 2: CAT, DOG" means the clue "ANIMAL" connects to 2 words: CAT and DOG
Example: "NATURE 3: TREE, OCEAN, MOUNTAIN" means the clue "NATURE" connects to 3 words: TREE, OCEAN, and MOUNTAIN

Your clue:`;
  }

  parseLLMResponse(response, teamWords) {
    try {
      // Clean up the response
      const cleanResponse = response.replace(/['"]/g, '').trim();
      
      // Check for PASS response
      if (cleanResponse.toUpperCase().startsWith('PASS')) {
        const passParts = cleanResponse.split(/\s+/);
        const number = parseInt(passParts[1]) || 0;
        console.log('🤖 LLM chose to PASS');
        return { clue: 'PASS', number, targetWords: [] };
      }
      
      // Look for format: "CLUE NUMBER: WORD1, WORD2, WORD3"
      const colonIndex = cleanResponse.indexOf(':');
      if (colonIndex !== -1) {
        const beforeColon = cleanResponse.substring(0, colonIndex).trim();
        const afterColon = cleanResponse.substring(colonIndex + 1).trim();
        
        const beforeParts = beforeColon.split(/\s+/);
        if (beforeParts.length >= 2) {
          const clue = beforeParts[0].toUpperCase();
          const number = parseInt(beforeParts[1]);
          
          if (isNaN(number) || number < 0) {
            console.log(`Invalid number in LLM response: "${response}" - number must be 0 or positive, got: ${number}`);
            return null;
          }
          
          // Parse target words
          const targetWords = afterColon.split(',').map(word => word.trim().toUpperCase()).filter(word => word.length > 0);
          
          // Validate that the clue is a single word
          if (clue.includes(' ') || clue.includes('-')) {
            console.log('Clue contains spaces or hyphens:', clue);
            return null;
          }
          
          console.log(`🎯 LLM target words for "${clue}":`, targetWords);
          return { clue, number, targetWords };
        }
      }
      
      // Fallback to old format: "CLUE NUMBER"
      const parts = cleanResponse.split(/\s+/);
      
      if (parts.length < 2) {
        console.log('Invalid LLM response format:', response);
        return null;
      }

      const clue = parts[0].toUpperCase();
      const number = parseInt(parts[1]);

      if (isNaN(number) || number < 0) {
        console.log(`Invalid number in LLM response: "${response}" - number must be 0 or positive, got: ${number}`);
        return null;
      }

      // Validate that the clue is a single word
      if (clue.includes(' ') || clue.includes('-')) {
        console.log('Clue contains spaces or hyphens:', clue);
        return null;
      }

      console.log(`🎯 LLM clue "${clue}" for ${number} words (no specific targets provided)`);
      return { clue, number, targetWords: [] };
    } catch (error) {
      console.log('Error parsing LLM response:', error.message);
      return null;
    }
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async (data) => {
    const { roomId, playerName, role } = data;
    
    if (!games.has(roomId)) {
      console.log(`Creating new game for room ${roomId}...`);
      const game = await BytenamesGame.create(roomId);
      games.set(roomId, game);
      console.log(`✅ Game created with ${game.words.length} words`);
    }
    
    const game = games.get(roomId);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerName = playerName;
    socket.role = role;
    
    // Send current game state
    socket.emit('game-state', {
      words: game.words,
      agentCards: game.agentCards,
      revealedWords: Array.from(game.revealedWords),
      currentTeam: game.currentTeam,
      gamePhase: game.gamePhase,
      redScore: game.redScore,
      blueScore: game.blueScore,
      redRemaining: game.redRemaining,
      blueRemaining: game.blueRemaining,
      clueHistory: game.clueHistory,
      currentClue: game.currentClue,
      guessesRemaining: game.guessesRemaining
    });
    
    // Notify others in room
    socket.to(roomId).emit('player-joined', { playerName, role });
  });

  socket.on('start-game', async (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    
    if (game) {
      game.gamePhase = 'playing';
      const aiClue = await game.generateAIClue();
      game.currentClue = aiClue;
      game.guessesRemaining = aiClue.number + 1; // +1 for the clue word itself
      
      io.to(roomId).emit('game-started', {
        currentTeam: game.currentTeam,
        clue: aiClue,
        guessesRemaining: game.guessesRemaining,
        clueHistory: game.clueHistory
      });
    }
  });

  socket.on('make-guess', async (data) => {
    const { roomId, wordIndex } = data;
    const game = games.get(roomId);
    
    if (game) {
      const result = game.makeGuess(wordIndex);
      
      if (result.success) {
        io.to(roomId).emit('guess-result', {
          wordIndex,
          cardType: result.cardType,
          revealedWords: Array.from(game.revealedWords),
          currentTeam: game.currentTeam,
          redScore: game.redScore,
          blueScore: game.blueScore,
          redRemaining: game.redRemaining,
          blueRemaining: game.blueRemaining,
          guessesRemaining: game.guessesRemaining,
          gameOver: result.gameOver,
          winner: result.winner,
          switchTeams: result.switchTeams,
          continueGuessing: result.continueGuessing,
          clueHistory: result.gameOver ? game.clueHistory : undefined,
          allCards: result.gameOver ? game.words.map((word, index) => ({
            word,
            type: game.agentCards[index]
          })) : undefined
        });

        // If teams switched, generate new AI clue
        if (result.switchTeams && !result.gameOver) {
          const aiClue = await game.generateAIClue();
          game.currentClue = aiClue;
          game.guessesRemaining = aiClue.number + 1;
          
          io.to(roomId).emit('new-clue', {
            clue: aiClue,
            currentTeam: game.currentTeam,
            guessesRemaining: game.guessesRemaining,
            clueHistory: game.clueHistory
          });
        }
      } else {
        socket.emit('guess-error', { message: result.message });
      }
    }
  });

  socket.on('end-turn', async (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    
    if (game) {
      // Switch teams
      game.currentTeam = game.currentTeam === 'red' ? 'blue' : 'red';
      
      // Generate new AI clue for the new team
      const aiClue = await game.generateAIClue();
      game.currentClue = aiClue;
      game.guessesRemaining = aiClue.number + 1;
      
      io.to(roomId).emit('turn-ended', {
        currentTeam: game.currentTeam,
        clue: aiClue,
        guessesRemaining: game.guessesRemaining,
        clueHistory: game.clueHistory
      });
    }
  });

  socket.on('play-again', async (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    
    if (game) {
      // Reset game state but keep teams
      console.log('🔄 Resetting game with new words...');
      game.words = await game.generateWordGrid();
      game.agentCards = game.generateAgentCards();
      game.currentTeam = 'red'; // red starts first
      game.gamePhase = 'waiting';
      game.revealedWords = new Set();
      game.redScore = 0;
      game.blueScore = 0;
      game.redRemaining = 9;
      game.blueRemaining = 8;
      game.currentClue = null;
      game.guessesRemaining = 0;
      game.assassinRevealed = false;
      game.previousClues = []; // Reset clue tracking for new game
      game.clueHistory = []; // Reset clue history for new game
      
      io.to(roomId).emit('game-reset', {
        words: game.words,
        agentCards: game.agentCards,
        currentTeam: game.currentTeam,
        gamePhase: game.gamePhase,
        redScore: game.redScore,
        blueScore: game.blueScore,
        redRemaining: game.redRemaining,
        blueRemaining: game.blueRemaining
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
