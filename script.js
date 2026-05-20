// ==========================================
// 1. App Navigation (Tabs)
// ==========================================
function switchTab(tabId, navBtn) {
    vibrate();
    // Atualiza Nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    navBtn.classList.add('active');
    
    // Atualiza Painel
    document.querySelectorAll('.tab-pane').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    // Pausar players ao mudar de aba para não sobrepor áudio
    if (tabId === 'tab-separator') {
        if (!htmlAudio.paused) htmlAudio.pause();
        updateSeparatorSelect();
    } else {
        const sepAudioPlayer = document.getElementById('separator-audio-player');
        if (sepAudioPlayer && !sepAudioPlayer.paused) {
            sepAudioPlayer.pause();
        }
    }
}

// ==========================================
// 2. Feedback Tátil & UX
// ==========================================
function vibrate() {
    if (navigator.vibrate) {
        navigator.vibrate(40);
    }
}

function clearGlow() {
    document.querySelectorAll('.btn.pulsing').forEach(btn => btn.classList.remove('pulsing'));
}

// ==========================================
// 3. Web Audio API (Testes)
// ==========================================
let audioCtx = null;
let currentNodes = [];

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function stopAudio() {
    vibrate();
    currentNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
    });
    currentNodes = [];
    clearGlow();
    document.getElementById('mono-stereo-hint').textContent = "Mono: Mesmo som. Estéreo: Som diferente.";
}

function createOscillator(freq, panValue) {
    const osc = audioCtx.createOscillator();
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);

    const panner = audioCtx.createStereoPanner();
    panner.pan.value = panValue;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(audioCtx.destination);
    return { osc, gain };
}

function playSound(freq, pan, duration = 0, btnId = null) {
    initAudio();
    stopAudio();
    if (btnId) document.getElementById(btnId).classList.add('pulsing');

    const { osc, gain } = createOscillator(freq, pan);
    osc.start();
    currentNodes.push(osc);

    if (duration > 0) {
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime + duration - 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
        setTimeout(() => clearGlow(), duration * 1000);
    }
}

function testSide(pan, btnId) { vibrate(); playSound(440, pan, 0, btnId); }
function testFreq(freq, btnId) { vibrate(); playSound(freq, 0, 0, btnId); }

function testMono(btnId) {
    vibrate(); initAudio(); stopAudio();
    document.getElementById(btnId).classList.add('pulsing');
    document.getElementById('mono-stereo-hint').textContent = "MONO: Som centralizado.";
    const o1 = createOscillator(400, 0); const o2 = createOscillator(800, 0);
    o1.osc.start(); o2.osc.start();
    currentNodes.push(o1.osc, o2.osc);
}

function testStereo(btnId) {
    vibrate(); initAudio(); stopAudio();
    document.getElementById(btnId).classList.add('pulsing');
    document.getElementById('mono-stereo-hint').textContent = "ESTÉREO: Grave Esq. / Agudo Dir.";
    const oL = createOscillator(400, -1); const oR = createOscillator(800, 1);
    oL.osc.start(); oR.osc.start();
    currentNodes.push(oL.osc, oR.osc);
}

async function testAuto() {
    vibrate(); initAudio(); stopAudio();
    const btn = document.getElementById('btnAuto');
    btn.disabled = true; btn.textContent = '🔁 Testando...';
    btn.classList.add('pulsing');
    const wait = ms => new Promise(r => setTimeout(r, ms));

    playSound(440, -1, 1, 'btn-left'); await wait(1000);
    playSound(440, 1, 1, 'btn-right'); await wait(1000);
    playSound(440, 0, 1, 'btn-both'); await wait(1000);

    btn.disabled = false; btn.textContent = '🔁 Sequência Automática';
    btn.classList.remove('pulsing');
}

// ==========================================
// 4. Music Player
// ==========================================
const htmlAudio = document.getElementById('html-audio-player');
const playPauseBtn = document.getElementById('btn-play-pause');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const trackNameLabel = document.getElementById('current-track-name');
let currentObjectUrl = null;

