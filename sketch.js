
let gameState = 'START'; // 'START' | 'FIGHT' | 'KO'
let mic;
let micStarted = false;
let rawMicLevel = 0;
let smoothMicLevel = 0;
let noiseFloor = 0.015; // Calibración base de ruido ambiente
let visualEnergy = 0;   // Energía visual acumulada (0 a 1)

// Control de Hit-Stop (congelamiento breve para peso de impacto) y Screen Shake
let hitStopFrames = 0;
let shakeAmount = 0;
let flashWhiteFrames = 0;

// Instancias principales
let ring;
let audience;
let userFighter;
let rivalFighter;
let particleSystem;
let dustMotes = [];

// Control de ganancia / sensibilidad del micrófono (ajustable en tiempo real)
let micSensitivity = 4.5;
let btnSensDownEl;
let btnSensUpEl;
let sensValueEl;

// Temporizador y ganador de KO
let koTimer = 0;
let winner = null;

// Elementos del DOM vinculados al HUD
let introScreenEl;
let btnStartEl;
let hudAudioEl;
let hudMeterFillEl;
let hudTierLabelEl;

// ============================================================================
// CONFIGURACIÓN INICIAL (p5.js setup)
// ============================================================================
function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  frameRate(60);
  imageMode(CENTER);

  // Vincular elementos de la interfaz DOM
  introScreenEl = document.getElementById('intro-screen');
  btnStartEl = document.getElementById('btn-start');
  hudAudioEl = document.getElementById('hud-audio');
  hudMeterFillEl = document.getElementById('hud-meter-fill');
  hudTierLabelEl = document.getElementById('hud-tier-label');
  btnSensDownEl = document.getElementById('btn-sens-down');
  btnSensUpEl = document.getElementById('btn-sens-up');
  sensValueEl = document.getElementById('sens-value');

  // Listeners para botones de sensibilidad
  if (btnSensDownEl) {
    btnSensDownEl.addEventListener('click', (e) => {
      e.stopPropagation();
      changeSensitivity(-0.5);
    });
  }
  if (btnSensUpEl) {
    btnSensUpEl.addEventListener('click', (e) => {
      e.stopPropagation();
      changeSensitivity(0.5);
    });
  }

  // Inicializar componentes del ring, público y partículas
  ring = new Ring();
  audience = new Audience();
  particleSystem = new ParticleSystem();

  // Crear partículas de polvo atmosférico en los focos de luz
  for (let i = 0; i < 45; i++) {
    dustMotes.push(new DustMote());
  }

  // Posiciones base de los boxeadores según dimensiones iniciales
  initFighters();

  // Escucha de interacción para activar el micrófono de forma compatible con navegadores
  btnStartEl.addEventListener('click', onStartCombat);
}

/**
 * Permite subir o bajar la ganancia del micrófono en tiempo real
 */
function changeSensitivity(delta) {
  micSensitivity = constrain(round((micSensitivity + delta) * 10) / 10, 1.0, 15.0);
  if (sensValueEl) {
    sensValueEl.textContent = 'x' + micSensitivity.toFixed(1);
  }
}

/**
 * Inicializa o reubica a los boxeadores en el ring
 */
function initFighters() {
  const floorY = height * 0.81;
  const centerX = width * 0.5;
  const separation = min(width * 0.25, 290);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ROCKY BALBOA — El Semental Italiano de Filadelfia
  // Shorts americanos (rojo/blanco/azul), guantes rojos,
  // piel oliva, nariz partida, pelo rizado oscuro.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  userFighter = new Fighter({
    x: centerX - separation,
    y: floorY,
    facing: 1,
    name: "ROCKY BALBOA",
    style: 'ROCKY',
    colorTheme: {
      gloves:    color(220, 30, 30),    // Guantes rojos clásicos de Rocky
      trunks:    color(200, 16, 46),    // Rojo USA bandera americana
      trunksAlt: color(25, 52, 140),    // Franja azul de la bandera
      trunksHL:  color(240, 240, 250),  // Franja blanca central
      skin:      color(205, 155, 100),  // Piel oliva mediterránea
      skinShade: color(160, 112, 68),   // Sombra de músculo curtida
      accent:    color(240, 240, 255),  // Blanco (cinta de boxeo, vendas)
      hairColor: color(22, 14, 8)       // Pelo oscuro rizado de Rocky
    },
    isAutonomous: false
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IVAN DRAGO — La Máquina Soviética de la URSS
  // Shorts rojos soviéticos con estrella dorada, guantes
  // blancos, piel nórdica pálida, pelo rubio flat-top.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  rivalFighter = new Fighter({
    x: centerX + separation,
    y: floorY,
    facing: -1,
    name: "IVAN DRAGO",
    style: 'DRAGO',
    colorTheme: {
      gloves:    color(245, 248, 252),  // Guantes blancos fríos de Drago
      trunks:    color(185, 12, 12),    // Rojo soviético profundo
      trunksAlt: color(30, 30, 36),     // Bordes oscuros de acero
      trunksHL:  color(220, 170, 10),   // Estrella dorada soviética
      skin:      color(230, 200, 165),  // Piel nórdica pálida y fría
      skinShade: color(185, 155, 120),  // Sombra musculosa
      accent:    color(195, 145, 5),    // Dorado soviético (estrella)
      hairColor: color(215, 190, 130)   // Cabello rubio flat-top de Drago
    },
    isAutonomous: true
  });
}

/**
 * Activación del micrófono y transición al combate
 */
function onStartCombat() {
  // Inicialización de p5.sound con audio context habilitado por gesto del usuario
  userStartAudio().then(() => {
    mic = new p5.AudioIn();
    mic.start(() => {
      micStarted = true;
      console.log("Micrófono activado correctamente.");
    }, (err) => {
      console.warn("No se pudo acceder al micrófono:", err);
      // Permitimos que continúe incluso si el usuario bloquea el mic
      micStarted = false;
    });

    // Ocultar pantalla de bienvenida y mostrar HUD
    introScreenEl.classList.add('hidden');
    hudAudioEl.classList.remove('hidden');
    gameState = 'FIGHT';
  }).catch((e) => {
    console.error("Error al iniciar audio:", e);
    introScreenEl.classList.add('hidden');
    hudAudioEl.classList.remove('hidden');
    gameState = 'FIGHT';
  });
}

// ============================================================================
// BUCLE PRINCIPAL DE DIBUJO (p5.js draw)
// ============================================================================
function draw() {
  // Manejo de Hit-stop (congelamiento de frames en impactos contundentes)
  if (hitStopFrames > 0) {
    hitStopFrames--;
    renderScene(); // Dibuja la escena sin actualizar la lógica
    return;
  }

  // 1. Procesar entrada de audio del micrófono y energía acústica
  updateMicrophone();

  // 2. Actualizar lógica de combate, animaciones y partículas
  if (gameState === 'FIGHT') {
    updateCombat();
  } else if (gameState === 'KO') {
    updateKO();
  }

  // 3. Renderizar todos los elementos visuales de la obra
  renderScene();
}

/**
 * Renderizado de capas visuales en orden cinematográfico estricto
 */
