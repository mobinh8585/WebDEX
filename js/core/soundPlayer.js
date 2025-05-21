import { state } from './state.js';

export const SoundPlayer = {
    /** Initializes the AudioContext. */
    init: () => {
        try {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API not supported.");
        }
    },
    /** Plays a predefined sound effect. */
    playSound: (type) => {
        if (!state.audioContext) return;
        try {
            const oscillator = state.audioContext.createOscillator();
            const gainNode = state.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(state.audioContext.destination);

            gainNode.gain.setValueAtTime(0.05, state.audioContext.currentTime); // Start with low volume

            let freq1 = 0, freq2 = 0, duration = 0.05, waveType = 'sine';

            switch (type) {
                case 'click': freq1 = 880; break;
                case 'windowOpen': freq1 = 330; freq2 = 660; duration = 0.1; waveType = 'triangle'; break;
                case 'windowClose': freq1 = 660; freq2 = 330; duration = 0.1; waveType = 'triangle'; break;
                default: return; // Unknown sound
            }

            oscillator.type = waveType;
            oscillator.frequency.setValueAtTime(freq1, state.audioContext.currentTime);
            if (freq2) {
                oscillator.frequency.exponentialRampToValueAtTime(freq2, state.audioContext.currentTime + duration);
            }
            gainNode.gain.exponentialRampToValueAtTime(0.00001, state.audioContext.currentTime + duration); // Fade out

            oscillator.start(state.audioContext.currentTime);
            oscillator.stop(state.audioContext.currentTime + duration);
        } catch (e) {
            console.warn("SoundPlayer error:", e);
        }
    }
};