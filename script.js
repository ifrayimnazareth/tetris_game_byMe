//For index or main menu

const Bgmusic = document.getElementById("bgMusic");
const musicStatus = document.getElementById('musicStatus');
const startBtn = document.getElementById('startBtn');
function updateMusicStatus(text) {
    musicStatus.textContent = text;
}
function tryPlayMusic() {
    bgMusic.volume = 0.3;
    bgMusic.play().then(() => {
    updateMusicStatus('🎵 Music is playing.');
    }).catch(e => {
    updateMusicStatus('🔇 Autoplay prevented. Tap anywhere to start music.');
    console.warn('Autoplay prevented:', e);
    });
}
// Try playing the music on load
window.addEventListener('load', () => {
    tryPlayMusic();
});
// Add a user interaction fallback to start music if autoplay is blocked
function userInteractionHandler() {
    tryPlayMusic();
    document.body.removeEventListener('click', userInteractionHandler);
    document.body.removeEventListener('touchstart', userInteractionHandler);
}
document.body.addEventListener('click', userInteractionHandler);
document.body.addEventListener('touchstart', userInteractionHandler);
// Start button leads to next page (adjust to your actual game page)
startBtn.addEventListener('click', () => {
    window.location.href = 'play.html'; // Change to your actual game page URL
});

