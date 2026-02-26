// ═══════════════════════════════════════════════════════════
// Word Bank — Categorized word lists for Pictionary
// ═══════════════════════════════════════════════════════════

export interface WordCategory {
    key: string;
    label: string;
    emoji: string;
    words: string[];
}

export const WORD_CATEGORIES: WordCategory[] = [
    {
        key: 'animals',
        label: 'Animals',
        emoji: '🐾',
        words: [
            'elephant', 'penguin', 'giraffe', 'octopus', 'kangaroo',
            'dolphin', 'butterfly', 'chameleon', 'flamingo', 'hedgehog',
            'peacock', 'jellyfish', 'sloth', 'panda', 'lobster',
            'parrot', 'seahorse', 'gorilla', 'koala', 'crocodile',
            'owl', 'shark', 'turtle', 'zebra', 'bat',
            'spider', 'snail', 'eagle', 'fox', 'whale',
        ],
    },
    {
        key: 'movies',
        label: 'Movies & TV',
        emoji: '🎬',
        words: [
            'superhero', 'spaceship', 'dinosaur', 'wizard', 'pirate',
            'zombie', 'alien', 'robot', 'detective', 'mermaid',
            'vampire', 'cowboy', 'ninja', 'gladiator', 'astronaut',
            'monster', 'treasure', 'castle', 'jungle', 'volcano',
            'submarine', 'time machine', 'haunted house', 'lightsaber', 'magic carpet',
            'popcorn', 'red carpet', 'spotlight', 'clapper board', 'costume',
        ],
    },
    {
        key: 'actions',
        label: 'Actions',
        emoji: '🏃',
        words: [
            'swimming', 'juggling', 'skydiving', 'cooking', 'dancing',
            'surfing', 'painting', 'fishing', 'sneezing', 'yawning',
            'climbing', 'skateboarding', 'bowling', 'singing', 'gardening',
            'sleeping', 'running', 'laughing', 'diving', 'boxing',
            'skiing', 'rowing', 'knitting', 'meditating', 'wrestling',
            'typing', 'waving', 'stretching', 'hiking', 'jumping',
        ],
    },
    {
        key: 'objects',
        label: 'Objects',
        emoji: '🎯',
        words: [
            'umbrella', 'telescope', 'bicycle', 'headphones', 'candle',
            'scissors', 'backpack', 'compass', 'microphone', 'hourglass',
            'anchor', 'balloon', 'camera', 'diamond', 'envelope',
            'flashlight', 'guitar', 'hammer', 'igloo', 'jigsaw',
            'kite', 'ladder', 'magnifying glass', 'notebook', 'parachute',
            'quill', 'rocket', 'stopwatch', 'trophy', 'windmill',
        ],
    },
    {
        key: 'food',
        label: 'Food & Drink',
        emoji: '🍕',
        words: [
            'pizza', 'sushi', 'hamburger', 'ice cream', 'pancake',
            'tacos', 'spaghetti', 'cupcake', 'watermelon', 'pretzel',
            'burrito', 'donut', 'lobster', 'pineapple', 'waffle',
            'smoothie', 'popcorn', 'sandwich', 'chocolate', 'cherry pie',
            'milkshake', 'hot dog', 'croissant', 'avocado', 'dumpling',
            'fortune cookie', 'gingerbread', 'nachos', 'ramen', 'strawberry',
        ],
    },
    {
        key: 'places',
        label: 'Places',
        emoji: '🌍',
        words: [
            'beach', 'mountain', 'library', 'hospital', 'airport',
            'museum', 'lighthouse', 'playground', 'stadium', 'temple',
            'waterfall', 'desert', 'island', 'cave', 'bridge',
            'castle', 'farm', 'forest', 'galaxy', 'harbor',
            'iceberg', 'jungle', 'kingdom', 'lagoon', 'maze',
            'oasis', 'pyramid', 'reef', 'swamp', 'volcano',
        ],
    },
    {
        key: 'professions',
        label: 'Professions',
        emoji: '👷',
        words: [
            'firefighter', 'astronaut', 'chef', 'detective', 'pilot',
            'surgeon', 'magician', 'lifeguard', 'archaeologist', 'conductor',
            'blacksmith', 'carpenter', 'dentist', 'electrician', 'farmer',
            'goalkeeper', 'jeweler', 'mechanic', 'plumber', 'scientist',
            'teacher', 'veterinarian', 'waiter', 'zookeeper', 'clown',
            'ballerina', 'drummer', 'judge', 'knight', 'sailor',
        ],
    },
];

/** Get words for a category (or mixed from all) */
export function getWordsForCategory(categoryKey: string): string[] {
    if (categoryKey === 'mixed') {
        return WORD_CATEGORIES.flatMap((cat) => cat.words);
    }
    const category = WORD_CATEGORIES.find((cat) => cat.key === categoryKey);
    return category ? category.words : getWordsForCategory('mixed');
}

/** Pick N random unique words from a category */
export function pickRandomWords(categoryKey: string, count: number): string[] {
    const pool = [...getWordsForCategory(categoryKey)];
    const picks: string[] = [];

    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
    }

    return picks;
}

/** Generate a word hint string: "_ _ _ _ _" for a word */
export function generateHint(word: string): string {
    return word
        .split('')
        .map((ch) => (ch === ' ' ? '  ' : '_'))
        .join(' ');
}

/** Progressively reveal letters in a hint */
export function revealLetter(word: string, currentHint: string): string {
    const hintChars = currentHint.split(' ');
    const wordChars = word.split('');

    // Find unrevealed positions (where hint is '_')
    const hidden: number[] = [];
    let hintIdx = 0;
    for (let i = 0; i < wordChars.length; i++) {
        if (wordChars[i] === ' ') {
            hintIdx++; // skip double space
            continue;
        }
        if (hintChars[hintIdx] === '_') {
            hidden.push(i);
        }
        hintIdx++;
    }

    if (hidden.length === 0) return currentHint;

    // Reveal one random letter
    const revealIdx = hidden[Math.floor(Math.random() * hidden.length)];
    hintIdx = 0;
    for (let i = 0; i < wordChars.length; i++) {
        if (wordChars[i] === ' ') {
            hintIdx++;
            continue;
        }
        if (i === revealIdx) {
            hintChars[hintIdx] = wordChars[i];
            break;
        }
        hintIdx++;
    }

    return hintChars.join(' ');
}