function renderScene() {
  // Aplicar Screen Shake si hay vibración activa
  push();
  if (shakeAmount > 0.05) {
    let currentShake = shakeAmount * (1 + visualEnergy * 0.5);
    let ox = (noise(frameCount * 0.8) - 0.5) * currentShake * 16;
    let oy = (noise(frameCount * 0.8 + 40) - 0.5) * currentShake * 16;
    translate(ox, oy);
    shakeAmount = lerp(shakeAmount, 0, 0.12);
  }

  // Capa 1: Fondo oscuro de arena y estadio repleto
  background(7, 8, 12);
  audience.draw();
  ring.drawSpotlights();

  // Capa 2: Polvo atmosférico flotante
  for (let dust of dustMotes) {
    dust.update(visualEnergy);
    dust.draw();
  }

  // Capa 3: Cuerdas traseras del ring
  ring.drawBackRopes();

  // Capa 4: Piso de lona del cuadrilátero
  ring.drawFloor();

  // Capa 5: Boxeadores con sus sombras de contacto
  userFighter.drawShadow();
  rivalFighter.drawShadow();

  // Dibujar boxeadores (el que esté atacando o activo se dibuja al frente)
  if (userFighter.isAttacking()) {
    rivalFighter.draw();
    userFighter.draw();
  } else {
    userFighter.draw();
    rivalFighter.draw();
  }

  // Capa 6: Cuerdas frontales y tensores de esquinas
  ring.drawFrontRopes();

  // Capa 7: Sistema de partículas (sudor, chispas, ondas de choque)
  particleSystem.updateAndDraw();

  // Capa 8: Destello blanco sutil en golpes críticos
  if (flashWhiteFrames > 0) {
    noStroke();
    fill(255, 255, 255, flashWhiteFrames * 35);
    rect(0, 0, width, height);
    flashWhiteFrames--;
  }

  pop(); // Fin de la transformación de cámara / Screen Shake

  // Capa 9: Interfaz visual (Barras de vida y estado en lienzo)
  drawHUD();

  // Capa 10: Cartel cinematográfico de K.O.
  if (gameState === 'KO') {
    drawKOScreen();
  }
}

// ============================================================================
// PROCESAMIENTO DEL MICRÓFONO Y ENERGÍA ACÚSTICA
// ============================================================================
function updateMicrophone() {
  if (micStarted && mic) {
    rawMicLevel = mic.getLevel();
  } else {
    // Si el micrófono no está disponible o estamos en pruebas, nivel silencioso
    rawMicLevel = 0;
  }

  // Suavizado asimétrico: sube rápido para registrar el golpe al instante y baja suavemente
  let smoothSpeed = (rawMicLevel > smoothMicLevel) ? 0.35 : 0.12;
  smoothMicLevel = lerp(smoothMicLevel, rawMicLevel, smoothSpeed);

  // Calibración adaptativa sutil del piso de ruido ambiente
  noiseFloor = lerp(noiseFloor, min(smoothMicLevel, 0.02), 0.005);

  // Señal limpia por encima del ruido de fondo de la habitación
  let cleanSignal = max(0, smoothMicLevel - noiseFloor);

  // Aplicar ganancia/sensibilidad para que la voz normal alcance cómodamente todos los niveles
  let effectiveVol = constrain(cleanSignal * micSensitivity, 0, 1);

  // La energía visual acumula la intensidad sonora y decae gradualmente
  visualEnergy = lerp(visualEnergy, effectiveVol, 0.08);

  // Determinar nivel de ataque y actualizar HUD
  let tier = "SILENCIO";
  let meterPercent = constrain(effectiveVol * 100, 0, 100);

  if (effectiveVol >= 0.78) {
    tier = "GOLPE ESPECIAL";
  } else if (effectiveVol >= 0.56) {
    tier = "HOOK (GANCHO)";
  } else if (effectiveVol >= 0.30) {
    tier = "CROSS (RECTO)";
  } else if (effectiveVol >= 0.10) {
    tier = "JAB";
  }

  // Actualizar elementos visuales del HUD en el DOM
  if (hudMeterFillEl && hudTierLabelEl) {
    hudMeterFillEl.style.width = meterPercent + '%';
    hudTierLabelEl.textContent = tier;
    
    // Cambiar color del texto del HUD según el nivel
    if (tier === "GOLPE ESPECIAL") {
      hudTierLabelEl.style.color = "#f87171";
    } else if (tier === "HOOK (GANCHO)") {
      hudTierLabelEl.style.color = "#fb923c";
    } else if (tier === "CROSS (RECTO)") {
      hudTierLabelEl.style.color = "#facc15";
    } else if (tier === "JAB") {
      hudTierLabelEl.style.color = "#38bdf8";
    } else {
      hudTierLabelEl.style.color = "#f59e0b";
    }
  }

  // Solo disparar ataques si estamos en combate activo
  if (gameState === 'FIGHT') {
    // Mapeo del volumen al boxeador del usuario con COOLDOWN
    if (userFighter.canAttack()) {
      if (effectiveVol >= 0.78) {
        userFighter.launchAttack('SPECIAL');
      } else if (effectiveVol >= 0.56) {
        userFighter.launchAttack('HOOK');
      } else if (effectiveVol >= 0.30) {
        userFighter.launchAttack('CROSS');
      } else if (effectiveVol >= 0.10) {
        userFighter.launchAttack('JAB');
      }
    }
  }
}

// ============================================================================
// LÓGICA DE COMBATE Y DETECCIÓN DE CONTACTO
// ============================================================================
function updateCombat() {
  // Actualizar estados de ambos boxeadores
  userFighter.update(rivalFighter);
  rivalFighter.update(userFighter);

  // Mantener límites dentro del ring
  const minX = width * 0.14;
  const maxX = width * 0.86;
  userFighter.x = constrain(userFighter.x, minX, maxX);
  rivalFighter.x = constrain(rivalFighter.x, minX, maxX);

  // Verificar impacto de golpes del Usuario hacia el Rival
  checkImpact(userFighter, rivalFighter);

  // Verificar impacto de golpes del Rival hacia el Usuario
  checkImpact(rivalFighter, userFighter);

  // Chequeo de K.O.
  if (userFighter.health <= 0) {
    gameState = 'KO';
    winner = rivalFighter;
    userFighter.triggerKnockdown();
    koTimer = frameCount;
  } else if (rivalFighter.health <= 0) {
    gameState = 'KO';
    winner = userFighter;
    rivalFighter.triggerKnockdown();
    koTimer = frameCount;
  }
}

/**
 * Evalúa si el atacante conecta físicamente con el defensor
 */
function checkImpact(attacker, defender) {
  if (attacker.isAtStrikeWindow() && !attacker.hasConnected) {
    let distance = abs(attacker.x - defender.x);
    let reach = attacker.currentAttack.reach;

    // Contacto válido si están a la distancia de alcance y encarados
    if (distance <= reach) {
      attacker.hasConnected = true;

      // Evaluar si el defensor está esquivando o bloqueando
      let blocked = defender.isBlocking;
      let dodged = defender.isDodging;

      if (dodged) {
        // Esquive exitoso: no hay daño
        particleSystem.createDodgeWhoosh(defender.x, defender.y - 80);
        return;
      }

      let attackData = attacker.currentAttack;
      let baseDamage = attackData.damage;
      let finalDamage = blocked ? baseDamage * 0.25 : baseDamage;

      // Aplicar daño y retroceso
      defender.receiveDamage(finalDamage, attacker.facing, attackData.type, blocked);

      // Feedback de impacto: Hit-stop y Screen Shake
      if (attackData.type === 'SPECIAL') {
        hitStopFrames = 6;
        shakeAmount = 1.6;
        flashWhiteFrames = 3;
        ring.vibrateRopes(18);
        audience.triggerFlash();
      } else if (attackData.type === 'HOOK') {
        hitStopFrames = 4;
        shakeAmount = 1.1;
        ring.vibrateRopes(12);
        audience.triggerFlash();
      } else if (attackData.type === 'CROSS') {
        hitStopFrames = 3;
        shakeAmount = 0.7;
        ring.vibrateRopes(7);
      } else {
        // JAB
        hitStopFrames = 1;
        shakeAmount = 0.35;
        ring.vibrateRopes(4);
      }

      // Punto de impacto aproximado entre guante y mentón/pecho del boxeador
      let contactX = lerp(attacker.x, defender.x, 0.65);
      let contactY = defender.y - 190;

      // Generar partículas de impacto (sudor, chispas, onda)
      particleSystem.createHitBurst(contactX, contactY, attacker.facing, attackData.type, blocked);
    }
  }
}

// ============================================================================
// LÓGICA DE K.O. Y REINICIO
// ============================================================================
function updateKO() {
  userFighter.update(rivalFighter);
  rivalFighter.update(userFighter);
}

