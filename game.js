// 时空回响迷宫 - 游戏核心逻辑
class TimeEchoMaze {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameState = 'title'; // title, help, playing, paused, gameOver
        this.score = 0;
        this.level = 1;
        this.energy = 100;
        
        // 音频上下文和节拍
        this.audioContext = null;
        this.beatInterval = 1000; // 1秒一拍
        this.lastBeatTime = 0;
        this.beatTolerance = 200; // 节拍容错时间(毫秒)
        
        // 迷宫相关
        this.maze = [];
        this.mazeSize = 15;
        this.cellSize = 30;
        this.player = { x: 1, y: 1, size: 20 };
        this.target = { x: 13, y: 13 };
        this.obstacles = [];
        this.hiddenPaths = [];
        
        // 时间回响系统
        this.playerTrail = [];
        this.maxTrailLength = 10;
        this.trailUpdateInterval = 300;
        this.lastTrailUpdate = 0;
        
        // 3D音效系统
        this.audioNodes = [];
        this.spatialAudio = null;
        
        // 动态迷宫系统
        this.mazeChangeCycle = 15000; // 15秒重构一次
        this.lastMazeChange = 0;
        this.mazePhase = 0;
        
        // 控制系统
        this.keys = {};
        this.touchControls = false;
        
        this.init();
    }
    
    async init() {
        await this.setupCanvas();
        this.setupAudio();
        this.setupControls();
        this.setupScreens();
        this.generateMaze();
        this.gameLoop();
    }
    
    async setupCanvas() {
        this.canvas = document.getElementById('mazeCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 响应式画布设置
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = document.getElementById('gameCanvas');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width - 4;
        this.canvas.height = rect.height - 4;
        
        // 计算合适的格子大小
        this.cellSize = Math.min(
            (this.canvas.width - 40) / this.mazeSize,
            (this.canvas.height - 40) / this.mazeSize
        );
        
        this.player.size = this.cellSize * 0.6;
    }
    
    async setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 创建3D音频环境
            this.spatialAudio = {
                listener: this.audioContext.listener,
                panners: []
            };
            
            // 设置监听器位置
            if (this.spatialAudio.listener.positionX) {
                this.spatialAudio.listener.positionX.value = 0;
                this.spatialAudio.listener.positionY.value = 0;
                this.spatialAudio.listener.positionZ.value = 0;
            }
            
        } catch (error) {
            console.warn('Audio setup failed:', error);
        }
    }
    
    setupControls() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            this.handleKeyPress(e.key);
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
        
        // 触摸控制
        const controlBtns = document.querySelectorAll('.control-btn');
        controlBtns.forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const direction = btn.dataset.direction;
                if (direction) {
                    this.handleMovement(direction);
                }
            });
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const direction = btn.dataset.direction;
                if (direction) {
                    this.handleMovement(direction);
                }
            });
        });
    }
    
    setupScreens() {
        // 开始按钮
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // 帮助按钮
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showScreen('help');
        });
        
        // 返回按钮
        document.getElementById('backBtn').addEventListener('click', () => {
            this.showScreen('title');
        });
        
        // 重新开始按钮
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });
        
        // 菜单按钮
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.resetGame();
            this.showScreen('title');
        });
        
        // 暂停按钮
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });
    }
    
    showScreen(screenName) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));
        
        const targetScreen = document.getElementById(screenName + 'Screen');
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
        
        this.gameState = screenName;
    }
    
    async startGame() {
        this.showScreen('game');
        this.gameState = 'playing';
        
        // 启动音频上下文
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        this.resetGame();
        this.updateHUD();
    }
    
    resetGame() {
        this.score = 0;
        this.level = 1;
        this.energy = 100;
        this.player = { x: 1, y: 1, size: this.cellSize * 0.6 };
        this.playerTrail = [];
        this.lastBeatTime = Date.now();
        this.lastTrailUpdate = Date.now();
        this.lastMazeChange = Date.now();
        this.mazePhase = 0;
        this.generateMaze();
    }
    
    generateMaze() {
        // 初始化迷宫
        this.maze = Array(this.mazeSize).fill().map(() => Array(this.mazeSize).fill(1));
        
        // 生成迷宫路径（使用深度优先搜索）
        this.carveMaze(1, 1);
        
        // 设置起点和终点
        this.maze[1][1] = 0;
        this.maze[this.mazeSize - 2][this.mazeSize - 2] = 0;
        
        // 添加时空元素
        this.generateTimeElements();
        
        // 生成隐藏路径
        this.generateHiddenPaths();
        
        // 更新目标位置
        this.target = { x: this.mazeSize - 2, y: this.mazeSize - 2 };
    }
    
    carveMaze(x, y) {
        const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
        this.shuffleArray(directions);
        
        this.maze[y][x] = 0;
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx > 0 && nx < this.mazeSize - 1 && 
                ny > 0 && ny < this.mazeSize - 1 && 
                this.maze[ny][nx] === 1) {
                
                this.maze[y + dy / 2][x + dx / 2] = 0;
                this.carveMaze(nx, ny);
            }
        }
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    generateTimeElements() {
        // 时空扭曲点
        this.obstacles = [];
        for (let i = 0; i < 5; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * (this.mazeSize - 2)) + 1;
                y = Math.floor(Math.random() * (this.mazeSize - 2)) + 1;
            } while (this.maze[y][x] !== 0 || (x === 1 && y === 1) || 
                     (x === this.mazeSize - 2 && y === this.mazeSize - 2));
            
            this.obstacles.push({
                x, y,
                type: 'timeWarp',
                rotation: 0,
                intensity: Math.random() * 0.5 + 0.5
            });
        }
    }
    
    generateHiddenPaths() {
        // 生成需要音频提示的隐藏通道
        this.hiddenPaths = [];
        
        for (let y = 1; y < this.mazeSize - 1; y++) {
            for (let x = 1; x < this.mazeSize - 1; x++) {
                if (this.maze[y][x] === 1 && Math.random() < 0.1) {
                    // 检查是否可以创建隐藏通道
                    const neighbors = [
                        this.maze[y-1] && this.maze[y-1][x],
                        this.maze[y+1] && this.maze[y+1][x],
                        this.maze[y][x-1],
                        this.maze[y][x+1]
                    ];
                    
                    const openNeighbors = neighbors.filter(n => n === 0).length;
                    if (openNeighbors >= 2) {
                        this.hiddenPaths.push({
                            x, y,
                            discovered: false,
                            audioFreq: 220 + Math.random() * 440
                        });
                    }
                }
            }
        }
        
        this.setupSpatialAudio();
    }
    
    setupSpatialAudio() {
        if (!this.audioContext) return;
        
        // 为每个隐藏路径创建3D音频源
        this.spatialAudio.panners = [];
        
        this.hiddenPaths.forEach((path, index) => {
            const panner = this.audioContext.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = 10;
            panner.rolloffFactor = 1;
            
            // 设置3D位置
            const worldX = (path.x - this.mazeSize / 2) * 2;
            const worldZ = (path.y - this.mazeSize / 2) * 2;
            
            if (panner.positionX) {
                panner.positionX.value = worldX;
                panner.positionY.value = 0;
                panner.positionZ.value = worldZ;
            }
            
            this.spatialAudio.panners.push(panner);
        });
    }
    
    handleKeyPress(key) {
        if (this.gameState !== 'playing') return;
        
        switch (key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.handleMovement('up');
                break;
            case 's':
            case 'arrowdown':
                this.handleMovement('down');
                break;
            case 'a':
            case 'arrowleft':
                this.handleMovement('left');
                break;
            case 'd':
            case 'arrowright':
                this.handleMovement('right');
                break;
            case ' ':
                this.togglePause();
                break;
        }
    }
    
    handleMovement(direction) {
        if (this.gameState !== 'playing') return;
        
        const currentTime = Date.now();
        
        // 检查节拍同步
        const timeSinceLastBeat = (currentTime - this.lastBeatTime) % this.beatInterval;
        const isBeatTime = timeSinceLastBeat < this.beatTolerance || 
                          timeSinceLastBeat > this.beatInterval - this.beatTolerance;
        
        if (!isBeatTime) {
            this.energy -= 10;
            this.playErrorSound();
            this.updateHUD();
            
            if (this.energy <= 0) {
                this.gameOver('节拍失调！');
                return;
            }
        }
        
        const newPos = { ...this.player };
        
        switch (direction) {
            case 'up':
                newPos.y--;
                break;
            case 'down':
                newPos.y++;
                break;
            case 'left':
                newPos.x--;
                break;
            case 'right':
                newPos.x++;
                break;
        }
        
        // 检查移动有效性
        if (this.isValidMove(newPos.x, newPos.y)) {
            this.player = newPos;
            this.addToTrail();
            this.playMoveSound();
            this.updateListenerPosition();
            
            // 检查隐藏路径发现
            this.checkHiddenPathDiscovery();
            
            // 检查是否到达终点
            if (this.player.x === this.target.x && this.player.y === this.target.y) {
                this.levelComplete();
            }
            
            this.score += isBeatTime ? 10 : 5;
            this.updateHUD();
        }
    }
    
    isValidMove(x, y) {
        // 边界检查
        if (x < 0 || x >= this.mazeSize || y < 0 || y >= this.mazeSize) {
            return false;
        }
        
        // 墙壁检查
        if (this.maze[y][x] === 1) {
            // 检查是否是已发现的隐藏路径
            const hiddenPath = this.hiddenPaths.find(p => p.x === x && p.y === y && p.discovered);
            return hiddenPath !== undefined;
        }
        
        return true;
    }
    
    addToTrail() {
        const currentTime = Date.now();
        
        if (currentTime - this.lastTrailUpdate > this.trailUpdateInterval) {
            this.playerTrail.push({
                x: this.player.x,
                y: this.player.y,
                time: currentTime,
                alpha: 1.0
            });
            
            // 限制轨迹长度
            if (this.playerTrail.length > this.maxTrailLength) {
                this.playerTrail.shift();
            }
            
            this.lastTrailUpdate = currentTime;
        }
    }
    
    updateListenerPosition() {
        if (!this.spatialAudio.listener) return;
        
        const worldX = (this.player.x - this.mazeSize / 2) * 2;
        const worldZ = (this.player.y - this.mazeSize / 2) * 2;
        
        if (this.spatialAudio.listener.positionX) {
            this.spatialAudio.listener.positionX.value = worldX;
            this.spatialAudio.listener.positionZ.value = worldZ;
        }
    }
    
    checkHiddenPathDiscovery() {
        const playerWorldX = (this.player.x - this.mazeSize / 2) * 2;
        const playerWorldZ = (this.player.y - this.mazeSize / 2) * 2;
        
        this.hiddenPaths.forEach((path, index) => {
            if (!path.discovered) {
                const pathWorldX = (path.x - this.mazeSize / 2) * 2;
                const pathWorldZ = (path.y - this.mazeSize / 2) * 2;
                
                const distance = Math.sqrt(
                    Math.pow(playerWorldX - pathWorldX, 2) + 
                    Math.pow(playerWorldZ - pathWorldZ, 2)
                );
                
                // 如果玩家足够接近，发现隐藏路径
                if (distance < 3) {
                    path.discovered = true;
                    this.score += 50;
                    this.playDiscoverySound(path.audioFreq);
                }
            }
        });
    }
    
    levelComplete() {
        this.level++;
        this.score += 100 * this.level;
        this.energy = Math.min(100, this.energy + 25);
        
        // 增加难度
        this.beatInterval = Math.max(500, this.beatInterval - 50);
        this.mazeChangeCycle = Math.max(8000, this.mazeChangeCycle - 1000);
        
        this.generateMaze();
        this.player = { x: 1, y: 1, size: this.cellSize * 0.6 };
        this.playerTrail = [];
        
        this.updateHUD();
    }
    
    gameOver(reason) {
        this.gameState = 'gameOver';
        document.getElementById('gameOverTitle').textContent = reason;
        document.getElementById('finalScore').textContent = `最终得分: ${this.score}`;
        document.getElementById('levelReached').textContent = `到达关卡: ${this.level}`;
        this.showScreen('gameOver');
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseBtn').textContent = '继续';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseBtn').textContent = '暂停';
        }
    }
    
    updateHUD() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('energy').textContent = this.energy;
    }
    
    // 音频播放函数
    playMoveSound() {
        // 简单的合成音效
        if (this.audioContext) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 440;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        }
    }
    
    playErrorSound() {
        if (this.audioContext) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 150;
            oscillator.type = 'sawtooth';
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        }
    }
    
    playDiscoverySound(frequency) {
        if (this.audioContext) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'triangle';
            
            gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.5);
        }
    }
    
    // 渲染系统
    render() {
        if (!this.ctx || this.gameState !== 'playing') return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 计算偏移以居中迷宫
        const offsetX = (this.canvas.width - this.mazeSize * this.cellSize) / 2;
        const offsetY = (this.canvas.height - this.mazeSize * this.cellSize) / 2;
        
        // 渲染迷宫
        this.renderMaze(offsetX, offsetY);
        
        // 渲染时空元素
        this.renderTimeElements(offsetX, offsetY);
        
        // 渲染隐藏路径
        this.renderHiddenPaths(offsetX, offsetY);
        
        // 渲染玩家轨迹
        this.renderPlayerTrail(offsetX, offsetY);
        
        // 渲染玩家
        this.renderPlayer(offsetX, offsetY);
        
        // 渲染目标
        this.renderTarget(offsetX, offsetY);
        
        // 渲染特效
        this.renderEffects(offsetX, offsetY);
    }
    
    renderMaze(offsetX, offsetY) {
        this.ctx.strokeStyle = '#40e0d0';
        this.ctx.lineWidth = 2;
        
        for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
                const posX = offsetX + x * this.cellSize;
                const posY = offsetY + y * this.cellSize;
                
                if (this.maze[y][x] === 1) {
                    // 墙壁
                    const gradient = this.ctx.createLinearGradient(
                        posX, posY, posX + this.cellSize, posY + this.cellSize
                    );
                    gradient.addColorStop(0, '#1a1a2e');
                    gradient.addColorStop(1, '#16213e');
                    
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(posX, posY, this.cellSize, this.cellSize);
                    this.ctx.strokeRect(posX, posY, this.cellSize, this.cellSize);
                } else {
                    // 通道
                    this.ctx.fillStyle = 'rgba(64, 224, 208, 0.05)';
                    this.ctx.fillRect(posX, posY, this.cellSize, this.cellSize);
                }
            }
        }
    }
    
    renderTimeElements(offsetX, offsetY) {
        const currentTime = Date.now();
        
        this.obstacles.forEach(obstacle => {
            const posX = offsetX + obstacle.x * this.cellSize + this.cellSize / 2;
            const posY = offsetY + obstacle.y * this.cellSize + this.cellSize / 2;
            
            this.ctx.save();
            this.ctx.translate(posX, posY);
            this.ctx.rotate(obstacle.rotation);
            
            // 时空扭曲效果
            const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.cellSize / 2);
            gradient.addColorStop(0, `rgba(186, 85, 211, ${obstacle.intensity})`);
            gradient.addColorStop(0.5, `rgba(138, 43, 226, ${obstacle.intensity * 0.5})`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.cellSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 旋转效果
            obstacle.rotation += 0.05;
            
            this.ctx.restore();
        });
    }
    
    renderHiddenPaths(offsetX, offsetY) {
        this.hiddenPaths.forEach(path => {
            const posX = offsetX + path.x * this.cellSize;
            const posY = offsetY + path.y * this.cellSize;
            
            if (path.discovered) {
                // 已发现的隐藏路径
                this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                this.ctx.fillRect(posX, posY, this.cellSize, this.cellSize);
                
                // 闪烁效果
                const alpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.005);
                this.ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
                this.ctx.fillRect(posX + 5, posY + 5, this.cellSize - 10, this.cellSize - 10);
            } else {
                // 未发现的隐藏路径（微弱提示）
                const playerDistance = Math.sqrt(
                    Math.pow(this.player.x - path.x, 2) + 
                    Math.pow(this.player.y - path.y, 2)
                );
                
                if (playerDistance < 3) {
                    const alpha = Math.max(0, (3 - playerDistance) / 3) * 0.2;
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    this.ctx.fillRect(posX, posY, this.cellSize, this.cellSize);
                }
            }
        });
    }
    
    renderPlayerTrail(offsetX, offsetY) {
        const currentTime = Date.now();
        
        this.playerTrail = this.playerTrail.filter(trail => {
            const age = currentTime - trail.time;
            trail.alpha = Math.max(0, 1 - age / 2000); // 2秒内消失
            return trail.alpha > 0;
        });
        
        this.playerTrail.forEach((trail, index) => {
            const posX = offsetX + trail.x * this.cellSize + this.cellSize / 2;
            const posY = offsetY + trail.y * this.cellSize + this.cellSize / 2;
            
            this.ctx.fillStyle = `rgba(64, 224, 208, ${trail.alpha * 0.5})`;
            this.ctx.beginPath();
            this.ctx.arc(posX, posY, this.player.size / 2 * trail.alpha, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    renderPlayer(offsetX, offsetY) {
        const posX = offsetX + this.player.x * this.cellSize + this.cellSize / 2;
        const posY = offsetY + this.player.y * this.cellSize + this.cellSize / 2;
        
        // 玩家光环效果
        const gradient = this.ctx.createRadialGradient(posX, posY, 0, posX, posY, this.player.size);
        gradient.addColorStop(0, '#40e0d0');
        gradient.addColorStop(0.7, 'rgba(64, 224, 208, 0.8)');
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(posX, posY, this.player.size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 玩家核心
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(posX, posY, this.player.size / 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    renderTarget(offsetX, offsetY) {
        const posX = offsetX + this.target.x * this.cellSize + this.cellSize / 2;
        const posY = offsetY + this.target.y * this.cellSize + this.cellSize / 2;
        
        // 目标动画效果
        const pulseScale = 1 + 0.3 * Math.sin(Date.now() * 0.01);
        const targetSize = this.cellSize / 2 * pulseScale;
        
        const gradient = this.ctx.createRadialGradient(posX, posY, 0, posX, posY, targetSize);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, 'rgba(255, 107, 107, 0.6)');
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(posX, posY, targetSize, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    renderEffects(offsetX, offsetY) {
        // 节拍指示效果
        const currentTime = Date.now();
        const beatProgress = ((currentTime - this.lastBeatTime) % this.beatInterval) / this.beatInterval;
        
        if (beatProgress > 0.8) {
            const alpha = (1 - beatProgress) * 5; // 在节拍时闪烁
            this.ctx.fillStyle = `rgba(64, 224, 208, ${alpha * 0.1})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        const currentTime = Date.now();
        
        // 更新节拍
        this.updateBeat(currentTime);
        
        // 更新迷宫重构
        this.updateMazeReconstruction(currentTime);
        
        // 更新特效
        this.updateEffects(currentTime);
    }
    
    updateBeat(currentTime) {
        if (currentTime - this.lastBeatTime >= this.beatInterval) {
            this.lastBeatTime = currentTime;
        }
    }
    
    updateMazeReconstruction(currentTime) {
        if (currentTime - this.lastMazeChange >= this.mazeChangeCycle) {
            this.lastMazeChange = currentTime;
            this.mazePhase++;
            
            // 保存玩家位置周围的路径
            this.partialMazeReconstruction();
        }
    }
    
    partialMazeReconstruction() {
        // 只重构远离玩家的区域
        for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
                const distance = Math.sqrt(
                    Math.pow(x - this.player.x, 2) + 
                    Math.pow(y - this.player.y, 2)
                );
                
                if (distance > 5 && Math.random() < 0.1) {
                    // 随机改变远处的墙壁/通道
                    if (this.maze[y][x] === 1 && this.canToggleCell(x, y)) {
                        this.maze[y][x] = 0;
                    } else if (this.maze[y][x] === 0 && this.canToggleCell(x, y)) {
                        this.maze[y][x] = 1;
                    }
                }
            }
        }
    }
    
    canToggleCell(x, y) {
        // 检查切换这个格子是否会阻断路径
        if (x === 1 && y === 1) return false; // 起点
        if (x === this.target.x && y === this.target.y) return false; // 终点
        
        // 简单检查，避免完全阻断
        const neighbors = [
            this.maze[y-1] && this.maze[y-1][x],
            this.maze[y+1] && this.maze[y+1][x],
            this.maze[y][x-1],
            this.maze[y][x+1]
        ].filter(n => n !== undefined);
        
        const openNeighbors = neighbors.filter(n => n === 0).length;
        return openNeighbors >= 2;
    }
    
    updateEffects(currentTime) {
        // 更新时空扭曲效果
        this.obstacles.forEach(obstacle => {
            obstacle.intensity = 0.5 + 0.3 * Math.sin(currentTime * 0.003 + obstacle.x + obstacle.y);
        });
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new TimeEchoMaze();
});