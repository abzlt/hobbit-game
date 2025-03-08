class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = io();
        this.players = new Map();
        this.currentPlayer = null;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.powerup = '-';
        this.keys = {};
        this.playerState = null;
        this.lastTime = 0;
        this.animationFrame = 0;
        this.debugMode = false; // Для отладки
        this.jumpPressed = false; // Для отслеживания нажатия прыжка
        
        // Загрузка изображений
        this.images = {};
        this.loadImages();
        
        this.setupCanvas();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.gameLoop();
        
        console.log("Игра инициализирована");
    }
    
    loadImages() {
        const imageNames = ['hobbit_house', 'tree', 'flower', 'fence', 'mushroom'];
        imageNames.forEach(name => {
            this.images[name] = new Image();
            this.images[name].src = `https://mario.wiki.gallery/images/thumb/9/9d/SMB_NES_Sprite_Flag.png/120px-SMB_NES_Sprite_Flag.png`;
        });
    }

    setupCanvas() {
        this.canvas.width = 800;
        this.canvas.height = 600;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.setupCanvas());
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        
        // Добавляем обработчик для отладки
        window.addEventListener('keypress', (e) => {
            if (e.key === 'd') {
                this.debugMode = !this.debugMode;
                console.log("Режим отладки:", this.debugMode);
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Подключено к серверу');
        });

        this.socket.on('gameState', (state) => {
            console.log('Получено состояние игры:', state);
            this.players = new Map(Object.entries(state.players));
            this.currentPlayer = state.currentPlayer;
            this.mushroom = state.mushroom;
            
            if (this.currentPlayer && state.players[this.currentPlayer]) {
                this.playerState = state.players[this.currentPlayer];
                this.score = this.playerState.score;
                this.lives = this.playerState.lives;
                this.level = this.playerState.level;
                this.powerup = this.playerState.powerup;
                
                if (this.debugMode) {
                    console.log('Текущий игрок:', this.playerState);
                }
            }
            
            this.updateUI();
            this.render();
        });

        this.socket.on('playerKilled', (data) => {
            if (data.killed === this.currentPlayer) {
                console.log('Вас убили!');
            } else if (data.killer === this.currentPlayer) {
                console.log('Вы убили игрока!');
            }
        });
    }

    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = true;
        
        // Обработка прыжка - отправляем только при первом нажатии
        if (key === ' ' && !this.jumpPressed && this.playerState && this.playerState.canJump) {
            this.jumpPressed = true;
            console.log('Прыжок!');
            this.socket.emit('jump');
        }
        
        if (this.debugMode) {
            console.log('Клавиша нажата:', key, 'Состояние клавиш:', this.keys);
        }
    }

    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
        
        // Сбрасываем флаг прыжка при отпускании клавиши
        if (key === ' ') {
            this.jumpPressed = false;
        }
        
        if (this.debugMode) {
            console.log('Клавиша отпущена:', key, 'Состояние клавиш:', this.keys);
        }
    }

    startGame() {
        console.log('Начало игры');
        this.socket.emit('startGame');
    }

    updateUI() {
        document.getElementById('score-value').textContent = this.score;
        document.getElementById('lives-value').textContent = this.lives;
        document.getElementById('level-value').textContent = this.level;
        document.getElementById('powerup-value').textContent = this.powerup;
        
        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';
        
        const sortedPlayers = Array.from(this.players.entries())
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 5);
            
        sortedPlayers.forEach(([id, player]) => {
            const playerElement = document.createElement('div');
            playerElement.textContent = `${player.name}: ${player.score}`;
            leaderboardList.appendChild(playerElement);
        });
    }

    gameLoop(timestamp) {
        // Обновление анимации
        if (timestamp - this.lastTime > 100) {
            this.animationFrame = (this.animationFrame + 1) % 4;
            this.lastTime = timestamp;
        }

        if (this.currentPlayer && this.playerState) {
            const movement = {
                left: this.keys['a'] || this.keys['arrowleft'],
                right: this.keys['d'] || this.keys['arrowright']
            };
            
            // Всегда отправляем состояние движения
            this.socket.emit('move', movement);
            
            if (this.debugMode && (movement.left || movement.right)) {
                console.log('Отправка движения:', movement);
            }
        }
        
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    drawHobbit(player, id) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        
        if (player.facingLeft) {
            this.ctx.scale(-1, 1);
        }
        
        // Тело хоббита
        this.ctx.fillStyle = '#8B4513'; // Коричневый жилет
        this.ctx.fillRect(-16, -32, 32, 20);
        
        // Рубашка
        this.ctx.fillStyle = id === this.currentPlayer ? '#FFFF00' : '#FFFFFF'; // Желтая/белая рубашка
        this.ctx.fillRect(-14, -32, 28, 10);
        
        // Штаны
        this.ctx.fillStyle = '#006400'; // Темно-зеленые штаны
        this.ctx.fillRect(-14, -12, 28, 12);
        
        // Руки
        this.ctx.fillStyle = '#FFD700'; // Золотистые руки
        this.ctx.fillRect(-18, -24, 8, 8);
        this.ctx.fillRect(10, -24, 8, 8);
        
        // Голова
        this.ctx.fillStyle = '#FFE4B5'; // Светло-коричневая кожа
        this.ctx.beginPath();
        this.ctx.arc(0, -40, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Волосы
        this.ctx.fillStyle = '#8B4513'; // Коричневые кудрявые волосы
        this.ctx.beginPath();
        this.ctx.arc(0, -44, 10, 0, Math.PI);
        this.ctx.fill();
        
        // Глаза
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-4, -40, 2, 0, Math.PI * 2);
        this.ctx.arc(4, -40, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Улыбка
        this.ctx.beginPath();
        this.ctx.arc(0, -36, 5, 0, Math.PI);
        this.ctx.stroke();
        
        // Ноги с анимацией
        const legOffset = Math.sin(this.animationFrame * Math.PI / 2) * 4;
        this.ctx.fillStyle = '#8B4513'; // Коричневые ноги
        if (player.velocityY !== 0) {
            // Анимация прыжка
            this.ctx.fillRect(-12, 0, 8, 12);
            this.ctx.fillRect(4, 0, 8, 12);
        } else if (player.facingLeft || player.facingRight) {
            // Анимация ходьбы
            this.ctx.fillRect(-12, 0, 8, 12 + legOffset);
            this.ctx.fillRect(4, 0, 8, 12 - legOffset);
        } else {
            // Стоит на месте
            this.ctx.fillRect(-12, 0, 8, 12);
            this.ctx.fillRect(4, 0, 8, 12);
        }
        
        this.ctx.restore();
        
        // Имя игрока
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.name, player.x, player.y - 60);
        
        // Отладочная информация
        if (this.debugMode) {
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`x: ${Math.round(player.x)}, y: ${Math.round(player.y)}, vY: ${player.velocityY.toFixed(1)}`, 
                             player.x, player.y - 75);
            
            // Рамка коллизии
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.strokeRect(player.x - 16, player.y - 32, 32, 44);
        }
    }

    drawMushroom(mushroom) {
        this.ctx.save();
        this.ctx.translate(mushroom.x, mushroom.y);
        
        // Шляпка гриба
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(0, -8, 16, Math.PI, 0, false);
        this.ctx.fill();
        
        // Белые точки на шляпке
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(-8, -12, 4, 0, Math.PI * 2);
        this.ctx.arc(0, -16, 4, 0, Math.PI * 2);
        this.ctx.arc(8, -12, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ножка гриба
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(-8, -8, 16, 16);
        
        // Глаза с анимацией
        this.ctx.fillStyle = '#000000';
        const blinkOffset = this.animationFrame === 3 ? -1 : 0;
        this.ctx.beginPath();
        this.ctx.arc(-4, 0, 2, 0, Math.PI * 2);
        this.ctx.arc(4, 0, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Улыбка
        this.ctx.beginPath();
        this.ctx.arc(0, 2, 4, 0, Math.PI);
        this.ctx.stroke();
        
        this.ctx.restore();
        
        // Отладочная информация
        if (this.debugMode) {
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.strokeRect(mushroom.x - 16, mushroom.y - 16, 32, 24);
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`x: ${Math.round(mushroom.x)}, dir: ${mushroom.direction}`, 
                             mushroom.x, mushroom.y - 25);
        }
    }
    
    drawHobbitHouse() {
        // Домик хоббита
        this.ctx.save();
        this.ctx.translate(650, this.canvas.height - 120);
        
        // Холм
        this.ctx.fillStyle = '#7CFC00'; // Ярко-зеленый холм
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 80, Math.PI, 0, false);
        this.ctx.fill();
        
        // Дверь
        this.ctx.fillStyle = '#FFD700'; // Золотая круглая дверь
        this.ctx.beginPath();
        this.ctx.arc(0, -20, 30, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ручка двери
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.arc(0, -20, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Окно
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.beginPath();
        this.ctx.arc(-40, -30, 15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Рама окна
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(-40, -30, 15, 0, Math.PI * 2);
        this.ctx.moveTo(-40, -45);
        this.ctx.lineTo(-40, -15);
        this.ctx.moveTo(-55, -30);
        this.ctx.lineTo(-25, -30);
        this.ctx.stroke();
        
        // Дымоход
        this.ctx.fillStyle = '#B22222';
        this.ctx.fillRect(40, -60, 15, 30);
        
        // Дым из дымохода
        this.ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(47 + this.animationFrame * 3, -70 - this.animationFrame * 5, 8, 0, Math.PI * 2);
        this.ctx.arc(52 + this.animationFrame * 4, -80 - this.animationFrame * 3, 10, 0, Math.PI * 2);
        this.ctx.arc(45 + this.animationFrame * 5, -90 - this.animationFrame * 2, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawTree(x, y, size) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Ствол
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(-size/10, 0, size/5, size/2);
        
        // Крона
        this.ctx.fillStyle = '#228B22';
        this.ctx.beginPath();
        this.ctx.arc(0, -size/4, size/3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawFence(x, y, width) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Горизонтальные перекладины
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, 0, width, 5);
        this.ctx.fillRect(0, 15, width, 5);
        
        // Вертикальные столбики
        for (let i = 0; i <= width; i += 20) {
            this.ctx.fillRect(i, -10, 5, 40);
        }
        
        this.ctx.restore();
    }
    
    drawFlowers(x, y, count) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        for (let i = 0; i < count; i++) {
            const flowerX = Math.sin(i * 0.5) * 30;
            const flowerY = Math.cos(i * 0.5) * 20;
            
            // Стебель
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(flowerX, flowerY);
            this.ctx.lineTo(flowerX, flowerY + 20);
            this.ctx.stroke();
            
            // Цветок
            this.ctx.fillStyle = ['#FF69B4', '#FFFF00', '#FF6347', '#9370DB'][i % 4];
            this.ctx.beginPath();
            this.ctx.arc(flowerX, flowerY, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Фон - голубое небо
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F7FA');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Облака
        this.ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.arc(100 + i * 300, 100, 30, 0, Math.PI * 2);
            this.ctx.arc(130 + i * 300, 90, 30, 0, Math.PI * 2);
            this.ctx.arc(160 + i * 300, 100, 30, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Холмы Шира
        this.ctx.fillStyle = '#7CFC00';
        for (let i = 0; i < 5; i++) {
            this.ctx.beginPath();
            this.ctx.arc(i * 200, this.canvas.height, 150, Math.PI, 0, true);
            this.ctx.fill();
        }
        
        // Деревья
        this.drawTree(100, this.canvas.height - 150, 100);
        this.drawTree(300, this.canvas.height - 180, 120);
        this.drawTree(500, this.canvas.height - 160, 90);
        
        // Домик хоббита
        this.drawHobbitHouse();
        
        // Забор
        this.drawFence(50, this.canvas.height - 70, 300);
        
        // Цветы
        this.drawFlowers(150, this.canvas.height - 80, 8);
        this.drawFlowers(400, this.canvas.height - 90, 6);
        
        // Земля
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        
        // Трава
        this.ctx.fillStyle = '#32CD32';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 10);
        
        // Отрисовка гриба
        if (this.mushroom) {
            this.drawMushroom(this.mushroom);
        } else {
            console.error("Гриб не найден в состоянии игры!");
        }
        
        // Отрисовка всех игроков
        this.players.forEach((player, id) => {
            this.drawHobbit(player, id);
        });
    }
}

// Инициализация игры
window.onload = () => {
    new Game();
}; 