function drawKOScreen() {
  let elapsed = frameCount - koTimer;
  let alphaVal = map(min(elapsed, 45), 0, 45, 0, 220);

  // Velo oscuro cinemático
  fill(5, 6, 9, alphaVal * 0.85);
  noStroke();
  rect(0, 0, width, height);

  push();
  textAlign(CENTER, CENTER);

  // Título gigante "K.O."
  let koScale = min(1 + sin(elapsed * 0.05) * 0.04, 1.2);
  translate(width * 0.5, height * 0.38);
  scale(koScale);

  textFont('Bebas Neue');
  textSize(min(width * 0.22, 140));
  
  // Resplandor de texto K.O.
  fill(239, 68, 68, alphaVal);
  text("K. O.", 0, 0);

  fill(255, 255, 255, alphaVal);
  textSize(min(width * 0.21, 136));
  text("K. O.", 0, 0);
  pop();

  // Subtítulo del resultado
  push();
  textAlign(CENTER, CENTER);
  textFont('Outfit');
  textSize(min(width * 0.032, 24));
  fill(245, 158, 11, alphaVal);

  let victoryText = (winner === userFighter) 
    ? "¡ROCKY BALBOA DERROTA A LA MÁQUINA SOVIÉTICA!" 
    : "IVAN DRAGO APLASTA AL SEMENTAL ITALIANO";
  text(victoryText, width * 0.5, height * 0.52);

  // Instrucción para reiniciar el combate (después de breve pausa)
  if (elapsed > 70) {
    let blink = sin(frameCount * 0.1) > 0 ? 255 : 140;
    fill(255, 255, 255, blink);
    textFont('Bebas Neue');
    textSize(min(width * 0.04, 28));
    drawingContext.letterSpacing = '2px';
    text("CLICK PARA VOLVER A PELEAR", width * 0.5, height * 0.62);
    drawingContext.letterSpacing = '0px';
  }
  pop();
}

/**
 * Reiniciar combate al hacer clic tras un K.O.
 */
function mousePressed() {
  if (gameState === 'KO' && frameCount - koTimer > 60) {
    resetCombat();
  }
}

function touchStarted() {
  if (gameState === 'KO' && frameCount - koTimer > 60) {
    resetCombat();
    return false;
  }
}

function keyPressed() {
  // Reiniciar combate con Barra Espaciadora o Enter tras K.O.
  if (gameState === 'KO' && frameCount - koTimer > 60) {
    if (key === ' ' || keyCode === ENTER) {
      resetCombat();
      return;
    }
  }

  // Atajos de teclado para pruebas (simulación de voz para testing y demostración):
  // 1: Jab | 2: Cross | 3: Hook | 4: Especial
  if (gameState === 'FIGHT' && userFighter.canAttack()) {
    if (key === '1') userFighter.launchAttack('JAB');
    else if (key === '2') userFighter.launchAttack('CROSS');
    else if (key === '3') userFighter.launchAttack('HOOK');
    else if (key === '4') userFighter.launchAttack('SPECIAL');
  }

  // Ajustar sensibilidad del micrófono con teclas '+' y '-'
  if (key === '+' || key === '=') {
    changeSensitivity(0.5);
  } else if (key === '-' || key === '_') {
    changeSensitivity(-0.5);
  }
}

function resetCombat() {
  initFighters();
  particleSystem.clear();
  gameState = 'FIGHT';
  winner = null;
}

// ============================================================================
// INTERFAZ DE USUARIO (BARRAS DE VIDA DISCRETAS)
// ============================================================================
function drawHUD() {
  const barW = min(width * 0.28, 300);
  const barH = 10;
  const topY = 30;
  const padding = min(width * 0.05, 45);

  // ─── BARRA DE VIDA: ROCKY (IZQUIERDA) ────────────────────────────────────
  let userHpRatio = max(0, userFighter.health / userFighter.maxHealth);
  let rockyName = userFighter.name || "ROCKY";

  // Fondo
  noStroke();
  fill(15, 18, 26, 200);
  rect(padding, topY, barW, barH, 5);

  // Relleno de vida con degradado USA (Rojo → Azul USA)
  let userCol = lerpColor(color(200, 16, 46), color(25, 52, 140), 1 - userHpRatio);
  if (userHpRatio < 0.25) userCol = color(239, 68, 68); // Peligro: rojo puro
  fill(userCol);
  rect(padding, topY, barW * userHpRatio, barH, 5);

  // Borde de la barra
  stroke(200, 16, 46, 160);
  strokeWeight(1.5);
  rect(padding, topY, barW, barH, 5);
  noStroke();

  // Nombre de Rocky con banderita 🇺🇸
  textFont('Bebas Neue');
  textSize(19);
  textAlign(LEFT, BOTTOM);
  fill(240, 50, 60);
  text("★ " + rockyName, padding, topY - 4);

  // ─── BARRA DE VIDA: DRAGO (DERECHA) ──────────────────────────────────────
  let rivalHpRatio = max(0, rivalFighter.health / rivalFighter.maxHealth);
  let dragoName = rivalFighter.name || "DRAGO";
  let rivalX = width - padding - barW;

  // Fondo
  fill(15, 18, 26, 200);
  rect(rivalX, topY, barW, barH, 5);

  // Relleno de vida soviético (Rojo soviético → Oscuro)
  let rivalCol = lerpColor(color(60, 10, 10), color(185, 12, 12), rivalHpRatio);
  if (rivalHpRatio < 0.25) rivalCol = color(239, 40, 40);
  fill(rivalCol);
  rect(rivalX + barW * (1 - rivalHpRatio), topY, barW * rivalHpRatio, barH, 5);

  // Borde soviético dorado
  stroke(160, 120, 10, 160);
  strokeWeight(1.5);
  rect(rivalX, topY, barW, barH, 5);
  noStroke();

  // Nombre de Drago con estrella soviética ★
  textAlign(RIGHT, BOTTOM);
  fill(210, 160, 15);
  text(dragoName + " ★", width - padding, topY - 4);

  // ─── ETIQUETA CENTRAL DE COMBATE (VS) ───────────────────────────────────
  textAlign(CENTER, BOTTOM);
  fill(255, 255, 255, 160);
  textFont('Bebas Neue');
  textSize(22);
  text("VS", width * 0.5, topY - 2);
}

// ============================================================================
// CLASE: FIGHTER (BOXEADOR PROCEDURAL 2D - PESO PESADO MUSCULOSO)
// ============================================================================
class Fighter {
  constructor(config) {
    this.x = config.x;
    this.baseY = config.y;
    this.y = config.y;
    this.facing = config.facing; // 1 = mira a la derecha, -1 = mira a la izquierda
    this.name = config.name;
    this.colorTheme = config.colorTheme;
    this.style = config.style || 'GENERIC'; // 'ROCKY' | 'DRAGO' | 'GENERIC'
    this.isAutonomous = config.isAutonomous;

    // Vida y Resistencia
    this.maxHealth = 100;
    this.health = 100;

    // Estados: 'IDLE' | 'ATTACK' | 'HURT' | 'BLOCK' | 'DODGE' | 'KNOCKDOWN'
    this.state = 'IDLE';
    this.currentAttack = null;
    this.attackFrame = 0;
    this.hasConnected = false;
    this.cooldownTimer = 0;

    // Temporizadores de estados defensivos / dolor
    this.hurtTimer = 0;
    this.blockTimer = 0;
    this.dodgeTimer = 0;
    this.knockdownProgress = 0;

    // Desplazamiento y física procedural
    this.vx = 0;
    this.targetX = this.x;
    this.noiseSeed = random(1000);
    this.breathePhase = random(TWO_PI);

    // Banderas de estado
    this.isBlocking = false;
    this.isDodging = false;

    // IA del Rival autónomo
    this.aiTimer = int(random(30, 55));
  }

  canAttack() {
    return (
      this.state !== 'ATTACK' &&
      this.state !== 'HURT' &&
      this.state !== 'KNOCKDOWN' &&
      this.cooldownTimer <= 0
    );
  }

