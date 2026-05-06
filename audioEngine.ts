/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FilterType = 'lowpass' | 'highpass' | 'notch' | 'bypass';
export type DistortionType = 'tube' | 'soft' | 'hard' | 'asymmetric' | 'bit';

export interface BandSettings {
  enabled: boolean;
  solo: boolean;
  distortion: number; // 0 to 1
  distortionType: DistortionType;
  filterType: FilterType;
  filterFreq: number;
  filterQ: number;
  gain: number; // 0 to 2
  shift: number; // Phase shift / frequency shift amount
}

export interface ProcessorState {
  lowBand: BandSettings;
  midBand: BandSettings;
  highBand: BandSettings;
  lowMidCrossover: number;
  midHighCrossover: number;
  inputGain: number;
  outputGain: number;
  bypass: boolean;
}

export const PRESETS: Record<string, ProcessorState> = {
  'FACTORY RESET': {
    bypass: false,
    inputGain: 1,
    outputGain: 1,
    lowBand: { enabled: true, solo: false, distortion: 0.1, distortionType: 'tube', filterType: 'bypass', filterFreq: 100, filterQ: 1, gain: 1, shift: 0 },
    midBand: { enabled: true, solo: false, distortion: 0.05, distortionType: 'tube', filterType: 'bypass', filterFreq: 1000, filterQ: 1, gain: 1, shift: 0 },
    highBand: { enabled: true, solo: false, distortion: 0.02, distortionType: 'tube', filterType: 'bypass', filterFreq: 5000, filterQ: 1, gain: 1, shift: 0 },
    lowMidCrossover: 250,
    midHighCrossover: 2500,
  },
  'WARM TUBE DRIVE': {
    bypass: false,
    inputGain: 1.2,
    outputGain: 0.9,
    lowBand: { enabled: true, solo: false, distortion: 0.6, distortionType: 'tube', filterType: 'bypass', filterFreq: 100, filterQ: 1, gain: 1.1, shift: 0.1 },
    midBand: { enabled: true, solo: false, distortion: 0.3, distortionType: 'asymmetric', filterType: 'bypass', filterFreq: 1000, filterQ: 1, gain: 1, shift: 0 },
    highBand: { enabled: true, solo: false, distortion: 0.1, distortionType: 'soft', filterType: 'bypass', filterFreq: 5000, filterQ: 1, gain: 0.9, shift: -0.1 },
    lowMidCrossover: 200,
    midHighCrossover: 3000,
  },
  'BIT CRUSH LAB': {
    bypass: false,
    inputGain: 1,
    outputGain: 1,
    lowBand: { enabled: true, solo: false, distortion: 0.2, distortionType: 'tube', filterType: 'bypass', filterFreq: 100, filterQ: 1, gain: 1, shift: 0 },
    midBand: { enabled: true, solo: false, distortion: 0.8, distortionType: 'bit', filterType: 'notch', filterFreq: 1500, filterQ: 8, gain: 0.8, shift: 0.5 },
    highBand: { enabled: true, solo: false, distortion: 0.9, distortionType: 'bit', filterType: 'highpass', filterFreq: 8000, filterQ: 2, gain: 1.2, shift: 0.2 },
    lowMidCrossover: 400,
    midHighCrossover: 2000,
  }
};

