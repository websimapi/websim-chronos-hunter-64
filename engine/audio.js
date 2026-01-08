export class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.musicNode = null;
        this.enabled = false;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.enabled = true;
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound ${name}:`, e);
        }
    }

    playSound(name, volume = 1.0, pitch = 1.0, position = null) {
        if (!this.enabled || !this.buffers[name]) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.playbackRate.value = pitch;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        if (position) {
            // Simple stereo panner for spatial approximations
            const panner = this.ctx.createStereoPanner();
            // Clamp pan between -1 and 1 based on relative position to camera
            // Ideally we'd use PannerNode for full 3D, but StereoPanner is cheaper and punchier for this retro feel
            // Calculate pan based on position relative to listener (assumed 0,0,0 forward -Z)
            // This is a placeholder for real spatial logic passed from the game loop
            panner.pan.value = Math.max(-1, Math.min(1, position.x / 20)); 
            source.connect(panner);
            panner.connect(gainNode);
        } else {
            source.connect(gainNode);
        }

        gainNode.connect(this.ctx.destination);
        source.start(0);
    }

    playMusic(name, volume = 0.5) {
        if (!this.enabled || !this.buffers[name]) return;
        if (this.musicNode) this.musicNode.stop();

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.loop = true;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
        this.musicNode = source;
    }

    // Procedural SFX fallback
    playShoot() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }
}