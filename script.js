const N = 1;
const E = 2;
const S = 4;
const W = 8;
const directionOrder = [N, E, S, W];

const delta = {
  [N]: [-1, 0],
  [E]: [0, 1],
  [S]: [1, 0],
  [W]: [0, -1]
};
const opposite = { [N]: S, [E]: W, [S]: N, [W]: E };
const templates = { straight: [W, E], corner: [N, E] };
const boardEl = document.querySelector('#board');
const messageEl = document.querySelector('#message');
const winMessageEl = document.querySelector('#win-message');
const celebrationEl = document.querySelector('#celebration');
const roundScoreEl = document.querySelector('#round-score');
const winPromptEl = document.querySelector('#win-prompt');
const scoreEl = document.querySelector('#score');
const timerEl = document.querySelector('#timer');
const levelEl = document.querySelector('#level');
const campaignProgressEl = document.querySelector('#campaign-progress');
const campaignProgressLabelEl = document.querySelector('#campaign-progress-label');
const milestoneListEl = document.querySelector('#milestone-list');
const modeEl = document.querySelector('#game-mode');
const modeDescriptionEl = document.querySelector('#mode-description');
const pauseEl = document.querySelector('#pause');
const continueEl = document.querySelector('#continue');
const musicEl = document.querySelector('#background-music');
const musicTrackNameEl = document.querySelector('#music-track-name');
const musicTrackListEl = document.querySelector('#music-track-list');
const musicProgressEl = document.querySelector('#music-progress');
const musicCurrentTimeEl = document.querySelector('#music-current-time');
const musicDurationEl = document.querySelector('#music-duration');
const musicBackEl = document.querySelector('#music-back');
const musicPlayEl = document.querySelector('#music-play');
const musicPlayIconEl = document.querySelector('#music-play-icon');
const musicPlayTextEl = document.querySelector('#music-play-text');
const musicForwardEl = document.querySelector('#music-forward');
const musicMuteEl = document.querySelector('#music-mute');
const musicMuteIconEl = document.querySelector('#music-mute-icon');
const musicStatusEl = document.querySelector('#music-status');
const soundEffectsEl = document.querySelector('#sound-effects');
const soundEffectsStatusEl = document.querySelector('#sound-effects-status');
const totalLevels = 10;
const milestones = [
  { level: 3, title: 'Steady Stream', reward: 250 },
  { level: 5, title: 'Water Champion', reward: 500 },
  { level: 10, title: 'Community Hero', reward: 1000 }
];
const difficultySettings = {
  normal: {
    startingSeconds: 60,
    secondsPerLevel: 4,
    minimumSeconds: 35,
    startingDetours: 0,
    detoursPerTwoLevels: 2,
    maximumDetours: 12,
    description: 'More time to solve each puzzle.'
  },
  hard: {
    startingSeconds: 45,
    secondsPerLevel: 5,
    minimumSeconds: 25,
    startingDetours: 4,
    detoursPerTwoLevels: 2,
    maximumDetours: 14,
    description: 'Less time and a more winding pipe route.'
  }
};
const musicTracks = [
  { title: 'Jump into Water by Alex Zavesa', source: 'audio/alexzavesa-jump-into-water.mp3' },
  { title: 'Water by Nojisuma', source: 'audio/nojisuma-water.mp3' },
  { title: 'Arcade Game BGM by Skidnney', source: 'audio/skidnney-arcade-game-bgm.mp3' },
  { title: 'Peaceful Waters by Turning Pages', source: 'audio/turning_pages-peaceful-waters.mp3' },
  { title: 'Water Chapter Reflections Beneath by u_gsd104f99b', source: 'audio/u_gsd104f99b-water-chapter-reflections-beneath.mp3' }
];

let grid = [];
let score = 0;
let level = 1;
let completedLevels = 0;
const earnedMilestones = new Set();
let seconds = 60;
let ticking = null;
let flowTimeout = null;
let flowing = false;
let paused = false;
let pausedMessage = '';
let flowCallback = null;
let flowDelay = 0;
let flowScheduledAt = 0;
let currentMusicTrack = 0;
let soundEffectsEnabled = true;
let audioContext = null;