let allTracks = [];
let currentTrackIndex = -1;
let loopMode = 1; // 0: Sequência, 1: Repetir Lista, 2: Repetir Uma
const loopModes = [
    { icon: '➡️', title: 'Tocar Sequência' },
    { icon: '🔁', title: 'Repetir Lista' },
    { icon: '🔂', title: 'Repetir Uma' }
];

function toggleLoopMode() {
    vibrate();
    loopMode = (loopMode + 1) % loopModes.length;
    const btn = document.getElementById('btn-loop');
    if (btn) btn.textContent = loopModes[loopMode].icon;
    
    let toast = document.createElement('div');
    toast.className = 'loop-toast';
    toast.textContent = loopModes[loopMode].title;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function playNextTrackManually() {
    vibrate();
    if (allTracks.length === 0) return;
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= allTracks.length) {
        nextIndex = 0;
    }
    loadTrackToPlayer(allTracks[nextIndex]);
}

function playPrevTrack() {
    vibrate();
    if (allTracks.length === 0) return;
    
    // Se a música tocou mais de 3 segundos, voltar pro começo da atual
    if (htmlAudio.currentTime > 3) {
        htmlAudio.currentTime = 0;
        return;
    }
    
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
        prevIndex = allTracks.length - 1;
    }
    loadTrackToPlayer(allTracks[prevIndex]);
}

function fmtTime(s) {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60); const sc = Math.floor(s % 60);
    return `${m}:${sc.toString().padStart(2, '0')}`;
}

htmlAudio.addEventListener('loadedmetadata', () => {
    seekSlider.max = Math.floor(htmlAudio.duration);
    timeTotal.textContent = fmtTime(htmlAudio.duration);
});
htmlAudio.addEventListener('timeupdate', () => {
    seekSlider.value = Math.floor(htmlAudio.currentTime);
    timeCurrent.textContent = fmtTime(htmlAudio.currentTime);
});
htmlAudio.addEventListener('play', () => { playPauseBtn.textContent = '⏸️'; playPauseBtn.classList.add('pulsing'); });
htmlAudio.addEventListener('pause', () => { playPauseBtn.textContent = '▶️'; playPauseBtn.classList.remove('pulsing'); });
htmlAudio.addEventListener('ended', () => { 
    if (loopMode === 2) {
        htmlAudio.currentTime = 0;
        htmlAudio.play();
        return;
    }
    
    if (allTracks.length === 0) {
        playPauseBtn.textContent = '▶️'; 
        playPauseBtn.classList.remove('pulsing');
        return;
    }
    
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= allTracks.length) {
        if (loopMode === 1) {
            nextIndex = 0;
        } else {
            // Sequência (para no fim da lista)
            playPauseBtn.textContent = '▶️'; 
            playPauseBtn.classList.remove('pulsing');
            return;
        }
    }
    loadTrackToPlayer(allTracks[nextIndex]);
});

seekSlider.addEventListener('input', () => htmlAudio.currentTime = seekSlider.value);
volumeSlider.addEventListener('input', () => htmlAudio.volume = volumeSlider.value / 100);

function togglePlayMusic() {
    vibrate();
    if (!htmlAudio.src) return;
    stopAudio(); // Para osciladores
    if (htmlAudio.paused) htmlAudio.play();
    else htmlAudio.pause();
}

function loadTrackToPlayer(track) {
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
    if (track.type === 'blob') {
        currentObjectUrl = URL.createObjectURL(track.data);
        htmlAudio.src = currentObjectUrl;
    } else htmlAudio.src = track.url;
    
    trackNameLabel.textContent = track.name;
    currentTrackIndex = allTracks.findIndex(t => t.id === track.id);
    
    htmlAudio.load(); togglePlayMusic();
}

// ==========================================
// 5. Database (IndexedDB)
// ==========================================
let db;
const req = indexedDB.open("FoneCheckProDB", 1);
req.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; renderLibrary(); };

function saveTrack(obj) {
    const tx = db.transaction(['tracks'], 'readwrite');
    tx.objectStore('tracks').add(obj);
    tx.oncomplete = () => renderLibrary();
}

