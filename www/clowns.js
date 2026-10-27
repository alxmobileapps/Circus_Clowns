/* =====================================================================
 * CIRCUS CLOWN — CLOWN LIST (edit this file to add or change clowns)
 * =====================================================================
 * Every clown in the Clown Shop comes from this list. For each one you can set:
 *
 *   id        unique short name, no spaces           e.g. 'sunny'
 *   name      what players see                        e.g. 'Sunny'
 *   price     coins needed (1 coin per point). 0 = free / starter clown
 *             (same as Circus Dogs: Giggles is free, the next 29 clowns start at 100 and each costs 20 more than the one
 *             before (up to 660); the last 5 special clowns each cost 50 more than the one before (710 to 910))
 *   look      how the drawn clown looks (suit, wig, hat, make-up ...)
 *   voice     pitch of the fallback "oops" sound and of the sad-trombone cry
 *   juggle    what the clown juggles: 'balls' | 'pins' | 'rings' | 'apples' | 'stars' | 'eggs' | 'pies' | 'hats' |
 *             'flowers' | 'bananas' | 'cupcakes' | 'plates' | 'ducks' | 'donuts' | 'fish' | 'crystal' | 'teacups' |
 *             'socks' | 'dice' | 'lollipops' | 'carrots' | 'bubbles' | 'none' (pretend juggling, for the mime)
 *   files     OPTIONAL real files that REPLACE the built-in ones:
 *               oops:     'sounds/oops-sunny.wav'   (the "Ooops!" played on every jump)
 *               cry:      'sounds/sunny-cry.mp3'    (played on game over)
 *               gameOver: 'images/sunny-cry.png'    (picture on the Game Over card,
 *                                                    square PNG, transparent background works best)
 *             Put the files in the www/sounds and www/images folders.
 *             If a file is missing or fails to load, the built-in version is used.
 *
 * look options
 *   suit     main suit colour            suit2   pattern colour
 *   pattern  'dots' | 'stripes' | 'hstripes' | 'diamond' | 'check' | 'stars' | 'half' | 'confetti' | 'patch' | 'plain'
 *   pants    trouser colour (null = suit)        pompom  colour of the 3 pompom buttons (null = none)
 *   collar   ruffle collar colour         ruff    collar size (1 = normal)
 *   glove    glove colour                 shoes   shoe colour
 *   face     'white' (white face paint) | 'skin' (auguste: skin colour with white mouth and eyes)
 *   skin     skin colour for 'skin' faces
 *   nose     nose colour or null (no red nose)
 *   mouth    painted mouth colour         eyes    'arch' | 'cross' | 'star' | 'tear' | 'diamond' | 'none'
 *   eyeCol   eye make-up colour           cheeks  cheek colour or null
 *   stubble  beard-stubble colour or null (hobo clown)
 *   wig      'afro' | 'sides' | 'curly' | 'spiky' | 'long' | 'none'      wigCol  wig colour
 *   hat      'cone' | 'top' | 'tiny' | 'bowler' | 'jester' | 'propeller' | 'flower' | 'cap' | 'beret' | 'none'
 *   hatCol   hat colour                   hat2    second hat colour (band, pompom, flower ...)
 *   bow      bow-tie colour or null
 *
 * voice options (built-in sounds)
 *   pitch    1 = normal, higher = squeakier, lower = deeper (used only if the oops file is missing)
 *   cryPitch 1 = normal sad trombone, lower = deeper
 * ===================================================================== */