  isAttacking() {
    return this.state === 'ATTACK';
  }

  isAtStrikeWindow() {
    if (this.state !== 'ATTACK' || !this.currentAttack) return false;
    let strikeStart = this.currentAttack.strikeStart;
    let strikeEnd = this.currentAttack.strikeEnd;
    return this.attackFrame >= strikeStart && this.attackFrame <= strikeEnd;
  }

  launchAttack(type) {
    if (!this.canAttack()) return;

    this.state = 'ATTACK';
    this.attackFrame = 0;
    this.hasConnected = false;
    this.isBlocking = false;
    this.isDodging = false;

    // Definición de golpes escalados para pesos pesados colosales
    if (type === 'JAB') {
      this.currentAttack = {
        type: 'JAB',
        reach: 220,
        damage: 8,
        windup: 3,
        strikeStart: 4,
        strikeEnd: 8,
        totalFrames: 15,
        cooldown: 14
      };
    } else if (type === 'CROSS') {
      this.currentAttack = {
        type: 'CROSS',
        reach: 260,
        damage: 16,
        windup: 5,
        strikeStart: 6,
        strikeEnd: 11,
        totalFrames: 22,
        cooldown: 22
      };
    } else if (type === 'HOOK') {
      this.currentAttack = {
        type: 'HOOK',
        reach: 210,
        damage: 26,
        windup: 8,
        strikeStart: 9,
        strikeEnd: 15,
        totalFrames: 28,
        cooldown: 32
      };
    } else if (type === 'SPECIAL') {
      this.currentAttack = {
        type: 'SPECIAL',
        reach: 285,
        damage: 42,
        windup: 12,
        strikeStart: 13,
        strikeEnd: 19,
        totalFrames: 36,
        cooldown: 48
      };
    }
  }

  receiveDamage(amount, fromFacing, attackType, blocked) {
    if (this.state === 'KNOCKDOWN') return;

    this.health = max(0, this.health - amount);
    this.state = 'HURT';
    this.hurtTimer = blocked ? 8 : 16;

    // Retroceso proporcional a la pegada de peso pesado
    let knockback = blocked ? 14 : (attackType === 'SPECIAL' ? 60 : (attackType === 'HOOK' ? 42 : 24));
    this.vx += fromFacing * knockback;

    if (!blocked) {
      this.currentAttack = null;
    }
  }

  triggerKnockdown() {
    this.state = 'KNOCKDOWN';
    this.knockdownProgress = 0;
    this.vx = -this.facing * 18;
  }

  update(opponent) {
    if (this.cooldownTimer > 0) this.cooldownTimer--;

    // 1. Estado KNOCKDOWN (Caída tras K.O.)
    if (this.state === 'KNOCKDOWN') {
      this.knockdownProgress = min(this.knockdownProgress + 0.035, 1);
      this.x += this.vx;
      this.vx *= 0.85;
      return;
    }

    // 2. Estado HURT (Recibiendo golpe contundente)
    if (this.state === 'HURT') {
      this.hurtTimer--;
      this.x += this.vx;
      this.vx *= 0.82;
      if (this.hurtTimer <= 0) {
        this.state = 'IDLE';
      }
      return;
    }

    // 3. Estado ATTACK (Ejecutando golpe de potencia)
    if (this.state === 'ATTACK') {
      this.attackFrame++;
      if (this.attackFrame <= this.currentAttack.strikeStart) {
        this.x += this.facing * 2.2;
      }
      if (this.attackFrame >= this.currentAttack.totalFrames) {
        this.cooldownTimer = this.currentAttack.cooldown;
        this.state = 'IDLE';
        this.currentAttack = null;
      }
      return;
    }

    // 4. Estados Defensivos: BLOCK o DODGE
    if (this.state === 'BLOCK') {
      this.blockTimer--;
      if (this.blockTimer <= 0) {
        this.state = 'IDLE';
        this.isBlocking = false;
      }
    } else if (this.state === 'DODGE') {
      this.dodgeTimer--;
      if (this.dodgeTimer <= 0) {
        this.state = 'IDLE';
        this.isDodging = false;
      }
    }

    // 5. Inteligencia y Comportamiento Autónomo (Rival)
    if (this.isAutonomous) {
      this.updateRivalAI(opponent);
    }

    // 6. Movimiento procedural orgánico con Perlin Noise en reposo (IDLE)
    if (this.state === 'IDLE' || this.state === 'BLOCK' || this.state === 'DODGE') {
      let noiseVal = noise(frameCount * 0.02 + this.noiseSeed);
      let swayOffset = (noiseVal - 0.5) * 1.5;
      this.x += swayOffset + this.vx;
      this.vx *= 0.88;
    }
  }

  /**
   * Comportamiento orgánico del Rival para peso pesado
   */
  updateRivalAI(user) {
    this.aiTimer--;
    let distToUser = abs(this.x - user.x);
    let idealCombatDistance = 225 + (noise(frameCount * 0.03 + 200) - 0.5) * 55;

    // Desplazamiento de ringcraft
    if (distToUser > idealCombatDistance + 35) {
      this.vx = -1.8;
    } else if (distToUser < idealCombatDistance - 35) {
      this.vx = 2.0;
    }

    // Reacción defensiva si el usuario lanza un golpe fuerte y está en rango
    if (user.isAttacking() && distToUser <= user.currentAttack.reach + 25 && this.canAttack()) {
      let reactionDice = random();
      if (reactionDice < 0.30) {
        this.state = 'BLOCK';
        this.isBlocking = true;
        this.blockTimer = 18;
        return;
      } else if (reactionDice < 0.48) {
        this.state = 'DODGE';
        this.isDodging = true;
        this.dodgeTimer = 16;
        this.vx = 5; // Salida lateral / paso atrás
        return;
      }
    }

    // Ataques autónomos
    if (this.aiTimer <= 0 && this.canAttack()) {
      this.aiTimer = int(map(noise(frameCount * 0.05 + 500), 0, 1, 35, 75));

      if (distToUser <= 240) {
        let actionRoll = random();
        if (actionRoll < 0.52) {
          this.launchAttack('JAB');
        } else if (actionRoll < 0.84) {
          this.launchAttack('CROSS');
        } else {
          this.launchAttack('HOOK');
        }
      }
    }
  }

  // ==========================================================================
  // DIBUJO VECTORIAL DEL BOXEADOR DE PESO PESADO (~285px de pura potencia)
  // ==========================================================================
  drawShadow() {
    let shadowWidth = map(this.knockdownProgress, 0, 1, 160, 220);
    let shadowAlpha = map(this.knockdownProgress, 0, 1, 150, 90);
    noStroke();
    fill(0, 0, 0, shadowAlpha);
    ellipse(this.x, this.baseY, shadowWidth, 24);
  }

  draw() {
    push();
    translate(this.x, this.baseY);
    scale(this.facing, 1);

    // Respiración profunda de coloso
    let breath = sin(frameCount * 0.07 + this.breathePhase) * 3;
    let organicSway = (noise(frameCount * 0.025 + this.noiseSeed) - 0.5) * 4;

    // Animación de Caída K.O.
    if (this.state === 'KNOCKDOWN') {
      let fallAngle = this.knockdownProgress * HALF_PI * 0.95;
      translate(0, this.knockdownProgress * 40);
      rotate(fallAngle);
    }

    // Efecto de retroceso e impacto
    if (this.state === 'HURT') {
      let hurtKick = sin(this.hurtTimer * 0.6) * 10;
      translate(-hurtKick, 0);
      rotate(-0.16);
    }

    // Esquive profundo (Bob & Weave / agacharse)
    if (this.state === 'DODGE') {
      translate(0, 26);
      rotate(-0.20);
    }

    // Capas anatómicas de profundidad 2.5D
    this.drawLegs();
    this.drawRearArm(breath);
    this.drawTorso(breath, organicSway);
    this.drawHead(breath);
    this.drawLeadArm(breath);

    pop();
  }