function deleteTrack(id) {
    vibrate();
    const tx = db.transaction(['tracks'], 'readwrite');
    tx.objectStore('tracks').delete(id);
    tx.oncomplete = () => renderLibrary();
}

document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    saveTrack({ id: Date.now(), name: file.name, type: 'blob', data: file });
    e.target.value = ''; vibrate();
});

function addMusicFromUrl() {
    const inp = document.getElementById('urlInput');
    const url = inp.value.trim();
    if (!url) return;
    
    // Verificar se é link do youtube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        alert("Links do YouTube não são suportados diretamente. O aplicativo precisa de links diretos para arquivos de áudio (terminando em .mp3, .wav, etc). Tente baixar o áudio primeiro e usar a opção 'Arquivo'.");
        return;
    }
    
    let name = url.substring(url.lastIndexOf('/') + 1);
    if (!name || name.length > 15) name = "Link: " + url.substring(0, 10) + "...";
    saveTrack({ id: Date.now(), name: name, type: 'url', url: url });
    inp.value = ''; vibrate();
}

function renderLibrary() {
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    const reqStore = db.transaction(['tracks'], 'readonly').objectStore('tracks').getAll();
    reqStore.onsuccess = () => {
        allTracks = reqStore.result;
        updateSeparatorSelect();
        if (allTracks.length === 0) { list.innerHTML = '<div style="font-size:0.75rem; color:#94a3b8; text-align:center; padding: 10px;">Vazia</div>'; return; }
        
        allTracks.forEach(t => {
            const div = document.createElement('div'); div.className = 'lib-item';
            div.innerHTML = `
                <span class="lib-name">${t.name}</span>
                <div class="lib-actions">
                    <button class="lib-btn" onclick="vibrate(); loadTrackToPlayer(${JSON.stringify(t).replace(/"/g, '&quot;')})">▶️</button>
                    <button class="lib-btn" style="color:#ef4444;" onclick="deleteTrack(${t.id})">🗑️</button>
                </div>
            `;
            // Necessário contornar JSON stringify para Blob, então injetamos via event listener
            const playBtn = div.querySelector('button');
            playBtn.onclick = () => { vibrate(); loadTrackToPlayer(t); };
            list.appendChild(div);
        });
    };
}

// SW Register
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
}

// ==========================================
// 6. Separador de Instrumentos (Web Audio API)
// ==========================================
let sepAudioCtx = null;
let sepSourceNode = null;
let filterBass = null, filterVocals = null, filterMelody = null;
let gainBass = null, gainVocals = null, gainMelody = null;

// Nós de roteamento para cancelamento vocal (fase)
let gainStereo = null;
let splitter = null;
let invertGain = null;
let gainVocalCancel = null;

let isMutedBass = false;
let isMutedVocals = false;
let isMutedMelody = false;
let valBass = 100;
let valVocals = 100;
let valMelody = 100;

let currentSepTrackIndex = -1;
let currentSepObjectUrl = null;
let currentExtractionMode = 'normal'; // 'normal', 'vocals', 'instrumental'