// for gameplay
(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const previewCanvas = document.getElementById('preview');
    const previewCtx = previewCanvas.getContext('2d');
    const scoreElem = document.getElementById('score');
    const linesElem = document.getElementById('lines');
    const levelElem = document.getElementById('level');
    const messageElem = document.getElementById('message');

    const ROWS = 20;
    const COLS = 10;
    const BLOCK_SIZE = 32;
    const PREVIEW_BLOCK_SIZE = 20; // smaller block size for preview

    const COLORS = [
      null,
      '#00ffff', // I - cyan
      '#0000ff', // J - blue
      '#ffa500', // L - orange
      '#ffff00', // O - yellow
      '#00ff00', // S - green
      '#800080', // T - purple
      '#ff0000'  // Z - red
    ];

    // Tetromino shapes: The 4x4 grid shapes
    const SHAPES = [
      [],
      [ // I
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]
      ],
      [ // J
        [2,0,0],
        [2,2,2],
        [0,0,0]
      ],
      [ // L
        [0,0,3],
        [3,3,3],
        [0,0,0]
      ],
      [ // O
        [4,4],
        [4,4]
      ],
      [ // S
        [0,5,5],
        [5,5,0],
        [0,0,0]
      ],
      [ // T
        [0,6,0],
        [6,6,6],
        [0,0,0]
      ],
      [ // Z
        [7,7,0],
        [0,7,7],
        [0,0,0]
      ]
    ];

    class Piece {
      constructor(shapeId) {
        this.shape = SHAPES[shapeId];
        this.colorId = shapeId;
        this.x = Math.floor(COLS / 2) - Math.ceil(this.shape[0].length / 2);
        this.y = 0;
      }
      rotate() {
        const N = this.shape.length;
        const newShape = [];
        for (let x = 0; x < N; x++) {
          newShape[x] = [];
          for (let y = 0; y < N; y++) {
            newShape[x][y] = this.shape[N - y - 1][x] || 0;
          }
        }
        this.shape = newShape;
      }
    }

    const arena = createMatrix(COLS, ROWS);
    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;
    let currentPiece = null;
    let nextPiece = null; // Variable to hold next piece
    let score = 0;
    let lines = 0;
    let level = 1;
    let gameOver = false;
    let isPause = false;

    function createMatrix(w, h) {
      const matrix = [];
      for (let i = 0; i < h; i++) {
        matrix.push(new Array(w).fill(0));
      }
      return matrix;
    }

    function drawBlock(ctx, x, y, size, colorId) {
      ctx.fillStyle = COLORS[colorId];
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.fillRect(x * size, y * size, size, size);
      ctx.strokeRect(x * size, y * size, size, size);
    }

    function drawMatrix(ctx, matrix, offset, blockSize) {
      matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            drawBlock(ctx, x + offset.x, y + offset.y, blockSize, value);
          }
        });
      });
    }

    function draw() {
      // Clear main canvas
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawMatrix(ctx, arena, {x:0, y:0}, BLOCK_SIZE);
      drawMatrix(ctx, currentPiece.shape, {x: currentPiece.x, y: currentPiece.y}, BLOCK_SIZE);

      drawPreview();
    }

    function drawPreview() {
      // Clear preview canvas
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewCtx.fillStyle = '#111';
      previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      if (!nextPiece) return;

      // Calculate offset to center piece in preview canvas
      const matrix = nextPiece.shape;
      const previewCanvasWidthBlocks = previewCanvas.width / PREVIEW_BLOCK_SIZE;
      const previewCanvasHeightBlocks = previewCanvas.height / PREVIEW_BLOCK_SIZE;

      const offsetX = Math.floor((previewCanvasWidthBlocks - matrix[0].length) / 2);
      const offsetY = Math.floor((previewCanvasHeightBlocks - matrix.length) / 2);

      drawMatrix(previewCtx, matrix, {x: offsetX, y: offsetY}, PREVIEW_BLOCK_SIZE);
    }

    function collide(matrix, piece) {
      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (piece.shape[y][x] !== 0 &&
            (arena[y + piece.y] &&
            arena[y + piece.y][x + piece.x]) !== 0) {
            return true;
          }
        }
      }
      return false;
    }

    function merge(arena, piece) {
      piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            arena[y + piece.y][x + piece.x] = value;
          }
        });
      });
    }

    function arenaSweep() {
      let rowCount = 0;
      outer: for (let y = arena.length - 1; y >= 0; y--) {
        for (let x = 0; x < arena[y].length; x++) {
          if (arena[y][x] === 0) {
            continue outer;
          }
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        y++; // check same row again

        rowCount++;
      }
      if (rowCount > 0) {
        let points = 0;
        switch(rowCount) {
          case 1: points = 40 * level; break;
          case 2: points = 100 * level; break;
          case 3: points = 300 * level; break;
          case 4: points = 1200 * level; break;
        }
        score += points;
        lines += rowCount;
        if (Math.floor(lines / 10) + 1 > level) {
          level++;
          dropInterval = Math.max(100, dropInterval - 100);
          showMessage("Level Up! Level "+level, 1500);
        }
      }
    }

    function resetPiece() {
      currentPiece = nextPiece || new Piece(Math.floor(Math.random() * (SHAPES.length - 1)) + 1);
      nextPiece = new Piece(Math.floor(Math.random() * (SHAPES.length - 1)) + 1);
      if (collide(arena, currentPiece)) {
        gameOver = true;
        showMessage("Game Over! Press R to Restart.");
      }
    }

    function drop() {
      currentPiece.y++;
      if (collide(arena, currentPiece)) {
        currentPiece.y--;
        merge(arena, currentPiece);
        arenaSweep();
        updateScore();
        resetPiece();
      }
      dropCounter = 0;
    }

    function move(dir) {
      currentPiece.x += dir;
      if (collide(arena, currentPiece)) {
        currentPiece.x -= dir;
      }
    }

    function rotatePiece() {
      const pos = currentPiece.x;
      let offset = 1;
      currentPiece.rotate();
      while (collide(arena, currentPiece)) {
        currentPiece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > currentPiece.shape[0].length) {
          for (let i = 0; i < 3; i++) currentPiece.rotate();
          currentPiece.x = pos;
          return;
        }
      }
    }

    function updateScore() {
      scoreElem.textContent = score;
      linesElem.textContent = lines;
      levelElem.textContent = level;
    }

    function showMessage(text, duration=3000) {
      messageElem.textContent = text;
      if (duration > 0) {
        setTimeout(() => {
          if (!gameOver) messageElem.textContent = '';
        }, duration);
      }
    }

    function update(time = 0) {
      if (gameOver || isPause) return;
      const deltaTime = time - lastTime;
      lastTime = time;
      dropCounter += deltaTime;
      if (dropCounter > dropInterval) {
        drop();
      }
      draw();
      requestAnimationFrame(update);
    }

    document.addEventListener('keydown', event => {
      if(event.key == 'Escape') {
        if(!gameOver){
          isPause = !isPause;
          if(isPause) {
            messageElem.textContent = "Game Paused - Press ESC to Resume";
          }
          else {
            messageElem.textContent = "";
            lastTime = performance.now();
            update();
          }
        }
      }
    });

    function restartGame() {
      for(let y=0; y<arena.length; y++) {
        arena[y].fill(0);
      }
      score = 0;
      lines = 0;
      level = 1;
      dropInterval = 1000;
      gameOver = false;
      messageElem.textContent = '';
      resetPiece();
      updateScore();
      lastTime = 0;
      dropCounter = 0;
      update();
    }

    document.addEventListener('keydown', event => {
      if (gameOver) {
        if (event.key.toLowerCase() === 'r') {
          restartGame();
        }
        return;
      }
      switch(event.key) {
        case 'ArrowLeft':
        case 'a':
          move(-1);
          break;
        case 'ArrowRight':
        case 'd':
          move(1);
          break;
        case 'ArrowDown':
        case 's':
          drop();
          break;
        case 'ArrowUp':
        case 'w':
        case 'x':
          rotatePiece();
          break;
        case ' ':
          while (!collide(arena, currentPiece)) {
            currentPiece.y++;
          }
          currentPiece.y--;
          merge(arena, currentPiece);
          arenaSweep();
          updateScore();
          resetPiece();
          dropCounter = 0;
          break;
      }
    });

    // Mobile buttons
    document.getElementById('btn-left').addEventListener('touchstart', e => {
      e.preventDefault();
      if (!gameOver) move(-1);
    });
    document.getElementById('btn-right').addEventListener('touchstart', e => {
      e.preventDefault();
      if (!gameOver) move(1);
    });
    document.getElementById('btn-rotate').addEventListener('touchstart', e => {
      e.preventDefault();
      if (!gameOver) rotatePiece();
    });
    document.getElementById('btn-drop').addEventListener('touchstart', e => {
      e.preventDefault();
      if (!gameOver) drop();
    });

    // Initialize
    resetPiece();
    updateScore();
    update();

    // Accessibility: Focus canvas for keyboard input on tap
    canvas.addEventListener('click', () => {
      canvas.focus();
    });
})();