// Create the audio context only when a game effect is first played.
function getSoundContext() {
  if (!soundEffectsEnabled) return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    soundEffectsStatusEl.textContent = 'Sound effects are not supported in this browser.';
    return null;
  }

  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {
      soundEffectsStatusEl.textContent = 'Sound effects could not be started.';
    });
  }
  return audioContext;
}

// Fade each tone in and out so button clicks and game results stay gentle.
function playTone(frequency, duration, volume, endFrequency = frequency, delay = 0) {
  const context = getSoundContext();
  if (!context) return;

  const startTime = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Filter soft noise to make a short rushing-water sound.
function playWaterSound(volume = 0.06, duration = 0.18) {
  const context = getSoundContext();
  if (!context) return;

  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const noise = buffer.getChannelData(0);
  for (let index = 0; index < noise.length; index++) {
    noise[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(650, context.currentTime);
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start();
}

function playVictorySound() {
  playTone(523, 0.18, 0.08, 523);
  playTone(659, 0.18, 0.08, 659, 0.16);
  playTone(784, 0.3, 0.08, 784, 0.32);
}

function rotateDirection(direction, rotations) {
  const startIndex = directionOrder.indexOf(direction);
  return directionOrder[(startIndex + rotations) % directionOrder.length];
}

function openings(type, rotations) {
  return templates[type].map(direction => rotateDirection(direction, rotations));
}

function pipeSvg(type) {
  const parts = type === 'straight'
    ? '<line class="edge" x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="50" x2="100" y2="50"/><line class="waterEdge" x1="0" y1="50" x2="100" y2="50"/><line class="water" x1="0" y1="50" x2="100" y2="50"/>'
    : '<path class="edge" d="M50 0 V50 H100"/><path d="M50 0 V50 H100"/><path class="waterEdge" d="M50 0 V50 H100"/><path class="water" d="M50 0 V50 H100"/>';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${parts}</svg>`;
}

function buildSolution(settings) {
  const path = [[0, 0]];
  let row = 0;
  let column = 0;

  while (row < 8 || column < 7) {
    const choices = [];
    if (column < 7) choices.push([row, column + 1]);
    if (row < 8) choices.push([row + 1, column]);
    [row, column] = choices[Math.floor(Math.random() * choices.length)];
    path.push([row, column]);
  }

  const detours = Math.min(
    settings.maximumDetours,
    settings.startingDetours + Math.floor((level - 1) / 2) * settings.detoursPerTwoLevels
  );
  for (let detour = 0; detour < detours; detour++) {
    const occupied = new Set(path.map(([pathRow, pathColumn]) => `${pathRow},${pathColumn}`));
    const candidates = [];

    for (let index = 0; index < path.length - 1; index++) {
      const [fromRow, fromColumn] = path[index];
      const [toRow, toColumn] = path[index + 1];
      const perpendiculars = fromRow === toRow
        ? [[-1, 0], [1, 0]]
        : [[0, -1], [0, 1]];

      for (const [rowOffset, columnOffset] of perpendiculars) {
        const first = [fromRow + rowOffset, fromColumn + columnOffset];
        const second = [toRow + rowOffset, toColumn + columnOffset];
        const inBounds = ([candidateRow, candidateColumn]) =>
          candidateRow >= 0 && candidateRow < 9 && candidateColumn >= 0 && candidateColumn < 8;

        if (inBounds(first) && inBounds(second) &&
            !occupied.has(`${first[0]},${first[1]}`) &&
            !occupied.has(`${second[0]},${second[1]}`)) {
          candidates.push({ index, first, second });
        }
      }
    }

    if (candidates.length === 0) break;
    const { index, first, second } = candidates[Math.floor(Math.random() * candidates.length)];
    path.splice(index + 1, 0, first, second);
  }

  return path;
}

function neededFor(path, index) {
  const directions = [];
  const [row, column] = path[index];

  for (const neighborIndex of [index - 1, index + 1]) {
    const neighbor = path[neighborIndex];
    if (!neighbor) continue;

    const [neighborRow, neighborColumn] = neighbor;
    if (neighborRow < row) directions.push(N);
    else if (neighborRow > row) directions.push(S);
    else if (neighborColumn < column) directions.push(W);
    else directions.push(E);
  }

  if (index === 0) directions.push(W);
  if (index === path.length - 1) directions.push(S);
  return directions;
}

function typeAndRotationFor(directions) {
  for (const type of Object.keys(templates)) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const pipeDirections = openings(type, rotation);
      if (directions.every(direction => pipeDirections.includes(direction)) &&
          pipeDirections.every(direction => directions.includes(direction))) {
        return [type, rotation];
      }
    }
  }
  return ['corner', 0];
}

function clearFlowTimeout() {
  clearTimeout(flowTimeout);
  flowTimeout = null;
  flowCallback = null;
}

function scheduleFlow(callback, delay) {
  flowCallback = callback;
  flowDelay = delay;
  flowScheduledAt = Date.now();
  flowTimeout = setTimeout(() => {
    flowTimeout = null;
    flowCallback = null;
    callback();
  }, delay);
}

function startTimer() {
  ticking = setInterval(() => {
    seconds--;
    timerEl.textContent = formatTime(seconds);
    if (seconds <= 0) {
      clearInterval(ticking);
      ticking = null;
      clearFlowTimeout();
      flowing = false;
      pauseEl.disabled = true;
      messageEl.textContent = 'Time’s up. Restart to try again.';
      playTone(330, 0.35, 0.08, 180);
    }
  }, 1000);
}

function newGame() {
  const settings = difficultySettings[modeEl.value];
  clearInterval(ticking);
  clearFlowTimeout();
  celebrationEl.replaceChildren();
  messageEl.hidden = false;
  winMessageEl.hidden = true;
  paused = false;
  pauseEl.textContent = 'Pause';
  pauseEl.setAttribute('aria-pressed', 'false');
  pauseEl.disabled = false;
  seconds = Math.max(
    settings.minimumSeconds,
    settings.startingSeconds - (level - 1) * settings.secondsPerLevel
  );
  flowing = false;

  const path = buildSolution(settings);
  const pathCells = new Map(path.map(([row, column], index) => [`${row},${column}`, index]));
  grid = Array.from({ length: 9 }, () => Array(8));

  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 8; column++) {
      const key = `${row},${column}`;
      let type = Math.random() < 0.48 ? 'straight' : 'corner';
      let rotation = Math.floor(Math.random() * 4);
      if (pathCells.has(key)) {
        const [pathType, solutionRotation] = typeAndRotationFor(neededFor(path, pathCells.get(key)));
        type = pathType;
        const scramble = type === 'straight'
          ? (Math.random() < 0.5 ? 1 : 3)
          : 1 + Math.floor(Math.random() * 3);
        rotation = (solutionRotation + scramble) % 4;
      }
      grid[row][column] = { type, rotation };
    }
  }

  render();
  messageEl.textContent = 'Tap the pipes to rotate them. Connect then start the water.';
  timerEl.textContent = formatTime(seconds);
  startTimer();
}

function render() {
  boardEl.replaceChildren();

  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 8; column++) {
      const pipe = grid[row][column];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.column = column;
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}: rotate pipe`);
      cell.innerHTML = `<span class="pipe" style="--r:${pipe.rotation * 90}deg">${pipeSvg(pipe.type)}</span>`;
      cell.addEventListener('click', () => rotatePipe(row, column, cell));
      boardEl.appendChild(cell);
    }
  }
}