  // Piernas macizas y botas pesadas de boxeo
  drawLegs() {
    strokeCap(ROUND);

    // --- PIERNA TRASERA (sombreada para profundidad) ---
    stroke(this.colorTheme.skinShade || color(160, 110, 65));
    strokeWeight(18);
    line(-26, -115, -45, -55);
    line(-45, -55, -52, -14);

    // Bota trasera de campeonato
    noStroke();
    fill(24, 25, 32);
    rect(-68, -18, 34, 18, 4);
    // Borde de suela
    fill(45, 48, 60);
    rect(-68, -4, 34, 4, 1);

    // --- PIERNA DELANTERA (muslo voluminoso y pantorrilla definida) ---
    stroke(this.colorTheme.skin);
    strokeWeight(22);
    line(18, -115, 32, -55);
    line(32, -55, 38, -14);

    // Bota delantera con cordones y detalle de color
    noStroke();
    fill(35, 38, 48);
    rect(24, -18, 36, 18, 4);
    // Franja de campeón en la bota
    fill(this.colorTheme.accent);
    rect(32, -18, 6, 18);
    // Suela
    fill(60, 65, 80);
    rect(24, -4, 36, 4, 1);
  }

  // Torso con vestuario icónico diferenciado para Rocky y Drago
  drawTorso(breath, organicSway) {
    push();
    translate(organicSway, breath);

    let isRocky = (this.style === 'ROCKY');
    let isDrago = (this.style === 'DRAGO');

    // ┌─────────────────────────────────────────────────────┐
    //   SHORTS DE BOXEO ESPECÍFICOS POR PERSONAJE
    // └─────────────────────────────────────────────────────┘
    if (isRocky) {
      // ROCKY: Shorts de la bandera americana (Rocky IV)
      // Bloque rojo principal
      fill(this.colorTheme.trunks); // Rojo USA
      stroke(10, 10, 14);
      strokeWeight(3);
      beginShape();
      vertex(-44, -155); vertex(42, -155);
      vertex(48, -100); vertex(5, -108); vertex(-48, -100);
      endShape(CLOSE);

      // Franja blanca central (bandera)
      fill(this.colorTheme.trunksHL);
      noStroke();
      quad(-12, -155, 12, -155, 14, -102, -10, -102);

      // Franjas laterales azules (barras de la bandera USA)
      fill(this.colorTheme.trunksAlt);
      quad(-44, -155, -20, -155, -22, -102, -48, -100);

      // ESTRELLAS en la franja azul (★)
      fill(240, 240, 255);
      textFont('sans-serif');
      textSize(10);
      textAlign(CENTER, CENTER);
      text('★', -35, -132);
      text('★', -35, -118);

    } else if (isDrago) {
      // DRAGO: Shorts soviéticos rojos con detalle CCCP/estrella
      fill(this.colorTheme.trunks); // Rojo soviético
      stroke(8, 8, 10);
      strokeWeight(3);
      beginShape();
      vertex(-44, -155); vertex(42, -155);
      vertex(48, -100); vertex(5, -108); vertex(-48, -100);
      endShape(CLOSE);

      // Franjas laterales oscuras de acero soviético
      fill(this.colorTheme.trunksAlt);
      noStroke();
      quad(-44, -155, -28, -155, -32, -102, -48, -100);
      quad(28, -155, 42, -155, 48, -100, 32, -102);

      // ESTRELLA SOVIÉTICA DORADA ★ en el centro
      fill(this.colorTheme.trunksHL);
      textFont('sans-serif');
      textSize(24);
      textAlign(CENTER, CENTER);
      text('★', 0, -130);

    } else {
      // Fallback genérico
      fill(this.colorTheme.trunks);
      stroke(12, 14, 20);
      strokeWeight(3);
      beginShape();
      vertex(-44, -155); vertex(42, -155);
      vertex(48, -100); vertex(5, -108); vertex(-48, -100);
      endShape(CLOSE);
      fill(this.colorTheme.accent);
      noStroke();
      quad(-44, -155, -34, -155, -38, -102, -48, -100);
      quad(32, -155, 42, -155, 48, -100, 38, -102);
    }

    // CINTURÓN SEPARADOR (pretina del pantalón)
    fill(isRocky ? color(255, 255, 255, 130) : color(0, 0, 0, 100));
    noStroke();
    rect(-44, -162, 86, 10, 2);

    // ┌─────────────────────────────────────────────────────┐
    //   TORSO MUSCULOSO V-TAPER
    // └─────────────────────────────────────────────────────┘

    // Espalda dorsal ancha (Lats)
    fill(this.colorTheme.skinShade || color(170, 115, 70));
    noStroke();
    triangle(-38, -162, -54, -240, -10, -240);

    // Masa muscular principal del tronco
    fill(this.colorTheme.skin);
    stroke(15, 15, 20);
    strokeWeight(3);
    beginShape();
    vertex(-38, -162);
    vertex(38, -162);
    vertex(52, -240);  // Hombro delantero masivo
    vertex(28, -250);  // Trapecio delantero
    vertex(-20, -250); // Trapecio trasero
    vertex(-50, -240); // Hombro trasero masivo
    endShape(CLOSE);

    // Definición muscular de pectorales
    let muscleShade = this.colorTheme.skinShade || color(150, 95, 55);
    fill(this.colorTheme.skin);
    stroke(red(muscleShade), green(muscleShade), blue(muscleShade), 180);
    strokeWeight(3);
    arc(22, -215, 40, 34, 0, PI);
    arc(-16, -215, 36, 32, 0, PI);
    line(3, -238, 3, -198);

    // Abdominales esculpidos
    stroke(red(muscleShade), green(muscleShade), blue(muscleShade), 150);
    strokeWeight(2.5);
    line(3, -198, 3, -166);
    line(-16, -198, 22, -198);
    line(-15, -186, 21, -186);
    line(-14, -174, 20, -174);

    // Rocky extra: cicatrices de combate en el torso (moretones y marcas)
    if (isRocky) {
      stroke(140, 70, 50, 90);
      strokeWeight(1.5);
      line(-8, -220, 4, -210);
      line(10, -190, 20, -182);
    }

    pop();
  }

