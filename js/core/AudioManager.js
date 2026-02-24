export class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.enabled = true;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterVolume = this.ctx.createGain();
            this.masterVolume.gain.value = 0.3;
            this.masterVolume.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(soundName) {
        if (!this.enabled || !this.initialized) return;
        this.resume();
        switch (soundName) {
            case 'bomb_place': this.playTone(150, 0.1, 'sine'); break;
            case 'explosion': this.playNoise(0.25); break;
            case 'powerup': this.playTone(500, 0.12, 'sine', 800); break;
            case 'player_death': this.playTone(300, 0.35, 'sawtooth', 80); break;
            case 'menu_select': this.playTone(440, 0.06, 'sine', 550); break;
            case 'countdown': this.playTone(600, 0.15, 'sine'); break;
            case 'go': this.playTone(800, 0.2, 'sine', 1000); break;
            case 'win': this.playChord([523, 659, 784], 0.4); break;
        }
    }

    playTone(freq, duration, type, endFreq = null) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (endFreq) {
            osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterVolume);
        osc.start();
        osc.stop(this.ctx.currentTime + duration + 0.01);
    }

    playNoise(duration) {
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);
        source.start();
    }

    playChord(freqs, duration) {
        for (const freq of freqs) {
            this.playTone(freq, duration, 'sine');
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}