function initSeparatorAudio() {
    if (sepAudioCtx) return;
    
    const player = document.getElementById('separator-audio-player');
    if (!player) return;
    
    // Cria contexto de áudio
    sepAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Cria fonte a partir do elemento de áudio
    sepSourceNode = sepAudioCtx.createMediaElementSource(player);
    
    // Filtro Passa-Baixas (Graves / Baixo / Bateria)
    filterBass = sepAudioCtx.createBiquadFilter();
    filterBass.type = 'lowpass';
    filterBass.frequency.setValueAtTime(250, sepAudioCtx.currentTime); 
    
    // Filtro Passa-Faixa (Médios / Vocais)
    filterVocals = sepAudioCtx.createBiquadFilter();
    filterVocals.type = 'bandpass';
    filterVocals.frequency.setValueAtTime(1200, sepAudioCtx.currentTime); 
    filterVocals.Q.setValueAtTime(1.0, sepAudioCtx.currentTime); 
    
    // Filtro Passa-Altas (Agudos / Guitarras / Brilho)
    filterMelody = sepAudioCtx.createBiquadFilter();
    filterMelody.type = 'highpass';
    filterMelody.frequency.setValueAtTime(4000, sepAudioCtx.currentTime); 

    // Cria ganhos (volumes)
    gainBass = sepAudioCtx.createGain();
    gainVocals = sepAudioCtx.createGain();
    gainMelody = sepAudioCtx.createGain();
    
    // Define valores iniciais de ganho
    gainBass.gain.setValueAtTime(1.0, sepAudioCtx.currentTime);
    gainVocals.gain.setValueAtTime(1.0, sepAudioCtx.currentTime);
    gainMelody.gain.setValueAtTime(1.0, sepAudioCtx.currentTime);

    // Cria nós de roteamento
    gainStereo = sepAudioCtx.createGain();
    gainStereo.gain.setValueAtTime(1.0, sepAudioCtx.currentTime); // Normal começa com volume cheio
    
    splitter = sepAudioCtx.createChannelSplitter(2);
    invertGain = sepAudioCtx.createGain();
    invertGain.gain.setValueAtTime(-1.0, sepAudioCtx.currentTime); // Inverte a fase do canal direito
    
    gainVocalCancel = sepAudioCtx.createGain();
    gainVocalCancel.gain.setValueAtTime(0.0, sepAudioCtx.currentTime); // Cancelamento começa zerado

    // Conecta a fonte de áudio aos roteamentos
    sepSourceNode.connect(gainStereo);
    sepSourceNode.connect(splitter);

    // Conecta canais para subtração (L - R)
    splitter.connect(gainVocalCancel, 0); // Canal Esquerdo entra normal
    splitter.connect(invertGain, 1);       // Canal Direito entra no inversor
    invertGain.connect(gainVocalCancel);   // Direito invertido soma com o Esquerdo no ganho de cancelamento

    // Conecta os canais de roteamento aos filtros de frequências
    gainStereo.connect(filterBass);
    gainStereo.connect(filterVocals);
    gainStereo.connect(filterMelody);

    gainVocalCancel.connect(filterBass);
    gainVocalCancel.connect(filterVocals);
    gainVocalCancel.connect(filterMelody);
    
    // Conecta filtros aos ganhos
    filterBass.connect(gainBass);
    filterVocals.connect(gainVocals);
    filterMelody.connect(gainMelody);
    
    // Conecta os ganhos ao destino final (alto-falantes)
    gainBass.connect(sepAudioCtx.destination);
    gainVocals.connect(sepAudioCtx.destination);
    gainMelody.connect(sepAudioCtx.destination);
}

