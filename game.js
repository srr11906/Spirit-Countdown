(function () {
    const playBtn = document.getElementById("play-btn");
    const gameModal = document.getElementById("game-modal");
    const closeGame = document.getElementById("close-game");
    const canvas = document.getElementById("dino-canvas");
    const gameContainer = document.querySelector(".game-container");

    if (!canvas || !gameModal) return;

    const ctx = canvas.getContext("2d");

    let audioCtx = null;
    function playBeep(freq, type, duration, delay) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === "suspended") {
                audioCtx.resume();
            }
            const startTime = audioCtx.currentTime + (delay || 0);
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.08, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        } catch (e) {}
    }

    let isNight = false;

    const GROUND_Y = 210;
    const GRAVITY = 0.58;
    const JUMP_VEL = -12.2;
    const INITIAL_SPEED = 6.2;
    const MAX_SPEED = 14.0;
    const ACCELERATION = 0.003;

    let gameState = "IDLE";
    let speed = INITIAL_SPEED;
    let score = 0;
    let distance = 0;
    let highScore = parseInt(localStorage.getItem("offline_runner_hi") || "0", 10);
    let flashTimer = 0;
    let canRestartTime = 0;

    let animFrame = null;
    let lastTimestamp = 0;

    const prabhasImg = new Image();
    let prabhasLoaded = false;
    let prabhasNightCanvas = null;

    function initNightCanvas() {
        try {
            prabhasNightCanvas = document.createElement("canvas");
            prabhasNightCanvas.width = prabhasImg.naturalWidth;
            prabhasNightCanvas.height = prabhasImg.naturalHeight;
            const nCtx = prabhasNightCanvas.getContext("2d");
            nCtx.drawImage(prabhasImg, 0, 0);
            const imgData = nCtx.getImageData(0, 0, prabhasNightCanvas.width, prabhasNightCanvas.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] > 20) {
                    d[i] = 255 - d[i];
                    d[i + 1] = 255 - d[i + 1];
                    d[i + 2] = 255 - d[i + 2];
                }
            }
            nCtx.putImageData(imgData, 0, 0);
        } catch (e) {}
    }

    prabhasImg.onload = () => {
        prabhasLoaded = true;
        initNightCanvas();
    };
    prabhasImg.src = "assets/20261019_153220.png";

    const dino = {
        x: 50,
        y: GROUND_Y - 64,
        width: 30,
        height: 64,
        vy: 0,
        jumping: false,
        legStep: 0,
        reset() {
            this.x = 50;
            this.y = GROUND_Y - 64;
            this.width = 30;
            this.height = 64;
            this.vy = 0;
            this.jumping = false;
            this.legStep = 0;
        },
        jump() {
            if (!this.jumping) {
                this.jumping = true;
                this.vy = JUMP_VEL;
                this.height = 64;
                this.width = 30;
                playBeep(480, "square", 0.08);
            }
        },
        update(step) {
            if (this.jumping) {
                this.vy += GRAVITY * step;
                this.y += this.vy * step;
                if (this.y >= GROUND_Y - 64) {
                    this.y = GROUND_Y - 64;
                    this.jumping = false;
                    this.vy = 0;
                }
            } else {
                this.legStep += step;
                if (this.legStep > 12) this.legStep = 0;
            }
        }
    };

    let obstacles = [];
    let nextSpawnDistance = 0;

    function getMinDistance() {
        const breathingRoom = Math.max(0, 160 - score * 0.18);
        return 260 + speed * 15 + Math.random() * (120 + breathingRoom);
    }

    function spawnObstacle() {
        const stage = score < 120 ? 1 : (score < 280 ? 2 : (score < 450 ? 3 : 4));
        const rand = Math.random();

        let birdChance = 0;
        if (stage === 2) birdChance = 0.32;
        else if (stage === 3) birdChance = 0.40;
        else if (stage >= 4) birdChance = 0.46;

        if (stage >= 2 && rand < birdChance) {
            let altitudes;
            if (stage === 2) {
                altitudes = [GROUND_Y - 32, GROUND_Y - 65];
            } else {
                altitudes = [GROUND_Y - 32, GROUND_Y - 65, GROUND_Y - 120];
            }
            const chosenAlt = altitudes[Math.floor(Math.random() * altitudes.length)];
            obstacles.push({
                type: "BIRD",
                x: 820,
                y: chosenAlt,
                width: 42,
                height: 28,
                frame: 0
            });
        } else {
            const isSmall = stage === 1 ? (Math.random() < 0.72) : (Math.random() < 0.52);
            if (isSmall) {
                let count = 1;
                if (stage >= 3 && Math.random() < 0.18) {
                    count = 3;
                } else if (stage >= 2 && Math.random() < 0.35) {
                    count = 2;
                } else if (stage === 1 && score > 60 && Math.random() < 0.22) {
                    count = 2;
                }
                obstacles.push({
                    type: "SMALL_CACTUS",
                    x: 820,
                    y: GROUND_Y - 34,
                    width: 17 * count + (count - 1) * 4,
                    height: 34,
                    count: count
                });
            } else {
                let count = 1;
                if (stage >= 3 && Math.random() < 0.28) {
                    count = 2;
                }
                obstacles.push({
                    type: "LARGE_CACTUS",
                    x: 820,
                    y: GROUND_Y - 48,
                    width: 23 * count + (count - 1) * 5,
                    height: 48,
                    count: count
                });
            }
        }
    }

    let clouds = [
        { x: 180, y: 48, speed: 0.7 },
        { x: 460, y: 72, speed: 0.5 },
        { x: 720, y: 38, speed: 0.8 }
    ];

    let groundX = 0;

    function resetGame() {
        dino.reset();
        obstacles = [];
        speed = INITIAL_SPEED;
        score = 0;
        distance = 0;
        nextSpawnDistance = 280;
        flashTimer = 0;
        isNight = false;
        gameState = "RUNNING";
    }

    function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    function checkCollision(obstacle) {
        const dx1 = dino.x + 8;
        const dy1 = dino.y + 4;
        const dw1 = 16;
        const dh1 = 30;

        const dx2 = dino.x + 2;
        const dy2 = dino.y + 34;
        const dw2 = 26;
        const dh2 = dino.jumping ? 18 : 28;

        if (obstacle.type === "BIRD") {
            const ox = obstacle.x;
            const oy = obstacle.y;
            const wingUp = (obstacle.frame % 16) < 8;

            if (rectsOverlap(dx1, dy1, dw1, dh1, ox + 8, oy + 8, 24, 12) ||
                rectsOverlap(dx2, dy2, dw2, dh2, ox + 8, oy + 8, 24, 12)) {
                return true;
            }

            const wingY = oy + (wingUp ? 0 : 14);
            if (rectsOverlap(dx1, dy1, dw1, dh1, ox + 14, wingY, 10, 12) ||
                rectsOverlap(dx2, dy2, dw2, dh2, ox + 14, wingY, 10, 12)) {
                return true;
            }
        } else {
            const ox = obstacle.x + 3;
            const oy = obstacle.y + 4;
            const ow = obstacle.width - 6;
            const oh = obstacle.height - 4;

            if (rectsOverlap(dx1, dy1, dw1, dh1, ox, oy, ow, oh) ||
                rectsOverlap(dx2, dy2, dw2, dh2, ox, oy, ow, oh)) {
                return true;
            }
        }
        return false;
    }

    function drawDino() {
        const x = dino.x;
        const y = dino.y;
        const w = dino.width;
        const h = dino.height;

        const imgToDraw = (isNight && prabhasNightCanvas) ? prabhasNightCanvas : prabhasImg;

        if (prabhasLoaded || (prabhasImg.complete && prabhasImg.naturalWidth > 0)) {
            ctx.save();
            if (gameState === "DEAD") {
                ctx.translate(x + w / 2, y + h / 2);
                ctx.rotate(-0.35);
                ctx.drawImage(imgToDraw, -w / 2, -h / 2, w, h);
                ctx.restore();
                ctx.fillStyle = "rgb(231, 2, 47)";
                ctx.fillRect(x + w / 2 - 3, y + h / 2 - 3, 6, 6);
                return;
            }

            if (dino.jumping) {
                ctx.translate(x + w / 2, y + h / 2);
                ctx.rotate(0.08);
                ctx.drawImage(imgToDraw, -w / 2, -h / 2, w, h);
                ctx.restore();
                return;
            }

            const bob = Math.sin((dino.legStep / 12) * Math.PI * 2) * 1.5;
            const lean = Math.sin((dino.legStep / 12) * Math.PI * 2) * 0.02;

            ctx.translate(x + w / 2, y + h / 2 + bob);
            ctx.rotate(lean);
            ctx.drawImage(imgToDraw, -w / 2, -h / 2, w, h);
            ctx.restore();
        } else {
            ctx.fillStyle = isNight ? "#ffffff" : "#000000";
            ctx.fillRect(x, y, w, h);
        }
    }

    function drawCactus(ob) {
        ctx.fillStyle = "rgb(231, 2, 47)";
        const count = ob.count || 1;
        const singleW = (ob.width - (count - 1) * 5) / count;

        for (let i = 0; i < count; i++) {
            const bx = ob.x + i * (singleW + 5);
            const by = ob.y;
            const bw = singleW;
            const bh = ob.height;

            ctx.fillRect(bx + bw * 0.35, by, bw * 0.3, bh);
            ctx.fillRect(bx, by + bh * 0.25, bw * 0.35, bh * 0.14);
            ctx.fillRect(bx, by + bh * 0.12, bw * 0.18, bh * 0.22);
            ctx.fillRect(bx + bw * 0.65, by + bh * 0.38, bw * 0.35, bh * 0.14);
            ctx.fillRect(bx + bw * 0.82, by + bh * 0.22, bw * 0.18, bh * 0.24);
        }
    }

    function drawBird(ob) {
        ctx.fillStyle = "rgb(231, 2, 47)";
        const x = ob.x;
        const y = ob.y;

        ctx.fillRect(x + 10, y + 8, 20, 8);
        ctx.fillRect(x + 26, y + 4, 12, 10);
        ctx.fillRect(x + 38, y + 8, 6, 3);
        ctx.fillRect(x, y + 10, 10, 4);

        const wingUp = (ob.frame % 16) < 8;

        if (wingUp) {
            ctx.fillRect(x + 14, y, 6, 10);
            ctx.fillRect(x + 18, y - 6, 6, 8);
        } else {
            ctx.fillRect(x + 14, y + 14, 6, 10);
            ctx.fillRect(x + 18, y + 20, 6, 8);
        }
    }

    function drawCloud(c) {
        ctx.fillStyle = isNight ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)";
        ctx.fillRect(c.x, c.y, 40, 10);
        ctx.fillRect(c.x + 8, c.y - 6, 24, 8);
        ctx.fillRect(c.x + 14, c.y - 10, 12, 6);
    }

    function drawGround() {
        const color = isNight ? "#ffffff" : "#000000";
        ctx.fillStyle = color;
        ctx.fillRect(0, GROUND_Y, 800, 2);

        for (let i = 0; i < 800; i += 40) {
            const rx = (i - (groundX % 40) + 800) % 800;
            ctx.fillRect(rx, GROUND_Y + 5, 12, 2);
            ctx.fillRect(rx + 18, GROUND_Y + 9, 6, 2);
        }
    }

    function drawScore() {
        ctx.font = "bold 16px Arial, sans-serif";
        ctx.textAlign = "right";

        const textColor = isNight ? "#ffffff" : "#000000";
        const crimson = "rgb(231, 2, 47)";

        ctx.fillStyle = crimson;
        ctx.fillText("HI " + String(highScore).padStart(5, "0"), 710, 28);

        if (flashTimer % 10 < 5) {
            ctx.fillStyle = textColor;
            ctx.fillText(String(score).padStart(5, "0"), 780, 28);
        }
    }

    function update(step) {
        if (gameState !== "RUNNING") return;

        const targetSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + score * 0.0085);
        if (speed < targetSpeed) {
            speed += ACCELERATION * step;
            if (speed > targetSpeed) speed = targetSpeed;
        }

        distance += speed * step;
        const prevScore = score;
        score = Math.floor(distance / 8);

        if (Math.floor(score / 100) > Math.floor(prevScore / 100)) {
            playBeep(980, "square", 0.06);
            playBeep(1320, "square", 0.1, 0.07);
            flashTimer = 40;
        }

        if (flashTimer > 0) flashTimer--;

        const cycle = Math.floor(score / 400);
        isNight = cycle % 2 === 1;

        dino.update(step);

        groundX = (groundX + speed * step) % 800;

        for (let i = 0; i < clouds.length; i++) {
            clouds[i].x -= clouds[i].speed * step;
            if (clouds[i].x < -60) {
                clouds[i].x = 840 + Math.random() * 80;
                clouds[i].y = 30 + Math.random() * 60;
            }
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= speed * step;
            if (obstacles[i].type === "BIRD") {
                obstacles[i].frame += step;
            }

            if (checkCollision(obstacles[i])) {
                gameState = "DEAD";
                canRestartTime = Date.now() + 350;
                playBeep(180, "sawtooth", 0.18);
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem("offline_runner_hi", highScore);
                }
                return;
            }

            if (obstacles[i].x + obstacles[i].width < -10) {
                obstacles.splice(i, 1);
            }
        }

        nextSpawnDistance -= speed * step;
        if (nextSpawnDistance <= 0) {
            spawnObstacle();
            nextSpawnDistance = getMinDistance();
        }
    }

    function render() {
        ctx.fillStyle = isNight ? "#000000" : "#ffffff";
        ctx.fillRect(0, 0, 800, 250);

        for (let i = 0; i < clouds.length; i++) {
            drawCloud(clouds[i]);
        }

        drawGround();

        for (let i = 0; i < obstacles.length; i++) {
            if (obstacles[i].type === "BIRD") {
                drawBird(obstacles[i]);
            } else {
                drawCactus(obstacles[i]);
            }
        }

        drawDino();
        drawScore();

        if (gameState === "IDLE") {
            ctx.fillStyle = isNight ? "#ffffff" : "#000000";
            ctx.font = "bold 18px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("PRESS JUMP OR TAP TO START", 400, 110);
            ctx.fillStyle = "rgb(231, 2, 47)";
            ctx.font = "bold 13px Arial, sans-serif";
            ctx.fillText("#ONEBADHABIT • MARCHING ON OCTOBER 29, 2027", 400, 140);
        } else if (gameState === "DEAD") {
            ctx.fillStyle = "rgb(231, 2, 47)";
            ctx.font = "900 24px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("G A M E  O V E R", 400, 105);

            ctx.fillStyle = isNight ? "#ffffff" : "#000000";
            ctx.font = "bold 14px Arial, sans-serif";
            ctx.fillText("PRESS JUMP OR TAP TO RESTART", 400, 140);
        }
    }

    function loop(timestamp) {
        if (!gameModal.hidden) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const dt = timestamp - lastTimestamp;
            lastTimestamp = timestamp;
            const step = Math.min(Math.max(dt / 16.667, 0.5), 2.0);

            update(step);
            render();
            animFrame = requestAnimationFrame(loop);
        }
    }

    function handleJumpPress() {
        if (gameState === "IDLE") {
            resetGame();
            dino.jump();
        } else if (gameState === "DEAD") {
            if (Date.now() >= canRestartTime) {
                resetGame();
                dino.jump();
            }
        } else if (gameState === "RUNNING") {
            dino.jump();
        }
    }

    function stopGame() {
        gameModal.hidden = true;
        if (animFrame) {
            cancelAnimationFrame(animFrame);
            animFrame = null;
        }
        lastTimestamp = 0;
    }

    window.addEventListener("keydown", (e) => {
        if (gameModal.hidden) return;

        if (e.code === "Space" || e.code === "ArrowUp") {
            e.preventDefault();
            handleJumpPress();
        } else if (e.code === "Escape") {
            e.preventDefault();
            stopGame();
        }
    });

    if (gameContainer) {
        gameContainer.addEventListener("pointerdown", (e) => {
            if (e.target.closest("#close-game")) {
                return;
            }
            e.preventDefault();
            handleJumpPress();
        });
    }

    if (playBtn) {
        playBtn.addEventListener("click", () => {
            gameModal.hidden = false;
            if (gameState === "IDLE" || gameState === "DEAD") {
                gameState = "IDLE";
                dino.reset();
                obstacles = [];
                isNight = false;
            }
            lastTimestamp = 0;
            render();
            if (animFrame) cancelAnimationFrame(animFrame);
            animFrame = requestAnimationFrame(loop);
        });
    }

    if (closeGame) {
        closeGame.addEventListener("click", stopGame);
    }

    gameModal.addEventListener("click", (e) => {
        if (e.target === gameModal) {
            stopGame();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            lastTimestamp = 0;
        }
    });
})();
