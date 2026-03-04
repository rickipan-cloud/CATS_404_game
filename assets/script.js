const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Game state variables
let score;
let scoreText;
let highscore;
let highscoreText;
let authorText;
let player;
let gravity;
let obstacles = [];
let coins = [];
let enemies = [];
let traps = [];
let gameSpeed;
let keys = {};
let game_over = false;
let level_complete = false;
let game_started = false;
let currentLevel = 0;
let levels = [];
let goal;
let camera_x = 0;
let touchControls = {};
let activeTouches = {};

// Event Listeners
document.addEventListener('keydown', (evt) => {
  if (game_over && evt.code === 'Space') {
    score = 0;
    game_over = false;
    LoadLevel(currentLevel);
    return;
  }

  if (!game_started && evt.code === 'Space') {
    game_started = true;
  }
  keys[evt.code] = true;
});
document.addEventListener('keyup', (evt) => { keys[evt.code] = false; });

document.addEventListener('touchstart', handleTouchStart, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });
document.addEventListener('touchmove', handleTouchMove, { passive: false });

// --- Classes ---
class Player {
  constructor(x, y, w, h, c) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.image = new Image();
    this.image.src = 'assets/mario_cat.png'; // The new player image
    this.facingRight = true;

    this.dx = 0;
    this.dy = 0;
    this.jumpForce = 18; // Increased jump force
    this.speed = 5;
    this.friction = 0.8;
    this.originalHeight = h;
    this.grounded = false;
    this.jumpTimer = 0;
  }

  Animate() {
    // Horizontal Movement
    if (keys['KeyA'] || keys['ArrowLeft']) {
      this.dx = -this.speed;
      this.facingRight = false;
    } else if (keys['KeyD'] || keys['ArrowRight']) {
      this.dx = this.speed;
      this.facingRight = true;
    }

    // Jump
    if (keys['ArrowUp'] || keys['KeyW']) {
      this.Jump();
    }

    // Apply friction
    this.dx *= this.friction;

    // Gravity
    this.dy += gravity;

    // Move player
    this.x += this.dx;
    this.y += this.dy;

    // Ground check & Platform collision
    this.grounded = false; // Assume not grounded unless a collision is detected
    for (let i = 0; i < obstacles.length; i++) {
        let o = obstacles[i];
        if (this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y) {
            // Check for collision from top
            if (this.dy > 0 && this.y + this.h - this.dy <= o.y) {
                this.y = o.y - this.h;
                this.grounded = true;
                this.dy = 0;
            }
        }
    }

    // Fallback to canvas floor if no platform is hit
    if (this.y + this.h > canvas.height) {
        this.y = canvas.height - this.h;
        this.grounded = true;
        this.dy = 0;
    }

    this.Draw();
  }

  Jump() {
    if (this.grounded) {
      this.dy = -this.jumpForce;
      this.grounded = false;
    }
  }

  Draw() {
    ctx.save(); // Save the current context state
    if (!this.facingRight) {
      ctx.translate((this.x - camera_x) + this.w, this.y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, 0, 0, this.w, this.h);
    } else {
      ctx.drawImage(this.image, this.x - camera_x, this.y, this.w, this.h);
    }
    ctx.restore(); // Restore the context to its original state
  }
}

class Enemy {
  constructor(x, y, w, h, speed, range) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.image = new Image();
    this.image.src = 'assets/enemy.png';

    this.dx = -speed;
    this.speed = speed;
    this.range = range;
    this.startX = x;
  }

  Update() {
    this.x += this.dx;
    if (this.x < this.startX - this.range || this.x > this.startX + this.range) {
      this.dx *= -1; // Reverse direction
    }
    this.Draw();
  }

  Draw() {
    ctx.drawImage(this.image, this.x - camera_x, this.y, this.w, this.h);
  }
}

class Trap {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.c = '#9E9E9E'; // A gray color for traps
    }

    Draw() {
        ctx.beginPath();
        ctx.fillStyle = this.c;
        ctx.fillRect(this.x - camera_x, this.y, this.w, this.h);
        ctx.closePath();
    }
}

class Coin {
  constructor(x, y, radius, c) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.c = c;
  }

  Draw() {
    ctx.beginPath();
    ctx.fillStyle = this.c;
    ctx.arc(this.x - camera_x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

class Goal {
  constructor(x, y, w, h, c) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.c = c;
  }

  Draw() {
    ctx.beginPath();
    ctx.fillStyle = this.c;
    ctx.fillRect(this.x - camera_x, this.y, this.w, this.h);
    ctx.closePath();
  }
}

class Obstacle {
  constructor(x, y, w, h, c) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.c = c; // Color
  }

  Update() {
    this.Draw();
  }

  Draw() {
    ctx.beginPath();
    ctx.fillStyle = this.c;
    ctx.fillRect(this.x - camera_x, this.y, this.w, this.h);
    ctx.closePath();
  }
}