function updateSeparatorSelect() {
    const select = document.getElementById('sep-track-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione da biblioteca...</option>';
    
    allTracks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (currentSepTrackIndex !== -1 && allTracks[currentSepTrackIndex].id === t.id) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

function loadTrackToSeparator() {
    vibrate();
    const select = document.getElementById('sep-track-select');
    const player = document.getElementById('separator-audio-player');
    const trackId = parseInt(select.value);
    if (!trackId || !player) return;
    
    const track = allTracks.find(t => t.id === trackId);
    if (!track) return;
    
    initSeparatorAudio();
    if (sepAudioCtx && sepAudioCtx.state === 'suspended') {
        sepAudioCtx.resume();
    }
    
    // Pausa o player principal
    if (!htmlAudio.paused) htmlAudio.pause();
    
    // Libera URL antiga do Blob para liberar memória
    if (currentSepObjectUrl) { URL.revokeObjectURL(currentSepObjectUrl); currentSepObjectUrl = null; }
    
    if (track.type === 'blob') {
        currentSepObjectUrl = URL.createObjectURL(track.data);
        player.src = currentSepObjectUrl;
    } else {
        player.src = track.url;
    }
    
    document.getElementById('sep-track-name').textContent = track.name;
    currentSepTrackIndex = allTracks.findIndex(t => t.id === track.id);
    
    player.load();
    player.play().catch(e => console.log("Play falhou: ", e));
    
    document.getElementById('btn-sep-play-pause').textContent = '⏸️';
}

function togglePlaySeparator() {
    vibrate();
    const player = document.getElementById('separator-audio-player');
    if (!player || !player.src) return;
    
    initSeparatorAudio();
    if (sepAudioCtx && sepAudioCtx.state === 'suspended') {
        sepAudioCtx.resume();
    }
    
    if (player.paused) {
        if (!htmlAudio.paused) htmlAudio.pause();
        player.play().catch(e => console.log("Play falhou:", e));
    } else {
        player.pause();
    }
}

function updateSeparatorGain(channel, value) {
    initSeparatorAudio();
    const valPercent = document.getElementById(`val-${channel}`);
    if (valPercent) valPercent.textContent = `${value}%`;
    
    const gainValue = parseFloat(value) / 100.0;
    
    if (sepAudioCtx) {
        if (channel === 'vocals') {
            valVocals = value;
            if (!isMutedVocals) gainVocals.gain.setValueAtTime(gainValue, sepAudioCtx.currentTime);
        } else if (channel === 'melody') {
            valMelody = value;
            if (!isMutedMelody) gainMelody.gain.setValueAtTime(gainValue, sepAudioCtx.currentTime);
        } else if (channel === 'bass') {
            valBass = value;
            if (!isMutedBass) gainBass.gain.setValueAtTime(gainValue, sepAudioCtx.currentTime);
        }
    }
}

function toggleMuteChannel(channel) {
    vibrate();
    initSeparatorAudio();
    const btn = document.getElementById(`btn-mute-${channel}`);
    if (!btn) return;
    
    if (sepAudioCtx) {
        if (channel === 'vocals') {
            isMutedVocals = !isMutedVocals;
            if (isMutedVocals) {
                gainVocals.gain.setValueAtTime(0, sepAudioCtx.currentTime);
                btn.classList.add('btn-mute-active');
                btn.textContent = 'Muted';
            } else {
                const gainValue = parseFloat(valVocals) / 100.0;
                gainVocals.gain.setValueAtTime(gainValue, sepAudioCtx.currentTime);
                btn.classList.remove('btn-mute-active');
                btn.textContent = 'Mute';
            }
        } else if (channel === 'melody') {
            isMutedMelody = !isMutedMelody;
            if (isMutedMelody) {
                gainMelody.gain.setValueAtTime(0, sepAudioCtx.currentTime);
                btn.classList.add('btn-mute-active');
                btn.textContent = 'Muted';
            } else {
                const gainValue = parseFloat(valMelody) / 100.0;
                gainMelody.gain.setValueAtTime(gainValue, sepAudioCtx.currentTime);
                btn.classList.remove('btn-mute-active');
                btn.textContent = 'Mute';
            }
        } else if (channel === 'bass') {
            isMutedBass = !isMutedBass;
            if (isMutedBass) {
                gainBass.gain.setValueAtTime(0, sepAudioCtx.currentTime);
                btn.classList.add('btn-mute-active');
                btn.textContent = 'Muted';
            } else {
                const gainValue = parseFloat(valBass) / 100.0;
                gainBass.gain.setValueAtTime(gainValue, sepAudioCtx.currentTime);
                btn.classList.remove('btn-mute-active');
                btn.textContent = 'Mute';
            }
        }
    }
}

// Configuração dos controles do Separador
window.addEventListener('load', () => {
    const sepAudioPlayer = document.getElementById('separator-audio-player');
    const sepSeekSlider = document.getElementById('sep-seek-slider');
    const sepTimeCurrent = document.getElementById('sep-time-current');
    const sepTimeTotal = document.getElementById('sep-time-total');
    const sepPlayPauseBtn = document.getElementById('btn-sep-play-pause');

    if (sepAudioPlayer && sepSeekSlider && sepTimeCurrent && sepTimeTotal && sepPlayPauseBtn) {
        sepAudioPlayer.addEventListener('loadedmetadata', () => {
            sepSeekSlider.max = Math.floor(sepAudioPlayer.duration);
            sepTimeTotal.textContent = fmtTime(sepAudioPlayer.duration);
        });
        sepAudioPlayer.addEventListener('timeupdate', () => {
            sepSeekSlider.value = Math.floor(sepAudioPlayer.currentTime);
            sepTimeCurrent.textContent = fmtTime(sepAudioPlayer.currentTime);
        });
        sepAudioPlayer.addEventListener('play', () => { 
            sepPlayPauseBtn.textContent = '⏸️'; 
            sepPlayPauseBtn.classList.add('pulsing');
        });
        sepAudioPlayer.addEventListener('pause', () => { 
            sepPlayPauseBtn.textContent = '▶️'; 
            sepPlayPauseBtn.classList.remove('pulsing'); 
        });
        sepAudioPlayer.addEventListener('ended', () => {
            sepPlayPauseBtn.textContent = '▶️'; 
            sepPlayPauseBtn.classList.remove('pulsing');
            sepAudioPlayer.currentTime = 0;
        });
        sepSeekSlider.addEventListener('input', () => sepAudioPlayer.currentTime = sepSeekSlider.value);
    }
});

function setSeparatorMode(mode) {
    vibrate();
    initSeparatorAudio();
    
    currentExtractionMode = mode;
    
    // Atualiza botões na UI
    document.querySelectorAll('#tab-separator .btn-group-row .btn').forEach(btn => {
        btn.classList.remove('btn-action');
        btn.style.background = '';
        btn.style.border = '';
        btn.style.color = '';
    });
    
    const activeBtn = document.getElementById(`btn-mode-${mode === 'instrumental' ? 'inst' : mode}`);
    if (activeBtn) {
        activeBtn.classList.add('btn-action');
        activeBtn.style.background = '#1d2b42';
        activeBtn.style.border = '1px solid #3b82f6';
        activeBtn.style.color = '#fff';
    }
    
    if (!sepAudioCtx) return;
    
    if (mode === 'normal') {
        // Ativa rota estéreo, desativa cancelamento vocal
        gainStereo.gain.setValueAtTime(1.0, sepAudioCtx.currentTime);
        gainVocalCancel.gain.setValueAtTime(0.0, sepAudioCtx.currentTime);
        
        // Restaura todos os volumes das frequências
        restoreGains();
    } else if (mode === 'vocals') {
        // Ativa rota estéreo, desativa cancelamento vocal
        gainStereo.gain.setValueAtTime(1.0, sepAudioCtx.currentTime);
        gainVocalCancel.gain.setValueAtTime(0.0, sepAudioCtx.currentTime);
        
        // Isola os vocais zerando as outras frequências
        muteAllExcept('vocals');
    } else if (mode === 'instrumental') {
        // Desativa rota estéreo, ativa cancelamento vocal (L - R)
        gainStereo.gain.setValueAtTime(0.0, sepAudioCtx.currentTime);
        gainVocalCancel.gain.setValueAtTime(1.0, sepAudioCtx.currentTime);
        
        // Mantém as frequências para tocar o acompanhamento instrumental
        restoreGains();
    }
}

function muteAllExcept(activeChannel) {
    const channels = ['bass', 'vocals', 'melody'];
    channels.forEach(ch => {
        const slider = document.getElementById(`slider-${ch}`);
        const valLabel = document.getElementById(`val-${ch}`);
        if (ch === activeChannel) {
            if (slider) slider.value = 100;
            if (valLabel) valLabel.textContent = '100%';
            updateSeparatorGain(ch, 100);
        } else {
            if (slider) slider.value = 0;
            if (valLabel) valLabel.textContent = '0%';
            updateSeparatorGain(ch, 0);
        }
    });
}

function restoreGains() {
    const channels = ['bass', 'vocals', 'melody'];
    channels.forEach(ch => {
        const slider = document.getElementById(`slider-${ch}`);
        const valLabel = document.getElementById(`val-${ch}`);
        if (slider) slider.value = 100;
        if (valLabel) valLabel.textContent = '100%';
        updateSeparatorGain(ch, 100);
        
        // Desmuta caso estivesse mutado
        const btn = document.getElementById(`btn-mute-${ch}`);
        if (btn && btn.classList.contains('btn-mute-active')) {
            toggleMuteChannel(ch);
        }
    });
}