function rotatePipe(row, column, cell) {
  if (paused || flowing || seconds <= 0) return;
  const pipe = grid[row][column];
  pipe.rotation = (pipe.rotation + 1) % 4;
  cell.querySelector('.pipe').style.setProperty('--r', `${pipe.rotation * 90}deg`);
  playTone(420, 0.06, 0.035, 280);
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function renderMilestones() {
  milestoneListEl.innerHTML = milestones.map(milestone => `
    <li class="milestone-item" data-level="${milestone.level}">
      <div class="milestone-details">
        <strong>Level ${milestone.level}: ${milestone.title}</strong>
        <span>+${milestone.reward} points</span>
      </div>
      <span class="milestone-status"></span>
    </li>
  `).join('');
}

function updateCampaignProgress() {
  campaignProgressEl.value = completedLevels;
  campaignProgressLabelEl.textContent = `${completedLevels} of ${totalLevels} levels complete`;

  const nextMilestoneIndex = milestones.findIndex(milestone => milestone.level > completedLevels);
  milestoneListEl.querySelectorAll('.milestone-item').forEach((item, index) => {
    const milestone = milestones[index];
    const isEarned = earnedMilestones.has(milestone.level);
    const isNext = !isEarned && index === nextMilestoneIndex;
    const status = item.querySelector('.milestone-status');

    item.classList.toggle('is-earned', isEarned);
    item.classList.toggle('is-next', isNext);
    status.textContent = isEarned ? 'Earned' : isNext ? 'Next up' : 'Locked';
  });
}

function startFlow() {
  if (paused || flowing || seconds <= 0) return;
  flowing = true;
  boardEl.querySelectorAll('.cell').forEach(cell => cell.classList.remove('wet'));
  playWaterSound();

  let row = 0;
  let column = 0;
  let entry = W;
  let flowedPipeCount = 0;
  const visited = new Set();

  function advance() {
    const key = `${row},${column}`;
    if (visited.has(key)) {
      fail('The water looped back on itself.');
      return;
    }
    visited.add(key);

    const cell = boardEl.querySelector(`[data-row="${row}"][data-column="${column}"]`);
    const pipe = grid[row][column];
    const pipeOpenings = openings(pipe.type, pipe.rotation);
    if (!pipeOpenings.includes(entry)) {
      fail('Leak! That pipe does not connect.');
      return;
    }

    cell.classList.add('wet');
    flowedPipeCount++;
    if (flowedPipeCount % 3 === 0) playWaterSound(0.035, 0.12);
    const exit = pipeOpenings.find(direction => direction !== entry);
    if (exit === undefined) {
      fail('Dead end.');
      return;
    }
    if (row === 8 && column === 7 && exit === S) {
      win();
      return;
    }

    const [rowDelta, columnDelta] = delta[exit];
    const nextRow = row + rowDelta;
    const nextColumn = column + columnDelta;
    if (nextRow < 0 || nextRow > 8 || nextColumn < 0 || nextColumn > 7) {
      fail('The water ran off the board.');
      return;
    }

    const nextPipe = grid[nextRow][nextColumn];
    if (!openings(nextPipe.type, nextPipe.rotation).includes(opposite[exit])) {
      scheduleFlow(() => fail('Leak! Two pipes do not line up.'), 180);
      return;
    }

    row = nextRow;
    column = nextColumn;
    entry = opposite[exit];
    scheduleFlow(advance, 105);
  }

  advance();
}

function fail(text) {
  clearFlowTimeout();
  flowing = false;
  pauseEl.disabled = false;
  messageEl.textContent = `${text} Keep rotating and try again.`;
  boardEl.classList.add('flash');
  playTone(260, 0.24, 0.07, 130);
  setTimeout(() => boardEl.classList.remove('flash'), 550);
}

function win() {
  clearInterval(ticking);
  ticking = null;
  clearFlowTimeout();
  pauseEl.disabled = true;
  completedLevels = Math.max(completedLevels, level);
  const baseGain = 100 + seconds * 5;
  const milestone = milestones.find(item => item.level === level);
  const milestoneReward = milestone && !earnedMilestones.has(level) ? milestone.reward : 0;
  if (milestoneReward > 0) earnedMilestones.add(level);
  const gain = baseGain + milestoneReward;
  score += gain;
  scoreEl.textContent = `Score: ${score}`;
  updateCampaignProgress();
  messageEl.hidden = true;
  roundScoreEl.textContent = milestoneReward > 0
    ? `+${baseGain} points + ${milestoneReward} milestone bonus: ${milestone.title}`
    : `+${baseGain} points${milestone ? ' (milestone already earned)' : ''}`;
  winMessageEl.hidden = false;
  const campaignComplete = level === totalLevels;
  winMessageEl.querySelector('h2').textContent = campaignComplete ? 'Campaign complete!' : 'You win!';
  winPromptEl.textContent = campaignComplete
    ? `You completed all ${totalLevels} levels. Final score: ${score}.`
    : 'Continue to the next level?';
  continueEl.hidden = campaignComplete;
  celebrate();
  playVictorySound();
  if (!campaignComplete) continueEl.focus();
}

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#2e9df7', '#ffc907', '#8bd1cb', '#f4c38f'];

  for (let index = 0; index < 36; index++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${2.4 + Math.random() * 1.2}s`;
    piece.addEventListener('animationend', () => piece.remove());
    celebrationEl.append(piece);
  }
}

function togglePause() {
  if (seconds <= 0) return;

  paused = !paused;
  pauseEl.textContent = paused ? 'Resume' : 'Pause';
  pauseEl.setAttribute('aria-pressed', String(paused));

  if (paused) {
    clearInterval(ticking);
    ticking = null;
    if (flowTimeout) {
      flowDelay = Math.max(0, flowDelay - (Date.now() - flowScheduledAt));
      clearTimeout(flowTimeout);
      flowTimeout = null;
    }
    pausedMessage = messageEl.textContent;
    messageEl.textContent = 'Game paused.';
    return;
  }

  messageEl.textContent = pausedMessage;
  startTimer();
  if (flowCallback) scheduleFlow(flowCallback, flowDelay);
}

musicEl.volume = 0.25;

function formatMusicTime(time) {
  if (!Number.isFinite(time) || time < 0) return '--:--';

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateMusicTime() {
  musicCurrentTimeEl.textContent = formatMusicTime(musicEl.currentTime);
  musicProgressEl.value = String(musicEl.currentTime);
}

function updateMusicDuration() {
  const hasDuration = Number.isFinite(musicEl.duration) && musicEl.duration > 0;
  musicDurationEl.textContent = formatMusicTime(musicEl.duration);
  musicProgressEl.max = hasDuration ? String(musicEl.duration) : '0';
  musicProgressEl.disabled = !hasDuration;
  updateMusicTime();
}

function updateMusicPlaybackUI(isPlaying) {
  musicPlayIconEl.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
  musicPlayTextEl.textContent = isPlaying ? 'Pause' : 'Play';
  musicPlayEl.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Play'} background music`);
  musicStatusEl.textContent = isPlaying
    ? 'Background music is playing.'
    : 'Background music is paused.';
}