window.CIRCUS_CLOWNS = [
  { id: 'giggles', name: 'Giggles', price: 0,
    look: { juggle: 'balls', suit: '#e5262f', suit2: '#ffd23a', pattern: 'dots', collar: '#ffffff', shoes: '#2a7de1', pompom: '#ffffff', wig: 'afro', wigCol: '#ff7a1a', hat: 'cone', hatCol: '#2a7de1', hat2: '#ffd23a', eyes: 'arch', eyeCol: '#2a7de1' },
    voice: { pitch: 1, cryPitch: 1 }, files: { oops: 'sounds/oops-giggles.wav', cry: null, gameOver: null } },
  { id: 'sunny', name: 'Sunny', price: 100,
    look: { juggle: 'bananas', suit: '#ffd23a', suit2: '#ff8a1a', pattern: 'stripes', collar: '#ffffff', shoes: '#e5262f', pompom: '#e5262f', wig: 'afro', wigCol: '#e5262f', hat: 'tiny', hatCol: '#2a2a2a', hat2: '#ffd23a', eyes: 'cross', eyeCol: '#2a7de1' },
    voice: { pitch: 1.1, cryPitch: 1.05 }, files: { oops: 'sounds/oops-sunny.wav', cry: null, gameOver: null } },
  { id: 'bubbles', name: 'Bubbles', price: 120,
    look: { juggle: 'bubbles', suit: '#7ec8f0', suit2: '#ffffff', pattern: 'dots', collar: '#ff6ab2', shoes: '#ff6ab2', pompom: '#ff6ab2', wig: 'curly', wigCol: '#ff6ab2', hat: 'bowler', hatCol: '#ff6ab2', hat2: '#ffffff', eyes: 'star', eyeCol: '#ff6ab2' },
    voice: { pitch: 1.3, cryPitch: 1.2 }, files: { oops: 'sounds/oops-bubbles.wav', cry: null, gameOver: null } },
  { id: 'domino', name: 'Domino', price: 140,
    look: { juggle: 'rings', suit: '#ffffff', suit2: '#1b1113', pattern: 'plain', collar: '#ffffff', shoes: '#1b1113', pompom: '#1b1113', glove: '#ffffff', nose: null, mouth: '#c4162f', wig: 'none', hat: 'cap', hatCol: '#1b1113', eyes: 'tear', eyeCol: '#1b1113', cheeks: null },
    voice: { pitch: 0.9, cryPitch: 0.9 }, files: { oops: 'sounds/oops-domino.wav', cry: null, gameOver: null } },
  { id: 'patches', name: 'Patches', price: 160,
    look: { juggle: 'socks', suit: '#6b5a3a', suit2: '#9a7a4a', pattern: 'patch', pants: '#4a4036', collar: null, shoes: '#3a2a1a', face: 'skin', skin: '#f0c49a', stubble: '#5a5060', mouth: '#ffffff', wig: 'sides', wigCol: '#5a3a20', hat: 'top', hatCol: '#3a3030', hat2: '#6b5a3a', eyes: 'none', bow: '#e5262f' },
    voice: { pitch: 0.8, cryPitch: 0.8 }, files: { oops: 'sounds/oops-patches.wav', cry: null, gameOver: null } },
  { id: 'harlequin', name: 'Harlequin', price: 180,
    look: { juggle: 'pins', suit: '#2f9e5b', suit2: '#e5262f', pattern: 'diamond', collar: '#ffd23a', shoes: '#e5262f', wig: 'none', hat: 'jester', hatCol: '#2f9e5b', hat2: '#e5262f', eyes: 'diamond', eyeCol: '#1b1113' },
    voice: { pitch: 1, cryPitch: 1 }, files: { oops: 'sounds/oops-harlequin.wav', cry: null, gameOver: null } },
  { id: 'jester', name: 'Jester', price: 200,
    look: { juggle: 'stars', suit: '#7a2be2', suit2: '#ffd23a', pattern: 'half', collar: '#ffffff', shoes: '#ffd23a', wig: 'none', hat: 'jester', hatCol: '#7a2be2', hat2: '#ffd23a', eyes: 'star', eyeCol: '#7a2be2' },
    voice: { pitch: 1.15, cryPitch: 1.1 }, files: { oops: 'sounds/oops-jester.wav', cry: null, gameOver: null } },
  { id: 'confetti', name: 'Confetti', price: 220,
    look: { juggle: 'donuts', suit: '#ffffff', suit2: '#e5262f', pattern: 'confetti', collar: '#ffd23a', shoes: '#2a7de1', pompom: '#2f9e5b', wig: 'afro', wigCol: '#2a7de1', hat: 'cone', hatCol: '#e5262f', hat2: '#ffffff', eyes: 'arch', eyeCol: '#e5262f' },
    voice: { pitch: 1.2, cryPitch: 1.1 }, files: { oops: 'sounds/oops-confetti.wav', cry: null, gameOver: null } },
  { id: 'noodle', name: 'Noodle', price: 240,
    look: { juggle: 'carrots', suit: '#2f9e5b', suit2: '#bff58a', pattern: 'stripes', collar: '#ffffff', shoes: '#ffd23a', pompom: '#ffd23a', wig: 'spiky', wigCol: '#ffd23a', hat: 'propeller', hatCol: '#e5262f', hat2: '#2a7de1', eyes: 'cross', eyeCol: '#2f9e5b' },
    voice: { pitch: 1.25, cryPitch: 1.2 }, files: { oops: 'sounds/oops-noodle.wav', cry: null, gameOver: null } },
  { id: 'popcorn', name: 'Popcorn', price: 260,
    look: { juggle: 'cupcakes', suit: '#fff3c4', suit2: '#e5262f', pattern: 'hstripes', collar: '#e5262f', shoes: '#e5262f', pompom: '#ffd23a', wig: 'curly', wigCol: '#ffd23a', hat: 'tiny', hatCol: '#e5262f', hat2: '#ffffff', eyes: 'arch', eyeCol: '#e5262f' },
    voice: { pitch: 1.05, cryPitch: 1 }, files: { oops: 'sounds/oops-popcorn.wav', cry: null, gameOver: null } },
  { id: 'jellybean', name: 'Jellybean', price: 280,
    look: { juggle: 'lollipops', suit: '#ff6ab2', suit2: '#7ec8f0', pattern: 'dots', collar: '#ffffff', shoes: '#7a2be2', pompom: '#7ec8f0', wig: 'afro', wigCol: '#7ef0c8', hat: 'bowler', hatCol: '#7a2be2', hat2: '#ff6ab2', eyes: 'star', eyeCol: '#7a2be2' },
    voice: { pitch: 1.35, cryPitch: 1.25 }, files: { oops: 'sounds/oops-jellybean.wav', cry: null, gameOver: null } },
  { id: 'ziggy', name: 'Ziggy', price: 300,
    look: { juggle: 'dice', suit: '#1b1b2a', suit2: '#ffd23a', pattern: 'stars', collar: '#ffd23a', shoes: '#ffd23a', wig: 'spiky', wigCol: '#7ec8f0', hat: 'none', eyes: 'star', eyeCol: '#ffd23a', mouth: '#2a7de1' },
    voice: { pitch: 0.95, cryPitch: 0.95 }, files: { oops: 'sounds/oops-ziggy.wav', cry: null, gameOver: null } },
  { id: 'pickles', name: 'Pickles', price: 320,
    look: { juggle: 'fish', suit: '#8bc34a', suit2: '#4e7a22', pattern: 'check', collar: '#ffffff', shoes: '#e5262f', pompom: '#e5262f', wig: 'sides', wigCol: '#e5262f', hat: 'flower', hatCol: '#2a2a2a', hat2: '#ff6ab2', eyes: 'cross', eyeCol: '#2a2a2a', bow: '#ffd23a' },
    voice: { pitch: 0.9, cryPitch: 0.9 }, files: { oops: 'sounds/oops-pickles.wav', cry: null, gameOver: null } },
  { id: 'lollipop', name: 'Lollipop', price: 340,
    look: { juggle: 'flowers', suit: '#ff8ad8', suit2: '#ffffff', pattern: 'hstripes', collar: '#9b5de5', shoes: '#9b5de5', pompom: '#ffffff', wig: 'long', wigCol: '#9b5de5', hat: 'flower', hatCol: '#9b5de5', hat2: '#ffd23a', eyes: 'arch', eyeCol: '#9b5de5' },
    voice: { pitch: 1.4, cryPitch: 1.3 }, files: { oops: 'sounds/oops-lollipop.wav', cry: null, gameOver: null } },
  { id: 'rascal', name: 'Rascal', price: 360,
    look: { juggle: 'eggs', suit: '#2a7de1', suit2: '#ffd23a', pattern: 'check', collar: '#ffffff', shoes: '#e5262f', pompom: '#e5262f', wig: 'afro', wigCol: '#ffd23a', hat: 'cone', hatCol: '#e5262f', hat2: '#ffd23a', eyes: 'cross', eyeCol: '#e5262f' },
    voice: { pitch: 1.1, cryPitch: 1.05 }, files: { oops: 'sounds/oops-rascal.wav', cry: null, gameOver: null } },
  { id: 'coco', name: 'Coco', price: 380,
    look: { juggle: 'apples', suit: '#8a5a2b', suit2: '#f3e3c3', pattern: 'dots', collar: '#ffd23a', shoes: '#2f9e5b', pompom: '#ffd23a', face: 'skin', skin: '#a86a3e', wig: 'curly', wigCol: '#2a1810', hat: 'tiny', hatCol: '#2f9e5b', hat2: '#ffd23a', eyes: 'arch', eyeCol: '#2f9e5b' },
    voice: { pitch: 1, cryPitch: 1 }, files: { oops: 'sounds/oops-coco.wav', cry: null, gameOver: null } },
  { id: 'biscuit', name: 'Biscuit', price: 400,
    look: { juggle: 'hats', suit: '#f2a541', suit2: '#8a4a1a', pattern: 'hstripes', collar: '#ffffff', shoes: '#8a4a1a', pompom: '#ffffff', face: 'skin', skin: '#f0c49a', wig: 'sides', wigCol: '#f4f4f4', hat: 'tiny', hatCol: '#2a7de1', hat2: '#ffffff', eyes: 'none', bow: '#2a7de1' },
    voice: { pitch: 0.85, cryPitch: 0.85 }, files: { oops: 'sounds/oops-biscuit.wav', cry: null, gameOver: null } },
  { id: 'marbles', name: 'Marbles', price: 420,
    look: { juggle: 'crystal', suit: '#9b5de5', suit2: '#ffd23a', pattern: 'confetti', collar: '#ffffff', shoes: '#2f9e5b', pompom: '#2f9e5b', wig: 'afro', wigCol: '#2f9e5b', hat: 'top', hatCol: '#ffd23a', hat2: '#9b5de5', eyes: 'diamond', eyeCol: '#9b5de5' },
    voice: { pitch: 1.05, cryPitch: 1 }, files: { oops: 'sounds/oops-marbles.wav', cry: null, gameOver: null } },
  { id: 'twinkle', name: 'Twinkle', price: 440,
    look: { juggle: 'stars', suit: '#0d2b5c', suit2: '#ffffff', pattern: 'stars', collar: '#ffd23a', shoes: '#ffd23a', pompom: '#ffd23a', wig: 'curly', wigCol: '#ffffff', hat: 'cone', hatCol: '#0d2b5c', hat2: '#ffd23a', eyes: 'star', eyeCol: '#2a7de1' },
    voice: { pitch: 1.3, cryPitch: 1.2 }, files: { oops: 'sounds/oops-twinkle.wav', cry: null, gameOver: null } },
  { id: 'peanut', name: 'Peanut', price: 460,
    look: { juggle: 'ducks', suit: '#c98a4a', suit2: '#2a7de1', pattern: 'half', collar: '#ffffff', shoes: '#2a7de1', pompom: '#ffd23a', wig: 'spiky', wigCol: '#e5262f', hat: 'propeller', hatCol: '#2a7de1', hat2: '#ffd23a', eyes: 'arch', eyeCol: '#2a7de1' },
    voice: { pitch: 1.2, cryPitch: 1.15 }, files: { oops: 'sounds/oops-peanut.wav', cry: null, gameOver: null } },
  { id: 'juggles', name: 'Juggles', price: 480,
    look: { juggle: 'pins', suit: '#e5262f', suit2: '#ffffff', pattern: 'hstripes', collar: '#ffffff', shoes: '#2a2a2a', pompom: '#2a7de1', wig: 'afro', wigCol: '#2a2a2a', hat: 'bowler', hatCol: '#e5262f', hat2: '#ffffff', eyes: 'cross', eyeCol: '#2a2a2a' },
    voice: { pitch: 0.95, cryPitch: 0.95 }, files: { oops: 'sounds/oops-juggles.wav', cry: null, gameOver: null } },
  { id: 'bingo', name: 'Bingo', price: 500,
    look: { juggle: 'balls', suit: '#ffd23a', suit2: '#1b1113', pattern: 'check', collar: '#ffffff', shoes: '#1b1113', pompom: '#e5262f', wig: 'sides', wigCol: '#ff7a1a', hat: 'top', hatCol: '#1b1113', hat2: '#e5262f', eyes: 'arch', eyeCol: '#1b1113', bow: '#e5262f' },
    voice: { pitch: 0.9, cryPitch: 0.9 }, files: { oops: 'sounds/oops-bingo.wav', cry: null, gameOver: null } },
  { id: 'taffy', name: 'Taffy', price: 520,
    look: { juggle: 'lollipops', suit: '#7ef0c8', suit2: '#ff6ab2', pattern: 'stripes', collar: '#ffffff', shoes: '#ff6ab2', pompom: '#ff6ab2', wig: 'long', wigCol: '#ff6ab2', hat: 'tiny', hatCol: '#7ef0c8', hat2: '#ff6ab2', eyes: 'star', eyeCol: '#ff6ab2' },
    voice: { pitch: 1.35, cryPitch: 1.25 }, files: { oops: 'sounds/oops-taffy.wav', cry: null, gameOver: null } },
  { id: 'pompom', name: 'Pompom', price: 540,
    look: { juggle: 'rings', suit: '#ffffff', suit2: '#e5262f', pattern: 'dots', collar: '#e5262f', shoes: '#e5262f', pompom: '#e5262f', wig: 'curly', wigCol: '#e5262f', hat: 'cone', hatCol: '#ffffff', hat2: '#e5262f', eyes: 'arch', eyeCol: '#e5262f' },
    voice: { pitch: 1.15, cryPitch: 1.1 }, files: { oops: 'sounds/oops-pompom.wav', cry: null, gameOver: null } },
  { id: 'fizz', name: 'Fizz', price: 560,
    look: { juggle: 'bubbles', suit: '#2a7de1', suit2: '#7ec8f0', pattern: 'dots', collar: '#7ef0c8', shoes: '#7ef0c8', pompom: '#ffffff', wig: 'spiky', wigCol: '#7ef0c8', hat: 'none', eyes: 'cross', eyeCol: '#2a7de1' },
    voice: { pitch: 1.25, cryPitch: 1.2 }, files: { oops: 'sounds/oops-fizz.wav', cry: null, gameOver: null } },
  { id: 'ruffles', name: 'Ruffles', price: 580,
    look: { juggle: 'flowers', suit: '#ff8a1a', suit2: '#ffd23a', pattern: 'plain', collar: '#ffd23a', ruff: 1.5, shoes: '#7a2be2', pompom: '#7a2be2', wig: 'afro', wigCol: '#7a2be2', hat: 'flower', hatCol: '#2f9e5b', hat2: '#ff6ab2', eyes: 'diamond', eyeCol: '#7a2be2' },
    voice: { pitch: 1, cryPitch: 1 }, files: { oops: 'sounds/oops-ruffles.wav', cry: null, gameOver: null } },
  { id: 'captain', name: 'Captain Honk', price: 600,
    look: { juggle: 'fish', suit: '#1d3d8f', suit2: '#ffffff', pattern: 'hstripes', collar: '#ffffff', shoes: '#1b1113', pompom: '#ffd23a', wig: 'sides', wigCol: '#cfcfd6', hat: 'top', hatCol: '#ffffff', hat2: '#1d3d8f', eyes: 'arch', eyeCol: '#1d3d8f', bow: '#e5262f' },
    voice: { pitch: 0.75, cryPitch: 0.75 }, files: { oops: 'sounds/oops-captain.wav', cry: null, gameOver: null } },
  { id: 'mimi', name: 'Mimi', price: 620,
    look: { juggle: 'none', suit: '#1b1113', suit2: '#ffffff', pattern: 'hstripes', collar: null, shoes: '#1b1113', glove: '#ffffff', nose: null, mouth: '#c4162f', wig: 'none', hat: 'beret', hatCol: '#1b1113', eyes: 'tear', eyeCol: '#1b1113', cheeks: null },
    voice: { pitch: 1.1, cryPitch: 1.05 }, files: { oops: 'sounds/oops-mimi.wav', cry: null, gameOver: null } },
  { id: 'tumble', name: 'Tumble', price: 640,
    look: { juggle: 'plates', suit: '#e5262f', suit2: '#2a7de1', pattern: 'half', collar: '#ffd23a', shoes: '#ffd23a', pompom: '#ffffff', wig: 'afro', wigCol: '#ffd23a', hat: 'propeller', hatCol: '#ffd23a', hat2: '#e5262f', eyes: 'star', eyeCol: '#2a7de1' },
    voice: { pitch: 1.15, cryPitch: 1.1 }, files: { oops: 'sounds/oops-tumble.wav', cry: null, gameOver: null } },
  { id: 'goldie', name: 'Goldie Star', price: 660,
    look: { juggle: 'rings', suit: '#e8b93a', suit2: '#fff6c2', pattern: 'stars', collar: '#ff6ab2', ruff: 1.3, shoes: '#ff6ab2', pompom: '#ff6ab2', wig: 'afro', wigCol: '#ff6ab2', hat: 'top', hatCol: '#e8b93a', hat2: '#e5262f', eyes: 'star', eyeCol: '#e8b93a', bow: '#e5262f' },
    voice: { pitch: 1.05, cryPitch: 1 }, files: { oops: 'sounds/oops-goldie.wav', cry: null, gameOver: null } },
  { id: 'grumbles', name: 'Grumbles', price: 710,
    look: { juggle: 'hats', suit: '#5d6b3a', suit2: '#3e4a26', pattern: 'check', collar: '#d9d2c0', shoes: '#3a2a1a', face: 'skin', skin: '#e8b48f', stubble: '#7a7a82', mouth: '#ffffff', wig: 'sides', wigCol: '#c4c4c8', hat: 'bowler', hatCol: '#3a3a3a', hat2: '#5d6b3a', eyes: 'none', bow: '#7a2be2' },
    voice: { pitch: 0.7, cryPitch: 0.7 }, files: { oops: 'sounds/oops-grumbles.wav', cry: null, gameOver: null } },
  { id: 'tickles', name: 'Tickles', price: 760,
    look: { juggle: 'cupcakes', suit: '#ff9ec7', suit2: '#fffbe0', pattern: 'dots', collar: '#ffd23a', shoes: '#7ec8f0', pompom: '#7ec8f0', wig: 'curly', wigCol: '#ffd23a', hat: 'propeller', hatCol: '#7ec8f0', hat2: '#ff9ec7', eyes: 'star', eyeCol: '#ff6ab2' },
    voice: { pitch: 1.4, cryPitch: 1.3 }, files: { oops: 'sounds/oops-tickles.wav', cry: null, gameOver: null } },
  { id: 'sirbumble', name: 'Sir Bumble', price: 810,
    look: { juggle: 'teacups', suit: '#2f5d50', suit2: '#d8c98a', pattern: 'stripes', collar: '#ffffff', shoes: '#1b1113', pompom: '#d8c98a', wig: 'sides', wigCol: '#b0702a', hat: 'top', hatCol: '#1b1b1b', hat2: '#d8c98a', eyes: 'arch', eyeCol: '#2f5d50', bow: '#c4162f' },
    voice: { pitch: 0.85, cryPitch: 0.85 }, files: { oops: 'sounds/oops-sirbumble.wav', cry: null, gameOver: null } },
  { id: 'mayhem', name: 'Mayhem', price: 860,
    look: { juggle: 'pies', suit: '#ff7a1a', suit2: '#1b9aaa', pattern: 'diamond', collar: '#ffffff', shoes: '#1b9aaa', wig: 'spiky', wigCol: '#1b9aaa', hat: 'jester', hatCol: '#ff7a1a', hat2: '#1b9aaa', eyes: 'cross', eyeCol: '#1b9aaa' },
    voice: { pitch: 1.1, cryPitch: 1.05 }, files: { oops: 'sounds/oops-mayhem.wav', cry: null, gameOver: null } },
  { id: 'starlight', name: 'Starlight', price: 910,
    look: { juggle: 'crystal', suit: '#a8c8ff', suit2: '#ffffff', pattern: 'stars', collar: '#e6d4ff', shoes: '#e6d4ff', pompom: '#ffd23a', wig: 'long', wigCol: '#e6d4ff', hat: 'cone', hatCol: '#a8c8ff', hat2: '#ffd23a', eyes: 'star', eyeCol: '#7a8cff' },
    voice: { pitch: 1.2, cryPitch: 1.15 }, files: { oops: 'sounds/oops-starlight.wav', cry: null, gameOver: null } }
];