class Text {
  constructor(t, x, y, a, c, s) {
    this.t = t;
    this.x = x;
    this.y = y;
    this.a = a;
    this.c = c;
    this.s = s;
  }

  Draw() {
    ctx.font = this.s + "px 'Courier New', Courier, monospace";
    ctx.fillStyle = this.c;
    ctx.textAlign = this.a;
    ctx.fillText(this.t, this.x, this.y);
  }
}

// --- Game Logic ---
function Init() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  gravity = 0.8;
  score = 0;
  highscore = localStorage.getItem('highscore') || 0;

  // Define our levels AFTER canvas dimensions are set
  levels = [
    // Level 1: Tutorial
    {
      platforms: [
        { x: 0, y: canvas.height - 20, w: 500, h: 20 },
        { x: 600, y: canvas.height - 120, w: 200, h: 20 },
        { x: 900, y: canvas.height - 220, w: 200, h: 20 }
      ],
      coins: [
        { x: 650, y: canvas.height - 160, r: 10 },
        { x: 750, y: canvas.height - 160, r: 10 },
        { x: 950, y: canvas.height - 260, r: 10 },
        { x: 1050, y: canvas.height - 260, r: 10 }
      ],
      goal: { x: 1200, y: canvas.height - 70, w: 20, h: 50 }
    },
    // Level 2: Advanced
    {
      platforms: [
        { x: 0, y: canvas.height - 20, w: 300, h: 20 },
        { x: 450, y: canvas.height - 80, w: 150, h: 20 },
        { x: 700, y: canvas.height - 150, w: 150, h: 20 },
        { x: 950, y: canvas.height - 220, w: 150, h: 20 },
        { x: 1200, y: canvas.height - 300, w: 100, h: 20 }
      ],
      coins: [
        { x: 500, y: canvas.height - 120, r: 10 },
        { x: 750, y: canvas.height - 190, r: 10 },
        { x: 1000, y: canvas.height - 260, r: 10 },
        { x: 1250, y: canvas.height - 340, r: 10 }
      ],
      goal: { x: 1400, y: canvas.height - 70, w: 20, h: 50 },
      enemies: [
        { x: 750, y: canvas.height - 190, speed: 1, range: 80 }
      ],
      traps: [
        { x: 450, y: canvas.height - 40, w: 150, h: 20 }
      ]
    },
    // Level 3: Expert
    {
      platforms: [
        { x: 0, y: canvas.height - 20, w: 150, h: 20 },
        { x: 300, y: canvas.height - 100, w: 100, h: 20 },
        { x: 500, y: canvas.height - 180, w: 100, h: 20 },
        // "Leap of faith"
        { x: 900, y: canvas.height - 180, w: 100, h: 20 },
        { x: 1100, y: canvas.height - 250, w: 100, h: 20 },
        { x: 1300, y: canvas.height - 320, w: 100, h: 20 }
      ],
      coins: [
        { x: 350, y: canvas.height - 140, r: 10 },
        { x: 550, y: canvas.height - 220, r: 10 },
        { x: 950, y: canvas.height - 220, r: 10 },
        { x: 1150, y: canvas.height - 290, r: 10 },
        { x: 1350, y: canvas.height - 360, r: 10 }
      ],
      goal: { x: 1500, y: canvas.height - 70, w: 20, h: 50 },
      enemies: [
        { x: 550, y: canvas.height - 220, speed: 1.5, range: 70 },
        { x: 1150, y: canvas.height - 290, speed: 2, range: 100 }
      ],
      traps: [
        { x: 300, y: canvas.height - 60, w: 100, h: 20 },
        { x: 900, y: canvas.height - 140, w: 100, h: 20 }
      ]
    }
  ];

    // Adapt font size for mobile
  let scoreFontSize = (canvas.width < 768) ? '20' : '30';
  let authorFontSize = (canvas.width < 768) ? '14' : '20';

  scoreText = new Text('Score: ' + score, 25, 25, 'left', '#212121', scoreFontSize);
  highscoreText = new Text('Highscore: ' + highscore, canvas.width - 25, 25, 'right', '#212121', scoreFontSize);
  authorText = new Text('create by RICKI', canvas.width - 25, canvas.height - 25, 'right', 'rgba(0, 0, 0, 0.3)', authorFontSize);

  // Define touch controls based on canvas size
  const buttonSize = 80;
  const buttonMargin = 20;
  touchControls = {
      left: { x: buttonMargin, y: canvas.height - buttonSize - buttonMargin, w: buttonSize, h: buttonSize, key: 'ArrowLeft' },
      right: { x: buttonSize + buttonMargin * 2, y: canvas.height - buttonSize - buttonMargin, w: buttonSize, h: buttonSize, key: 'ArrowRight' },
      jump: { x: canvas.width - buttonSize - buttonMargin, y: canvas.height - buttonSize - buttonMargin, w: buttonSize, h: buttonSize, key: 'ArrowUp' }
  };

  // We need to load the player image before starting the game
  let playerImage = new Image();
  playerImage.src = 'assets/mario_cat.png';
  playerImage.onload = function() {
    player = new Player(50, canvas.height - 150, 50, 50);
    player.image = playerImage;

    LoadLevel(currentLevel);
    requestAnimationFrame(Update);
  }
}