  // Cabeza diferenciada por personaje: Rocky (pelo rizado, nariz chata) vs Drago (flat-top rubio, mandíbula cuadrada)
  drawHead(breath) {
    push();
    translate(4, -255 + breath * 0.7);

    let isRocky = (this.style === 'ROCKY');
    let isDrago = (this.style === 'DRAGO');
    let hairCol = this.colorTheme.hairColor || color(20, 20, 25);

    // CUELLO musculoso (más ancho para Drago, robusto para Rocky)
    fill(this.colorTheme.skin);
    stroke(14, 14, 20);
    strokeWeight(3);
    if (isDrago) {
      rect(-16, 0, 32, 24); // Drago: cuello de toro soviético
    } else {
      rect(-13, 0, 26, 20); // Rocky: cuello más compacto y humano
    }

    // CABEZA / FORMA DEL CRÁNEO diferenciada
    fill(this.colorTheme.skin);
    if (isDrago) {
      // Drago: cara ancha, mandíbula cuadrada, pómulos prominentes
      beginShape();
      vertex(-20, -48);
      vertex(20, -48);
      vertex(22, -22); // Sien plana
      vertex(20, 2);   // Mandíbula cuadrada CCCP
      vertex(-8, 4);   // Mentón de hormigón
      vertex(-20, -10);// Nuca musculosa
      endShape(CLOSE);
      // Pómulo soviético marcado
      fill(this.colorTheme.skinShade || color(180, 148, 118));
      noStroke();
      ellipse(14, -22, 12, 8);
    } else {
      // Rocky: cara más redondeada y golpeada
      beginShape();
      vertex(-16, -44);
      vertex(16, -44);
      vertex(22, -20); // Nariz aplastada y partida de Rocky
      vertex(18, 2);   // Mandíbula redonda peleada
      vertex(-5, 5);   // Mentón abultado
      vertex(-16, -8); // Nuca
      endShape(CLOSE);
      // Nariz chata partida de Rocky (ícono de la saga)
      fill(this.colorTheme.skinShade || color(155, 105, 65));
      noStroke();
      ellipse(18, -20, 10, 7);
    }

    // ── CABELLO ──────────────────────────────────────────
    fill(hairCol);
    noStroke();
    if (isDrago) {
      // DRAGO: Flat-top recto soviético (cabello cortado militar)
      rect(-20, -50, 40, 8, 2); // Bloque superior plano
      rect(-18, -48, 36, 6);    // Volumen del flat-top
    } else {
      // ROCKY: Cabello rizado oscuro (característica visual icónica)
      arc(0, -36, 34, 24, PI, TWO_PI); // Base del cabello
      ellipse(-12, -44, 14, 12);       // Rizo lateral izquierdo
      ellipse(0, -46, 12, 14);         // Rizo central
      ellipse(12, -43, 12, 12);        // Rizo lateral derecho
    }

    // ── RASGOS FACIALES ────────────────────────────────
    // Ceja fruncida + ceño de combate
    stroke(14, 14, 18);
    strokeWeight(4);
    if (isDrago) {
      line(6, -30, 18, -28);   // Ceño frío y calculador
    } else {
      line(8, -28, 18, -24);   // Ceño fruncido de Rocky (determinación)
    }

    // Corte / ceja partida (característica de Rocky)
    if (isRocky) {
      stroke(200, 120, 90, 200);
      strokeWeight(2);
      line(10, -30, 16, -26); // Ceja partida clásica de Rocky
    }

    // Protector bucal
    if (isRocky) {
      stroke(220, 25, 25);    // Protector rojo de Rocky
    } else {
      stroke(200, 200, 210);  // Protector blanco de Drago
    }
    strokeWeight(3);
    line(8, -4, 17, -6);

    pop();
  }

  // Brazo Trasero Masivo (Cross / Recto demoledor de derecha)
  drawRearArm(breath) {
    push();
    translate(-26, -236 + breath);

    let gloveX = 22;
    let gloveY = 24;

    // Cinemática de CROSS DE PESO PESADO
    if (this.state === 'ATTACK' && this.currentAttack.type === 'CROSS') {
      let progress = this.getAttackProgress();
      let extension = sin(progress * PI);
      gloveX = 22 + extension * 180;
      gloveY = 20 - extension * 6;
    }

    // DELTOIDES TRASERO (HOMBRO)
    noStroke();
    fill(this.colorTheme.skinShade || color(170, 115, 70));
    ellipse(0, 0, 36, 34);

    // BÍCEPS Y ANTEBRAZO MUSCULOSO TRASERO
    stroke(this.colorTheme.skinShade || color(160, 110, 65));
    strokeWeight(22);
    strokeCap(ROUND);
    let elbowX = gloveX * 0.48;
    let elbowY = gloveY + 18;
    line(0, 0, elbowX, elbowY);
    line(elbowX, elbowY, gloveX, gloveY);

    // GUANTE TRASERO DE 16oz (ENORME Y MENAZANTE)
    noStroke();
    fill(this.colorTheme.gloves);
    ellipse(gloveX, gloveY, 44, 38);

    // Brillo de cuero en el guante
    fill(255, 255, 255, 100);
    ellipse(gloveX - 6, gloveY - 8, 14, 10);

    // Cinta y vendaje de muñeca
    fill(245, 245, 250);
    rect(gloveX - 14, gloveY + 10, 22, 8, 2);

    pop();
  }

  // Brazo Delantero Masivo (Jab devastador, Hook o Guardia Alta)
  drawLeadArm(breath) {
    push();
    translate(32, -238 + breath);

    let elbowX = 20;
    let elbowY = 32;
    let gloveX = 32;
    let gloveY = -8; // Guardia alta pesada cubriendo el mentón

    // Guardia en bloqueo
    if (this.state === 'BLOCK') {
      elbowX = 16;
      elbowY = 16;
      gloveX = 22;
      gloveY = -28;
    }

    // Cinemática de ataques delanteros de peso pesado
    if (this.state === 'ATTACK') {
      let progress = this.getAttackProgress();
      let extension = sin(progress * PI);

      if (this.currentAttack.type === 'JAB') {
        // PISTÓN RECTO Y EXPLOSIVO
        gloveX = 32 + extension * 165;
        gloveY = -8 - extension * 4;
        elbowX = gloveX * 0.52;
        elbowY = 14;
      } else if (this.currentAttack.type === 'HOOK') {
        // GANCHO DEMOLEDOR CURVADO
        let hookAngle = progress * PI;
        gloveX = 28 + sin(hookAngle) * 145;
        gloveY = -20 - cos(hookAngle) * 35;
        elbowX = gloveX * 0.65;
        elbowY = -26; // Codo alto paralelo a la lona
      } else if (this.currentAttack.type === 'SPECIAL') {
        // UPPERCUT SÓNICO DEMOLEDOR
        if (progress < 0.35) {
          gloveX = 14;
          gloveY = 48; // Carga en cuclillas
        } else {
          let upProgress = map(progress, 0.35, 1, 0, 1);
          gloveX = 30 + sin(upProgress * PI) * 160;
          gloveY = 45 - sin(upProgress * PI) * 155; // Vuela hacia el mentón
        }
      }
    }

    // DELTOIDES DELANTERO (HOMBRO GIGANTE)
    noStroke();
    fill(this.colorTheme.skin);
    ellipse(0, 0, 42, 38);

    // BÍCEPS Y ANTEBRAZO DELANTERO
    stroke(this.colorTheme.skin);
    strokeWeight(24);
    strokeCap(ROUND);
    line(0, 0, elbowX, elbowY);
    line(elbowX, elbowY, gloveX, gloveY);

    // GUANTE DELANTERO DE 16oz (GIGANTE Y ROBUSTO)
    noStroke();
    fill(this.colorTheme.gloves);
    ellipse(gloveX, gloveY, 48, 42);

    // Pulgar y nudillos del guante
    fill(this.colorTheme.accent);
    ellipse(gloveX - 5, gloveY - 4, 14, 14);

    // Brillo de cuero satinado
    fill(255, 255, 255, 120);
    ellipse(gloveX - 8, gloveY - 10, 16, 12);

    // Vendaje blanco reglamentario
    fill(245, 245, 250);
    rect(gloveX - 16, gloveY + 10, 26, 9, 3);

    pop();
  }

  getAttackProgress() {
    if (!this.currentAttack) return 0;
    return constrain(this.attackFrame / this.currentAttack.totalFrames, 0, 1);
  }
}

// ============================================================================
// CLASE: RING (CUADRILÁTERO DE CAMPEONATO, CUERDAS REACTIVAS Y LUCES)
// ============================================================================
class Ring {
  constructor() {
    this.ropeVibration = 0;
  }

  vibrateRopes(amount) {
    this.ropeVibration = max(this.ropeVibration, amount);
  }

  drawSpotlights() {
    noStroke();
    let centerX = width * 0.5;
    let spotAlpha = map(visualEnergy, 0, 1, 45, 115);
    let flicker = (noise(frameCount * 0.06) - 0.5) * 14;

    // Foco central masivo cálido de título mundial
    fill(255, 230, 175, spotAlpha + flicker);
    beginShape();
    vertex(centerX - 160, 0);
    vertex(centerX + 160, 0);
    vertex(centerX + 480, height * 0.81);
    vertex(centerX - 480, height * 0.81);
    endShape(CLOSE);

    // Haz izquierdo azul campeonato
    fill(56, 189, 248, (spotAlpha * 0.45) + flicker * 0.5);
    beginShape();
    vertex(width * 0.12, 0);
    vertex(width * 0.28, 0);
    vertex(width * 0.52, height * 0.81);
    vertex(width * 0.04, height * 0.81);
    endShape(CLOSE);

    // Haz derecho rojo combate
    fill(239, 68, 68, (spotAlpha * 0.42) + flicker * 0.5);
    beginShape();
    vertex(width * 0.72, 0);
    vertex(width * 0.88, 0);
    vertex(width * 0.96, height * 0.81);
    vertex(width * 0.48, height * 0.81);
    endShape(CLOSE);

    // Estructura industrial de trusses en el techo del estadio
    this.drawOverheadTruss();
  }