function updateMusicMuteUI(isMuted) {
  musicMuteIconEl.className = isMuted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
  musicMuteEl.querySelector('span').textContent = isMuted ? 'Unmute' : 'Mute';
  musicMuteEl.setAttribute('aria-pressed', String(isMuted));
  musicMuteEl.setAttribute('aria-label', isMuted ? 'Unmute background music' : 'Mute background music');
  musicStatusEl.textContent = isMuted
    ? 'Background music is muted.'
    : 'Background music is unmuted.';
}

function updateSoundToggleUI(isEnabled) {
  soundEffectsEl.setAttribute('aria-pressed', String(isEnabled));
  soundEffectsEl.setAttribute('aria-label', isEnabled ? 'Turn sound effects off' : 'Turn sound effects on');
  soundEffectsEl.querySelector('span').textContent = `Sound effects: ${isEnabled ? 'On' : 'Off'}`;
  soundEffectsEl.querySelector('i').className = isEnabled
    ? 'bi bi-volume-up-fill'
    : 'bi bi-volume-mute-fill';
  soundEffectsStatusEl.textContent = isEnabled
    ? 'Sound effects are on.'
    : 'Sound effects are off.';
}

function renderMusicTracks() {
  musicTracks.forEach((track, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'music-track';
    button.type = 'button';
    button.textContent = track.title;
    button.setAttribute('aria-current', String(index === currentMusicTrack));
    button.addEventListener('click', () => selectMusicTrack(index));
    item.append(button);
    musicTrackListEl.append(item);
  });
}