function LoadLevel(levelIndex) {
  let level = levels[levelIndex];

  // Clear old level data
  obstacles = [];
  coins = [];
  enemies = [];
  traps = [];

  // Load platforms
  for (let i = 0; i < level.platforms.length; i++) {
    let p = level.platforms[i];
    obstacles.push(new Obstacle(p.x, p.y, p.w, p.h, '#212121'));
  }

  // Load coins
  for (let i = 0; i < level.coins.length; i++) {
    let c = level.coins[i];
    coins.push(new Coin(c.x, c.y, c.r, '#FFD700'));
  }

  // Load enemies
  if (level.enemies) {
    for (let i = 0; i < level.enemies.length; i++) {
      let e = level.enemies[i];
      enemies.push(new Enemy(e.x, e.y, 40, 40, e.speed, e.range));
    }
  }

  // Load traps
  if (level.traps) {
      for (let i = 0; i < level.traps.length; i++) {
          let t = level.traps[i];
          traps.push(new Trap(t.x, t.y, t.w, t.h));
      }
  }

  // Load goal
  goal = new Goal(level.goal.x, level.goal.y, level.goal.w, level.goal.h, '#00FF00');

  // Reset player position
  player.x = 50;
  player.y = canvas.height - 150;
  player.dx = 0;
  player.dy = 0;

  // Reset camera
  camera_x = 0;
}

function Update() {
  requestAnimationFrame(Update);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!game_started) {
    DrawStartScreen();
    return;
  }

  if (game_over) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = "bold 48px 'Courier New', Courier, monospace";
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.font = "20px 'Courier New', Courier, monospace";
    ctx.fillText('Press Space or Tap to Restart', canvas.width / 2, canvas.height / 2 + 40);
    return;
  }

  if (level_complete) {
    let message = 'YOU WIN!';
    if (currentLevel < levels.length - 1) {
      message = 'Level Complete!';
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = "bold 48px 'Courier New', Courier, monospace";
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);

    if (message === 'YOU WIN!') {
      ctx.font = "bold 24px 'Courier New', Courier, monospace";
      ctx.fillText('Final Score: ' + score, canvas.width / 2, canvas.height / 2 + 40);
    }

    if (currentLevel < levels.length - 1) {
      ctx.font = "20px 'Courier New', Courier, monospace";
      ctx.fillText('Press Space or Tap to Continue', canvas.width / 2, canvas.height / 2 + 40);

      if (keys['Space']) {
        currentLevel++;
        level_complete = false;
        LoadLevel(currentLevel);
      }
    }
    return;
  }

  // Draw all obstacles (platforms)
  for (let i = 0; i < obstacles.length; i++) {
    obstacles[i].Update();
  }

  // Draw all traps and check for collision
  for (let i = 0; i < traps.length; i++) {
    let t = traps[i];
    t.Draw();
    if (player.x < t.x + t.w && player.x + player.w > t.x && player.y < t.y + t.h && player.y + player.h > t.y) {
        game_over = true;
    }
  }

  // Draw all enemies and check for collision
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    e.Update();

    // Check for collision with player
    if (player.x < e.x + e.w && player.x + player.w > e.x && player.y < e.y + e.h && player.y + player.h > e.y) {
        // Player is falling on top of the enemy
        if (player.dy > 0 && (player.y + player.h - player.dy) <= e.y) {
            enemies.splice(i, 1); // Kill the enemy
            player.dy = -player.jumpForce / 2; // Small bounce
        } else {
            game_over = true; // Player hit from side or bottom
        }
    }
  }

  // Draw and check for coin collection
  for (let i = coins.length - 1; i >= 0; i--) {
    let c = coins[i];
    c.Draw();

    // Simple circle collision detection
    let playerCenterX = player.x + player.w / 2;
    let playerCenterY = player.y + player.h / 2;
    let dist = Math.sqrt(Math.pow(playerCenterX - c.x, 2) + Math.pow(playerCenterY - c.y, 2));

    if (dist < c.radius + player.w / 2) {
      coins.splice(i, 1);
      score += 10; // Add 10 points per coin
      scoreText.t = 'Score: ' + score;
      if (score > highscore) {
        highscore = score;
        highscoreText.t = 'Highscore: ' + highscore;
        localStorage.setItem('highscore', highscore);
      }
    }
  }

  // Draw the goal
  goal.Draw();

  // Check for win condition
  if (player.x < goal.x + goal.w && player.x + player.w > goal.x && player.y < goal.y + goal.h && player.y + player.h > goal.y) {
    level_complete = true;
  }

  player.Animate();

  scoreText.Draw();
  highscoreText.Draw();
  authorText.Draw();

  // Update camera
  let target_camera_x = player.x - canvas.width / 3;
  camera_x += (target_camera_x - camera_x) * 0.05;

  // Draw touch controls
  drawTouchControls();
}

