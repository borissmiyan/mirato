/**
 * Plays synthesized tones for timer trigger events using Web Audio API.
 */
export async function playSynthesizedTone(soundId: string): Promise<void> {
    const playTone = (ctx: AudioContext, freq: number, dur: number, type: OscillatorType, delay: number = 0, vol: number = 0.1) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        g.gain.setValueAtTime(0.001, ctx.currentTime + delay);
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur);
    };

    try {
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        switch (soundId) {
            case 'ring_default':
                playTone(ctx, 880, 0.4, 'sine');
                break;
            case 'ring_double':
                playTone(ctx, 880, 0.1, 'sine', 0);
                playTone(ctx, 880, 0.1, 'sine', 0.15);
                break;
            case 'ring_bell':
                playTone(ctx, 880, 1.2, 'sine', 0, 0.05);
                playTone(ctx, 1100, 1.2, 'sine', 0, 0.03);
                playTone(ctx, 1320, 1.2, 'sine', 0, 0.02);
                break;
            case 'ring_chime':
                playTone(ctx, 523.25, 0.5, 'sine', 0);
                playTone(ctx, 659.25, 0.5, 'sine', 0.2);
                playTone(ctx, 783.99, 0.8, 'sine', 0.4);
                break;
            case 'ring_retro':
                playTone(ctx, 440, 0.1, 'square', 0, 0.05);
                playTone(ctx, 440, 0.1, 'square', 0.15, 0.05);
                playTone(ctx, 440, 0.1, 'square', 0.3, 0.05);
                break;
            case 'ring_uplift':
                playTone(ctx, 261.63, 1.5, 'sine', 0, 0.1);
                playTone(ctx, 329.63, 1.5, 'sine', 0.2, 0.1);
                playTone(ctx, 392.00, 1.5, 'sine', 0.4, 0.1);
                playTone(ctx, 493.88, 1.5, 'sine', 0.6, 0.1);
                playTone(ctx, 523.25, 2.0, 'sine', 0.8, 0.2);
                for (let i = 0; i < 8; i++) {
                    const startTime = 2.5 + (i * 0.8);
                    playTone(ctx, 659.25, 0.3, 'triangle', startTime, 0.05);
                    playTone(ctx, 523.25, 0.2, 'sine', startTime + 0.1, 0.03);
                }
                playTone(ctx, 261.63, 1.0, 'sine', 9.0, 0.5);
                break;
            case 'ring_shimmer':
                playTone(ctx, 185.00, 2.5, 'sine', 0, 0.1);
                playTone(ctx, 739.99, 0.6, 'sine', 0.2, 0.05);
                playTone(ctx, 830.61, 0.6, 'sine', 0.4, 0.05);
                playTone(ctx, 932.33, 0.6, 'sine', 0.6, 0.05);
                playTone(ctx, 1108.73, 1.2, 'sine', 0.8, 0.08);
                for (let i = 0; i < 4; i++) {
                    const beat = 2.5 + (i * 1.5);
                    playTone(ctx, 554.37, 0.2, 'sine', beat, 0.05);
                    playTone(ctx, 739.99, 0.1, 'triangle', beat + 0.15, 0.02);
                }
                playTone(ctx, 369.99, 1.5, 'sine', 8.5, 0.1);
                break;
            case 'ring_cathedral':
                playTone(ctx, 174.61, 4.0, 'triangle', 0, 0.2);
                playTone(ctx, 349.23, 3.0, 'sine', 0.05, 0.1);
                playTone(ctx, 440.00, 2.5, 'sine', 0.1, 0.05);
                playTone(ctx, 174.61, 5.0, 'sine', 2.0, 0.05);
                playTone(ctx, 220.00, 4.5, 'sine', 2.5, 0.04);
                playTone(ctx, 261.63, 4.0, 'sine', 3.0, 0.04);
                playTone(ctx, 349.23, 3.5, 'sine', 3.5, 0.03);
                playTone(ctx, 130.81, 2.0, 'sine', 8.0, 0.1);
                break;
            default:
                playTone(ctx, 880, 0.4, 'sine');
        }
    } catch (e) {
        console.error('Failed to play trigger sound:', e);
    }
}