function selectMusicTrack(index, shouldPlay = !musicEl.paused) {
  currentMusicTrack = index;
  const track = musicTracks[currentMusicTrack];

  musicTrackNameEl.textContent = track.title;
  musicTrackListEl.querySelectorAll('.music-track').forEach((button, trackIndex) => {
    button.setAttribute('aria-current', String(trackIndex === currentMusicTrack));
  });
  musicEl.src = track.source;
  musicEl.load();
  updateMusicDuration();

  if (shouldPlay) {
    musicEl.play().catch(() => {
      musicStatusEl.textContent = 'Background music could not be started.';
    });
  }
}

function changeMusicTrack(trackDelta, shouldPlay = !musicEl.paused) {
  const nextTrack = (currentMusicTrack + trackDelta + musicTracks.length) % musicTracks.length;
  selectMusicTrack(nextTrack, shouldPlay);
}

renderMilestones();
updateCampaignProgress();
renderMusicTracks();
musicPlayEl.addEventListener('click', () => {
  if (musicEl.paused) {
    // Playing after a click works with browsers that block autoplay.
    musicEl.play().catch(() => {
      musicStatusEl.textContent = 'Background music could not be started.';
    });
    return;
  }

  musicEl.pause();
});

musicEl.addEventListener('play', () => updateMusicPlaybackUI(true));
musicEl.addEventListener('pause', () => updateMusicPlaybackUI(false));
musicEl.addEventListener('error', () => {
  musicStatusEl.textContent = 'Background music could not be loaded.';
});
musicEl.addEventListener('ended', () => changeMusicTrack(1, true));
musicEl.addEventListener('loadedmetadata', updateMusicDuration);
musicEl.addEventListener('durationchange', updateMusicDuration);
musicEl.addEventListener('timeupdate', updateMusicTime);
if (musicEl.readyState > 0) updateMusicDuration();