function RandomIntInRange(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function DrawStartScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.font = "bold 48px 'Courier New', Courier, monospace";
  ctx.textAlign = 'center';
  ctx.fillText('CATS 404', canvas.width / 2, canvas.height / 2 - 150);

  ctx.font = "20px 'Courier New', Courier, monospace";
  ctx.fillText('Use [A][D] or [<][>] to Move', canvas.width / 2, canvas.height / 2 - 50);
  ctx.fillText('Use [W] or [^] to Jump', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillText('Collect all coins and reach the green flag!', canvas.width / 2, canvas.height / 2 + 10);

  ctx.font = "bold 24px 'Courier New', Courier, monospace";
  ctx.fillText('Press Space or Tap to Start', canvas.width / 2, canvas.height / 2 + 80);
}

// --- Start ---
Init();

function handleTouchStart(evt) {
    if (game_over) {
        score = 0;
        game_over = false;
        LoadLevel(currentLevel);
        return;
    }

    if (!game_started) {
        game_started = true;
        return;
    }

    // If on level complete screen, any tap continues
    if (level_complete && currentLevel < levels.length - 1) {
        currentLevel++;
        level_complete = false;
        LoadLevel(currentLevel);
        return; // Don't process movement controls
    }

    evt.preventDefault();
    const touches = evt.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        activeTouches[touch.identifier] = { x: touch.clientX, y: touch.clientY };
        checkTouch(touch.clientX, touch.clientY, true);
    }
}

function handleTouchEnd(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        delete activeTouches[touch.identifier];
        checkTouch(touch.clientX, touch.clientY, false);
    }
    // Reset all keys just in case
    keys[touchControls.left.key] = false;
    keys[touchControls.right.key] = false;
    keys[touchControls.jump.key] = false;
    // Re-evaluate remaining active touches
    for(const id in activeTouches) {
        checkTouch(activeTouches[id].x, activeTouches[id].y, true);
    }
}

function handleTouchMove(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    // First, reset keys for touches that moved away from their buttons
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        checkTouch(activeTouches[touch.identifier].x, activeTouches[touch.identifier].y, false);
    }
    // Then, process the new positions
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        activeTouches[touch.identifier] = { x: touch.clientX, y: touch.clientY };
        checkTouch(touch.clientX, touch.clientY, true);
    }
}

function checkTouch(x, y, isPressed) {
    for (const dir in touchControls) {
        const button = touchControls[dir];
        if (x > button.x && x < button.x + button.w && y > button.y && y < button.y + button.h) {
            keys[button.key] = isPressed;
        }
    }
}

function drawTouchControls() {
    ctx.save();
    ctx.globalAlpha = 0.5; // Set transparency
    ctx.fillStyle = '#888';
    ctx.font = "bold 48px 'Courier New', Courier, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw buttons
    for (const dir in touchControls) {
        const button = touchControls[dir];
        ctx.beginPath();
        ctx.roundRect(button.x, button.y, button.w, button.h, [15]);
        ctx.fill();
    }

    // Draw labels
    ctx.fillStyle = '#fff';
    ctx.fillText('<', touchControls.left.x + touchControls.left.w / 2, touchControls.left.y + touchControls.left.h / 2);
    ctx.fillText('>', touchControls.right.x + touchControls.right.w / 2, touchControls.right.y + touchControls.right.h / 2);
    ctx.fillText('^', touchControls.jump.x + touchControls.jump.w / 2, touchControls.jump.y + touchControls.jump.h / 2);

    ctx.restore();
}