export const DEFAULT_STATE: ProcessorState = PRESETS['FACTORY RESET'];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private output: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Bands
  private lowDistortion: WaveShaperNode | null = null;
  private midDistortion: WaveShaperNode | null = null;
  private highDistortion: WaveShaperNode | null = null;
  
  private lowFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private highFilter: BiquadFilterNode | null = null;

  private lowGain: GainNode | null = null;
  private midGain: GainNode | null = null;
  private highGain: GainNode | null = null;

  // Shifters (Delay-based simple pitch/phase shift)
  private lowDelay: DelayNode | null = null;
  private midDelay: DelayNode | null = null;
  private highDelay: DelayNode | null = null;

  // Crossover Filters (4th order Linkwitz-Riley)
  private lp1: BiquadFilterNode | null = null;
  private lp2: BiquadFilterNode | null = null;
  private hp1: BiquadFilterNode | null = null;
  private hp2: BiquadFilterNode | null = null;
  private mid_lp1: BiquadFilterNode | null = null;
  private mid_lp2: BiquadFilterNode | null = null;
  private mid_hp1: BiquadFilterNode | null = null;
  private mid_hp2: BiquadFilterNode | null = null;

  constructor() {}

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Create Nodes
    this.lowDistortion = this.ctx.createWaveShaper();
    this.midDistortion = this.ctx.createWaveShaper();
    this.highDistortion = this.ctx.createWaveShaper();
    
    this.lowFilter = this.ctx.createBiquadFilter();
    this.midFilter = this.ctx.createBiquadFilter();
    this.highFilter = this.ctx.createBiquadFilter();

    this.lowGain = this.ctx.createGain();
    this.midGain = this.ctx.createGain();
    this.highGain = this.ctx.createGain();

    this.lowDelay = this.ctx.createDelay(0.1);
    this.midDelay = this.ctx.createDelay(0.1);
    this.highDelay = this.ctx.createDelay(0.1);

    // Crossovers
    this.lp1 = this.ctx.createBiquadFilter();
    this.lp2 = this.ctx.createBiquadFilter();
    this.hp1 = this.ctx.createBiquadFilter();
    this.hp2 = this.ctx.createBiquadFilter();
    this.mid_lp1 = this.ctx.createBiquadFilter();
    this.mid_lp2 = this.ctx.createBiquadFilter();
    this.mid_hp1 = this.ctx.createBiquadFilter();
    this.mid_hp2 = this.ctx.createBiquadFilter();

    // Configure Linkwitz-Riley (Q = 0.5 for second order, cascade for 4th)
    [this.lp1, this.lp2, this.mid_lp1, this.mid_lp2].forEach(f => { f.type = 'lowpass'; f.Q.value = 0.5; });
    [this.hp1, this.hp2, this.mid_hp1, this.mid_hp2].forEach(f => { f.type = 'highpass'; f.Q.value = 0.5; });

    this.setupRouting();
    await this.ctx.resume();
  }

  private setupRouting() {
    if (!this.ctx || !this.input || !this.output) return;

    // Signal -> Input
    this.input.connect(this.lp1!);
    this.lp1!.connect(this.lp2!);
    
    this.input.connect(this.hp1!);
    this.hp1!.connect(this.hp2!);

    // Low Path (lp2 output)
    this.lp2!.connect(this.lowDelay!);
    this.lowDelay!.connect(this.lowDistortion!);
    this.lowDistortion!.connect(this.lowFilter!);
    this.lowFilter!.connect(this.lowGain!);
    this.lowGain!.connect(this.output);

    // High Path split for Mid/High
    this.hp2!.connect(this.mid_lp1!);
    this.mid_lp1!.connect(this.mid_lp2!);
    
    this.hp2!.connect(this.mid_hp1!);
    this.mid_hp1!.connect(this.mid_hp2!);

    // Mid Path
    this.mid_lp2!.connect(this.midDelay!);
    this.midDelay!.connect(this.midDistortion!);
    this.midDistortion!.connect(this.midFilter!);
    this.midFilter!.connect(this.midGain!);
    this.midGain!.connect(this.output);

    // High Path
    this.mid_hp2!.connect(this.highDelay!);
    this.highDelay!.connect(this.highDistortion!);
    this.highDistortion!.connect(this.highFilter!);
    this.highFilter!.connect(this.highGain!);
    this.highGain!.connect(this.output);

    this.output.connect(this.analyser!);
    this.output.connect(this.ctx.destination);
  }

  update(state: ProcessorState) {
    if (!this.ctx) return;
    
    this.input!.gain.setTargetAtTime(state.bypass ? 0 : state.inputGain, this.ctx.currentTime, 0.05);
    this.output!.gain.setTargetAtTime(state.outputGain, this.ctx.currentTime, 0.05);

    // Crossovers
    this.lp1!.frequency.setTargetAtTime(state.lowMidCrossover, this.ctx.currentTime, 0.05);
    this.lp2!.frequency.setTargetAtTime(state.lowMidCrossover, this.ctx.currentTime, 0.05);
    this.hp1!.frequency.setTargetAtTime(state.lowMidCrossover, this.ctx.currentTime, 0.05);
    this.hp2!.frequency.setTargetAtTime(state.lowMidCrossover, this.ctx.currentTime, 0.05);

    this.mid_lp1!.frequency.setTargetAtTime(state.midHighCrossover, this.ctx.currentTime, 0.05);
    this.mid_lp2!.frequency.setTargetAtTime(state.midHighCrossover, this.ctx.currentTime, 0.05);
    this.mid_hp1!.frequency.setTargetAtTime(state.midHighCrossover, this.ctx.currentTime, 0.05);
    this.mid_hp2!.frequency.setTargetAtTime(state.midHighCrossover, this.ctx.currentTime, 0.05);

    // Determine Solo State
    const soloActive = state.lowBand.solo || state.midBand.solo || state.highBand.solo;

    // Band Updates
    this.updateBand(state.lowBand, this.lowDistortion!, this.lowFilter!, this.lowGain!, this.lowDelay!, soloActive);
    this.updateBand(state.midBand, this.midDistortion!, this.midFilter!, this.midGain!, this.midDelay!, soloActive);
    this.updateBand(state.highBand, this.highDistortion!, this.highFilter!, this.highGain!, this.highDelay!, soloActive);
  }

  private updateBand(settings: BandSettings, dist: WaveShaperNode, filter: BiquadFilterNode, gain: GainNode, delay: DelayNode, soloActive: boolean) {
    if (!this.ctx) return;
    
    // Distortion Curve
    dist.curve = this.makeDistortionCurve(settings.distortion, settings.distortionType);
    
    // Shifter (Simple time offset modulation effect)
    const delayTime = Math.abs(settings.shift) * 0.005; // Max 5ms shift
    delay.delayTime.setTargetAtTime(delayTime, this.ctx.currentTime, 0.05);

    // Filter
    if (settings.filterType === 'bypass') {
       filter.type = 'allpass';
       filter.frequency.setTargetAtTime(20000, this.ctx.currentTime, 0.05);
    } else {
       filter.type = settings.filterType;
       filter.frequency.setTargetAtTime(settings.filterFreq, this.ctx.currentTime, 0.05);
       filter.Q.setTargetAtTime(settings.filterQ, this.ctx.currentTime, 0.05);
    }

    // Final Gain logic: Only play if (not soloing anything and enabled) OR (soloing and this is soloed)
    const isActive = soloActive ? settings.solo : settings.enabled;
    gain.gain.setTargetAtTime(isActive ? settings.gain : 0, this.ctx.currentTime, 0.05);
  }

  private makeDistortionCurve(amount: number, type: DistortionType) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      
      switch(type) {
        case 'tube': {
          const k = amount * 10;
          curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
          break;
        }
        case 'soft': {
          curve[i] = Math.tanh(x * (1 + amount * 10));
          break;
        }
        case 'hard': {
          const threshold = 1 - amount * 0.9;
          if (x > threshold) curve[i] = threshold;
          else if (x < -threshold) curve[i] = -threshold;
          else curve[i] = x;
          break;
        }
        case 'asymmetric': {
          const k = amount * 5;
          if (x > 0) curve[i] = x / (1 + k * x);
          else curve[i] = Math.tanh(x * (1 + k));
          break;
        }
        case 'bit': {
          const steps = Math.max(2, Math.floor(64 / (1 + amount * 32)));
          curve[i] = Math.round(x * steps) / steps;
          break;
        }
      }
    }
    return curve;
  }

  getAnalyser() {
    return this.analyser;
  }

  getContext() {
    return this.ctx;
  }

  async connectSource(mediaElement: HTMLMediaElement) {
    if (!this.ctx || !this.input) return;
    const source = this.ctx.createMediaElementSource(mediaElement);
    source.connect(this.input);
  }
}

