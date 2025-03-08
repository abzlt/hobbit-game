const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('./'));

const players = new Map();
const gameState = {
    players: {},
    currentPlayer: null,
    mushroom: {
        x: 400,
        y: 540,
        direction: 1,
        speed: 2,
        isMoving: true,
        mood: 'happy' // Настроение гриба
    }
};

const SPEED = 5;
const JUMP_FORCE = 15;
const GRAVITY = 0.8;
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const GROUND_LEVEL = SCREEN_HEIGHT - 50;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 44;

function generateRandomPosition() {
    return {
        x: Math.random() * (SCREEN_WIDTH - PLAYER_WIDTH) + PLAYER_WIDTH/2,
        y: GROUND_LEVEL - PLAYER_HEIGHT
    };
}

function updateGameState() {
    // Обновление позиции гриба
    if (gameState.mushroom.isMoving) {
        gameState.mushroom.x += gameState.mushroom.direction * gameState.mushroom.speed;
        
        // Смена направления гриба при достижении границ
        if (gameState.mushroom.x <= 32) {
            gameState.mushroom.x = 32;
            gameState.mushroom.direction = 1;
        } else if (gameState.mushroom.x >= SCREEN_WIDTH - 32) {
            gameState.mushroom.x = SCREEN_WIDTH - 32;
            gameState.mushroom.direction = -1;
        }
    }
    
    // Обновление состояния игроков
    players.forEach(player => {
        // Применение гравитации
        if (player.y < GROUND_LEVEL - PLAYER_HEIGHT) {
            player.velocityY += GRAVITY;
            player.canJump = false;
        } else {
            player.y = GROUND_LEVEL - PLAYER_HEIGHT;
            player.velocityY = 0;
            player.canJump = true;
        }

        // Обновление вертикальной позиции
        player.y += player.velocityY;

        // Проверка столкновений с грибом
        if (checkCollisionWithMushroom(player, gameState.mushroom)) {
            if (player.velocityY > 0) {
                player.velocityY = -JUMP_FORCE;
                player.score += 50;
                gameState.mushroom.isMoving = !gameState.mushroom.isMoving;
                gameState.mushroom.mood = gameState.mushroom.isMoving ? 'happy' : 'sad';
                console.log(`Игрок ${player.id} прыгнул на гриб! Гриб ${gameState.mushroom.isMoving ? 'двигается' : 'остановился'}`);
            }
        }
        
        // Проверка столкновений с другими игроками
        players.forEach((otherPlayer, id) => {
            if (id !== player.id) {
                if (checkCollision(player, otherPlayer)) {
                    if (player.y < otherPlayer.y - PLAYER_HEIGHT/2 && player.velocityY > 0) {
                        player.velocityY = -JUMP_FORCE / 2;
                        player.score += 100;
                        otherPlayer.lives--;
                        
                        io.emit('playerKilled', {
                            killer: player.id,
                            killed: otherPlayer.id
                        });
                        
                        console.log(`Игрок ${player.id} прыгнул на игрока ${otherPlayer.id}!`);

                        if (otherPlayer.lives <= 0) {
                            players.delete(id);
                            console.log(`Игрок ${otherPlayer.id} выбыл из игры!`);
                        } else {
                            const newPos = generateRandomPosition();
                            otherPlayer.x = newPos.x;
                            otherPlayer.y = newPos.y;
                            console.log(`Игрок ${otherPlayer.id} респавнится на x:${newPos.x}, y:${newPos.y}`);
                        }
                    }
                }
            }
        });
    });
    
    gameState.players = Object.fromEntries(players);
    io.emit('gameState', gameState);
}

function movePlayer(player, movement) {
    // Горизонтальное движение
    if (movement.left) {
        player.x -= SPEED;
        player.facingLeft = true;
    }
    if (movement.right) {
        player.x += SPEED;
        player.facingLeft = false;
    }

    // Проверка границ экрана
    if (player.x < PLAYER_WIDTH/2) player.x = PLAYER_WIDTH/2;
    if (player.x > SCREEN_WIDTH - PLAYER_WIDTH/2) player.x = SCREEN_WIDTH - PLAYER_WIDTH/2;
}

function checkCollision(player1, player2) {
    return Math.abs(player1.x - player2.x) < PLAYER_WIDTH &&
           Math.abs(player1.y - player2.y) < PLAYER_HEIGHT;
}

function checkCollisionWithMushroom(player, mushroom) {
    return Math.abs(player.x - mushroom.x) < PLAYER_WIDTH &&
           Math.abs(player.y - mushroom.y) < PLAYER_HEIGHT;
}

// Игровой цикл
setInterval(() => {
    updateGameState();
}, 1000 / 60);

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('error', (error) => {
        console.error('Ошибка сокета:', error);
    });

    socket.on('startGame', () => {
        try {
            const playerId = socket.id;
            const position = generateRandomPosition();
            
            const player = {
                id: playerId,
                name: `Хоббит ${Math.floor(Math.random() * 1000)}`,
                x: position.x,
                y: position.y,
                velocityY: 0,
                canJump: true,
                facingLeft: false,
                score: 0,
                lives: 3,
                level: 1,
                powerup: '-'
            };
            
            players.set(playerId, player);
            gameState.currentPlayer = playerId;
            
            console.log('Игра началась для игрока:', player);
            updateGameState();
        } catch (error) {
            console.error('Ошибка при старте игры:', error);
        }
    });

    socket.on('move', (movement) => {
        const player = players.get(socket.id);
        if (player) {
            movePlayer(player, movement);
        }
    });

    socket.on('jump', () => {
        const player = players.get(socket.id);
        if (player && player.canJump) {
            player.velocityY = -JUMP_FORCE;
            player.canJump = false;
            console.log(`Игрок ${player.id} прыгнул! Позиция: x=${player.x}, y=${player.y}`);
        } else if (player) {
            console.log(`Игрок ${player.id} не может прыгнуть. canJump=${player.canJump}, y=${player.y}, ground=${GROUND_LEVEL - PLAYER_HEIGHT}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        players.delete(socket.id);
        if (gameState.currentPlayer === socket.id) {
            gameState.currentPlayer = null;
        }
        updateGameState();
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
}); 