musicBackEl.addEventListener('click', () => changeMusicTrack(-1));
musicForwardEl.addEventListener('click', () => changeMusicTrack(1));
musicProgressEl.addEventListener('input', () => {
  musicEl.currentTime = Number(musicProgressEl.value);
  updateMusicTime();
});

musicMuteEl.addEventListener('click', () => {
  musicEl.muted = !musicEl.muted;
  updateMusicMuteUI(musicEl.muted);
});

soundEffectsEl.addEventListener('click', () => {
  soundEffectsEnabled = !soundEffectsEnabled;
  updateSoundToggleUI(soundEffectsEnabled);
});

document.querySelector('#restart').addEventListener('click', newGame);
document.querySelector('#flow').addEventListener('click', startFlow);
modeEl.addEventListener('change', () => {
  const settings = difficultySettings[modeEl.value];
  level = 1;
  completedLevels = 0;
  earnedMilestones.clear();
  score = 0;
  levelEl.textContent = `Level ${level}`;
  scoreEl.textContent = `Score: ${score}`;
  updateCampaignProgress();
  modeDescriptionEl.textContent = settings.description;
  newGame();
});
continueEl.addEventListener('click', () => {
  if (level >= totalLevels) return;
  level++;
  levelEl.textContent = `Level ${level}`;
  newGame();
});
pauseEl.addEventListener('click', togglePause);
newGame();