  drawOverheadTruss() {
    push();
    stroke(25, 30, 42);
    strokeWeight(2.5);
    line(0, 16, width, 16);
    line(0, 34, width, 34);

    // Vigas cruzadas de soporte de iluminación
    for (let x = 0; x < width; x += 45) {
      line(x, 16, x + 45, 34);
      line(x + 45, 16, x, 34);
    }

    // Focos halógenos colgantes
    noStroke();
    for (let fx = width * 0.12; fx <= width * 0.88; fx += width * 0.15) {
      fill(20, 24, 34);
      rect(fx - 16, 30, 32, 12, 2);
      fill(255, 245, 210, 210);
      ellipse(fx, 42, 24, 7);
    }
    pop();
  }

  drawFloor() {
    let floorY = height * 0.81;
    let ringW = min(width * 0.88, 1200);
    let leftX = (width - ringW) * 0.5;
    let rightX = leftX + ringW;

    // Faldón frontal del cuadrilátero (Ring apron)
    fill(10, 12, 17);
    noStroke();
    quad(leftX - 45, floorY, rightX + 45, floorY, rightX + 65, height, leftX - 65, height);

    // Lona principal de boxeo (Heavy canvas con iluminación)
    fill(24, 28, 38);
    quad(leftX - 45, floorY, rightX + 45, floorY, rightX + 22, floorY + 62, leftX - 22, floorY + 62);

    // Borde de lona y costuras
    stroke(40, 46, 62);
    strokeWeight(2);
    line(leftX - 40, floorY + 20, rightX + 40, floorY + 20);
    line(leftX - 35, floorY + 40, rightX + 35, floorY + 40);

    // Logotipo estilizado en el faldón de campeonato mundial
    noStroke();
    fill(245, 158, 11, 150);
    textFont('Bebas Neue');
    textSize(22);
    textAlign(CENTER, CENTER);
    text("★ EL RITMO DEL COMBATE - WORLD CHAMPIONSHIP ★", width * 0.5, floorY + 30);
  }

  drawBackRopes() {
    this.drawRopeLayer(true);
  }

  drawFrontRopes() {
    this.drawRopeLayer(false);
    this.drawCornerPosts();
  }

  drawRopeLayer(isBack) {
    let floorY = height * 0.81;
    let ringW = min(width * 0.88, 1200);
    let leftX = (width - ringW) * 0.5;
    let rightX = leftX + ringW;

    this.ropeVibration = lerp(this.ropeVibration, 0, 0.08);
    let totalVib = this.ropeVibration + (visualEnergy * 8);

    // 4 Cuerdas calibradas a escala humana:
    // La cuerda superior está a -180px, por lo que el torso superior, los hombros anchos
    // y la cabeza de los boxeadores sobresalen con orgullo arriba (figuras heroicas).
    let ropeHeights = isBack 
      ? [-180, -135, -90, -45] 
      : [-185, -140, -95, -50];

    let ropeColors = [
      color(220, 38, 38),   // Cuerda superior roja
      color(240, 240, 250), // Cuerda blanca
      color(37, 99, 235),   // Cuerda azul
      color(240, 240, 250)  // Cuerda inferior blanca
    ];

    strokeWeight(6);
    noFill();

    for (let i = 0; i < 4; i++) {
      let baseRopeY = floorY + ropeHeights[i];
      stroke(ropeColors[i]);

      beginShape();
      vertex(leftX, baseRopeY);

      let segments = 26;
      for (let s = 1; s < segments; s++) {
        let t = s / segments;
        let px = lerp(leftX, rightX, t);
        let sag = sin(t * PI) * 6;
        let noiseWave = (noise(t * 3.5, frameCount * 0.08 + i) - 0.5) * totalVib;
        vertex(px, baseRopeY + sag + noiseWave);
      }

      vertex(rightX, baseRopeY);
      endShape();
    }
  }

  drawCornerPosts() {
    let floorY = height * 0.81;
    let ringW = min(width * 0.88, 1200);
    let leftX = (width - ringW) * 0.5;
    let rightX = leftX + ringW;

    // Postes esquineros robustos de acero
    stroke(20, 45, 120);
    strokeWeight(16);
    line(leftX, floorY - 215, leftX, floorY + 55);

    stroke(140, 20, 20);
    line(rightX, floorY - 215, rightX, floorY + 55);

    // Almohadillas protectoras acolchadas de esquinas (Heavy corner pads)
    noStroke();
    fill(29, 78, 216);
    rect(leftX - 12, floorY - 210, 24, 180, 6);
    fill(59, 130, 246);
    rect(leftX - 6, floorY - 200, 12, 160, 3);

    fill(185, 28, 28);
    rect(rightX - 12, floorY - 210, 24, 180, 6);
    fill(239, 68, 68);
    rect(rightX - 6, floorY - 200, 12, 160, 3);
  }
}

// ============================================================================
// CLASE: AUDIENCE (ESTADIO REPLETO DE GENTE - COLISEO LLENO)
// ============================================================================
class Audience {
  constructor() {
    this.spectators = [];
    this.flashBulbs = [];
    this.phoneLights = [];

    // Generar gradas masivas con cientos de espectadores en 5 niveles de profundidad
    let tiers = 5;
    for (let t = 0; t < tiers; t++) {
      let count = int(32 + t * 24); // Entre 32 y 128 siluetas por grada
      for (let i = 0; i < count; i++) {
        this.spectators.push({
          tier: t,
          xRatio: (i + random(-0.25, 0.25)) / count,
          size: map(t, 0, tiers - 1, 14, 26),
          seed: random(1000),
          hasArmsUp: random() < 0.24,
          shirtTone: random(16, 42)
        });
      }
    }

    // Puntos de luz de teléfonos móviles y linternas del público en la penumbra
    for (let i = 0; i < 75; i++) {
      this.phoneLights.push({
        xRatio: random(0.02, 0.98),
        yRatio: random(0.08, 0.65),
        brightness: random(160, 255),
        blinkRate: random(0.02, 0.08),
        size: random(1.5, 3.5)
      });
    }
  }

  triggerFlash() {
    // Ráfaga masiva de flashes al conectar golpes contundentes
    let flashCount = int(random(5, 12));
    for (let i = 0; i < flashCount; i++) {
      this.flashBulbs.push({
        x: random(width * 0.05, width * 0.95),
        y: random(height * 0.10, height * 0.68),
        radius: random(40, 110),
        life: int(random(3, 7)),
        maxLife: 7
      });
    }
  }

  draw() {
    let horizonY = height * 0.74;
    let tiers = 5;
    noStroke();

    // 1. Gradas arquitectónicas del estadio (Arena Coliseum Stands)
    for (let t = 0; t < tiers; t++) {
      let yTop = map(t, 0, tiers, height * 0.08, horizonY - 45);
      let yBottom = map(t + 1, 0, tiers, height * 0.08, horizonY);
      
      let shade = map(t, 0, tiers, 8, 18);
      fill(shade, shade + 1, shade + 4);
      rect(0, yTop, width, yBottom - yTop);

      // Borde de grada
      stroke(shade + 12, shade + 14, shade + 20);
      strokeWeight(1);
      line(0, yBottom, width, yBottom);
      noStroke();
    }

    // 2. Luces de teléfonos móviles y pantallas del público en las gradas
    for (let phone of this.phoneLights) {
      let px = phone.xRatio * width;
      let py = phone.yRatio * height;
      let twinkle = sin(frameCount * phone.blinkRate) * 50;
      let a = constrain(phone.brightness + twinkle + (visualEnergy * 80), 0, 255);
      fill(230, 240, 255, a);
      ellipse(px, py, phone.size, phone.size);
    }

    // 3. Cientos de espectadores animados con Perlin Noise
    for (let p of this.spectators) {
      let px = p.xRatio * width;
      let tierY = map(p.tier, 0, 4, height * 0.12, horizonY - 12);
      
      // Movimiento orgánico colectivo (Ola y vitoreos modulados por la voz del usuario)
      let excitement = visualEnergy * 8;
      let sway = (noise(frameCount * 0.02 + p.seed) - 0.5) * (4 + excitement);
      let bob = sin(frameCount * 0.05 + p.seed) * (2 + excitement * 0.5);

      let x = px + sway;
      let y = tierY + bob;

      let baseBrightness = map(p.tier, 0, 4, 12, 28);
      fill(baseBrightness, baseBrightness + 1, baseBrightness + 4);

      // Hombros y torso del espectador
      arc(x, y + p.size * 0.5, p.size * 1.5, p.size * 1.3, PI, TWO_PI);
      // Cabeza
      ellipse(x, y, p.size * 0.85, p.size * 0.85);

      // Brazos levantados vitoreando con la emoción o picos de voz
      if (p.hasArmsUp || visualEnergy > 0.38) {
        stroke(baseBrightness, baseBrightness + 1, baseBrightness + 4);
        strokeWeight(p.size * 0.22);
        line(x - p.size * 0.5, y + 4, x - p.size * 0.7, y - p.size * 0.8);
        line(x + p.size * 0.5, y + 4, x + p.size * 0.7, y - p.size * 0.8);
        noStroke();
      }
    }

    // 4. Fotógrafos a ringside (pegados a la lona)
    let ringsideY = horizonY + 8;
    for (let i = 0; i < 20; i++) {
      let rx = (i / 20) * width + 15;
      fill(16, 18, 24);
      ellipse(rx, ringsideY, 20, 20);
      rect(rx - 14, ringsideY + 4, 28, 24, 4);
      // Lente de cámara fotográfica
      fill(35, 40, 50);
      rect(rx - 4, ringsideY - 2, 8, 12, 2);
    }

    // 5. Flashes de cámaras aleatorios del estadio
    if (random() < 0.20 + visualEnergy * 0.4) {
      this.flashBulbs.push({
        x: random(width * 0.05, width * 0.95),
        y: random(height * 0.10, horizonY - 15),
        radius: random(30, 80),
        life: int(random(2, 5)),
        maxLife: 5
      });
    }

    // Dibujar y actualizar flashes activos
    for (let i = this.flashBulbs.length - 1; i >= 0; i--) {
      let f = this.flashBulbs[i];
      let alpha = (f.life / f.maxLife) * 255;
      
      // Resplandor exterior
      fill(255, 250, 230, alpha * 0.4);
      ellipse(f.x, f.y, f.radius * 2, f.radius * 2);
      // Núcleo brillante blanco
      fill(255, 255, 255, alpha);
      ellipse(f.x, f.y, f.radius * 0.35, f.radius * 0.35);
      
      f.life--;
      if (f.life <= 0) {
        this.flashBulbs.splice(i, 1);
      }
    }
  }
}

// ============================================================================
// CLASE: DUST MOTE (POLVO ATMOSFÉRICO EN LOS FOCOS DE LUZ)
// ============================================================================
class DustMote {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = random(width * 0.15, width * 0.85);
    this.y = random(height * 0.1, height * 0.75);
    this.size = random(1.5, 3.5);
    this.alpha = random(40, 140);
    this.seedX = random(1000);
    this.seedY = random(1000);
  }

  update(energy) {
    // El movimiento y la turbulencia aumentan con la energía de la voz
    let speed = 0.006 + energy * 0.02;
    this.x += (noise(frameCount * speed + this.seedX) - 0.5) * (1.2 + energy * 3);
    this.y += (noise(frameCount * speed + this.seedY) - 0.5) * (0.8 + energy * 2);

    // Reubicar si se escapa de los límites
    if (this.y < height * 0.05 || this.y > height * 0.78 || this.x < 0 || this.x > width) {
      this.reset();
    }
  }

  draw() {
    noStroke();
    fill(245, 220, 160, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

// ============================================================================
// SISTEMA DE PARTÍCULAS (SUDOR, CHISPAS, ONDAS DE CHOQUE)
// ============================================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 180; // Control de rendimiento estricto a 60 FPS
  }

  clear() {
    this.particles = [];
  }

  createHitBurst(x, y, facing, type, blocked) {
    let count = blocked ? 8 : (type === 'SPECIAL' ? 45 : (type === 'HOOK' ? 28 : 14));

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      // Gotas de sudor volando por el impacto
      let speed = random(3, type === 'SPECIAL' ? 14 : 9);
      let angle = -HALF_PI + (facing * random(0.2, 1.4)) + random(-0.3, 0.3);
      let vx = cos(angle) * speed;
      let vy = sin(angle) * speed;

      let isSpark = (random() > 0.4);
      let col = isSpark 
        ? color(255, random(180, 240), 80) // Chispa brillante
        : color(200, 230, 255, 190);      // Gota de sudor

      this.particles.push(new CombatParticle({
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        size: random(2, isSpark ? 4 : 5),
        color: col,
        lifespan: int(random(14, 28)),
        hasGravity: !isSpark
      }));
    }

    // Si es un golpe potente, agregar onda expansiva
    if (!blocked && (type === 'HOOK' || type === 'SPECIAL')) {
      this.particles.push(new ShockwaveRing(x, y, type === 'SPECIAL' ? 85 : 55));
    }
  }

  createDodgeWhoosh(x, y) {
    // Línea de aire rápida por esquive
    for (let i = 0; i < 4; i++) {
      this.particles.push(new CombatParticle({
        x: x + random(-15, 15),
        y: y + random(-25, 25),
        vx: -3,
        vy: random(-0.5, 0.5),
        size: 3,
        color: color(255, 255, 255, 110),
        lifespan: 10,
        hasGravity: false
      }));
    }
  }

  updateAndDraw() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.update();
      p.draw();

      if (p.isDead()) {
        this.particles.splice(i, 1);
      }
    }
  }
}

/**
 * Partícula individual de impacto
 */
class CombatParticle {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx;
    this.vy = config.vy;
    this.size = config.size;
    this.color = config.color;
    this.lifespan = config.lifespan;
    this.maxLife = config.lifespan;
    this.hasGravity = config.hasGravity;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.hasGravity) {
      this.vy += 0.38; // Gravedad natural para gotas de sudor
      this.vx *= 0.97;
    } else {
      this.vx *= 0.88;
      this.vy *= 0.88;
    }

    this.lifespan--;
  }

  draw() {
    let alphaProgress = this.lifespan / this.maxLife;
    noStroke();
    let c = this.color;
    fill(red(c), green(c), blue(c), alphaProgress * 255);
    ellipse(this.x, this.y, this.size * alphaProgress, this.size * alphaProgress);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}

/**
 * Onda expansiva circular para golpes fuertes
 */
class ShockwaveRing {
  constructor(x, y, maxRadius) {
    this.x = x;
    this.y = y;
    this.currentRadius = 8;
    this.maxRadius = maxRadius;
    this.lifespan = 12;
    this.maxLife = 12;
  }

  update() {
    this.currentRadius = lerp(this.currentRadius, this.maxRadius, 0.28);
    this.lifespan--;
  }

  draw() {
    let progress = this.lifespan / this.maxLife;
    noFill();
    stroke(255, 240, 180, progress * 200);
    strokeWeight(map(progress, 0, 1, 1, 4));
    ellipse(this.x, this.y, this.currentRadius * 2, this.currentRadius * 1.2);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}

// ============================================================================
// RESPONSIVE / CAMBIO DE TAMAÑO DE VENTANA
// ============================================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Reajustar posiciones base de los boxeadores al redimensionar
  const floorY = height * 0.81;
  if (userFighter) userFighter.baseY = floorY;
  if (rivalFighter) rivalFighter.baseY = floorY;
}
