/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {Activity, AlertCircle, Play, Power, SkipBack, Settings, Disc, FolderOpen, Save, Download} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AudioEngine, DEFAULT_STATE, ProcessorState, PRESETS} from './audioEngine';
import {Knob, Visualizer, VUMeter} from './components/AudioControls';

export default function App() {
  const [engine] = useState(() => new AudioEngine());
  const [state, setState] = useState<ProcessorState>(DEFAULT_STATE);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [currentPreset, setCurrentPreset] = useState('FACTORY RESET');
  const [showExportInfo, setShowExportInfo] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const initAudio = async () => {
    await engine.init();
    if (audioRef.current) {
      await engine.connectSource(audioRef.current);
    }
    setIsAudioInitialized(true);
  };

  useEffect(() => {
    if (isAudioInitialized) {
      engine.update(state);
    }
  }, [state, isAudioInitialized, engine]);

  const handleBandChange = useCallback((band: keyof Pick<ProcessorState, 'lowBand' | 'midBand' | 'highBand'>, updates: Partial<ProcessorState['lowBand']>) => {
    setState(prev => ({
      ...prev,
      [band]: {...prev[band], ...updates}
    }));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!isAudioInitialized) {
      await initAudio();
    }
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await engine.getContext()?.resume();
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="studio-chassis">
      <div className="w-full max-w-6xl flex shadow-2xl relative">
        
        {/* Left Rack Ear */}
        <div className="rack-ear rounded-l-lg">
          <RackScrew />
          <RackScrew />
          <RackScrew />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          
          {/* Master Section / Header */}
          <div className="rack-unit border-b-2 border-black/10 px-10 py-6 flex items-center justify-between bg-gradient-to-b from-[#f3f4f6] to-[#e2e4e9]">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <h1 className="text-4xl font-mono font-black tracking-tighter uppercase italic text-gray-800 flex items-center gap-3 drop-shadow-sm">
                  <Activity className="w-8 h-8 text-red-600" />
                  PHASE-X <span className="text-gray-500/50 not-italic">5042p</span>
                </h1>
                <p className="panel-label mt-1 text-red-700/60 uppercase font-black text-[7px] tracking-widest">Discrete Transistor Processor • Class A Signal Path</p>
              </div>

              {/* Preset Browser */}
              <div className="bg-black/5 p-3 rounded-sm border border-black/10 flex items-center gap-4 shadow-inner">
                 <FolderOpen className="w-4 h-4 text-gray-500" />
                 <select 
                   value={currentPreset}
                   onChange={(e) => {
                     const name = e.target.value;
                     setCurrentPreset(name);
                     if (PRESETS[name]) setState(PRESETS[name]);
                   }}
                   className="bg-transparent font-mono text-[10px] font-black uppercase text-gray-700 outline-none cursor-pointer"
                 >
                   {Object.keys(PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
                 <button className="text-gray-400 hover:text-red-600 transition-colors">
                   <Save className="w-4 h-4" />
                 </button>
              </div>
            </div>

            <div className="flex items-center gap-8">
               <VUMeter analyser={engine.getAnalyser()} />
               
               <div className="flex flex-col items-center gap-4">
                  <span className="panel-label">Power</span>
                  <button 
                    onClick={togglePlay}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 border-t-2 border-white/50 ${isPlaying ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-[#cfd3d9] text-gray-500 border border-gray-400'}`}
                  >
                    <Power className={isPlaying ? 'animate-pulse' : ''} />
                  </button>
               </div>
            </div>
          </div>

          {/* Analysis Module */}
          <div className="bg-[#d8dce2] px-10 py-8 border-b-2 border-black/10">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <Disc className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''} text-gray-500`} />
                  <span className="panel-label">Spectral Visualization</span>
                </div>
                <label className="panel-label cursor-pointer flex items-center gap-2 px-3 py-1 bg-black/5 rounded hover:bg-black/10 transition-colors">
                  <input type="file" className="hidden" onChange={handleFileChange} />
                  {file ? file.name : 'Load Audio...'}
                </label>
             </div>
             <Visualizer analyser={engine.getAnalyser()} />
          </div>

          {/* Bands Modules Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 rack-unit border-t border-black/10">
             {/* Low Band */}
             <BandModule title="Low-End" settings={state.lowBand} onChange={(u) => handleBandChange('lowBand', u)} />
             
             {/* Mid Band */}
             <BandModule title="Mid-Range" settings={state.midBand} onChange={(u) => handleBandChange('midBand', u)} />
             
             {/* High Band */}
             <BandModule title="Top-Shift" settings={state.highBand} onChange={(u) => handleBandChange('highBand', u)} />

             {/* Global Module / Master Output */}
             <div className="p-10 flex flex-col justify-between border-l border-[#b0b4ba] bg-[#cfd3d9] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px'}} />
                
                <div className="space-y-10 relative z-10">
                  <div className="flex justify-between items-center border-b-2 border-black/10 pb-4">
                    <span className="panel-label font-black text-gray-800">Master Console</span>
                    <button 
                      onClick={() => setShowExportInfo(true)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 text-white rounded-sm hover:bg-black transition-all group"
                    >
                      <Download className="w-3 h-3" />
                      <span className="text-[7px] font-black uppercase font-mono group-hover:block">Export VST3</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <Knob label="L/M Cross" value={state.lowMidCrossover} min={80} max={800} suffix="Hz" onChange={(v) => setState(s => ({...s, lowMidCrossover: v}))} />
                    <Knob label="M/H Cross" value={state.midHighCrossover} min={800} max={8000} suffix="Hz" onChange={(v) => setState(s => ({...s, midHighCrossover: v}))} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <Knob label="Trim In" value={state.inputGain} min={0} max={2} onChange={(v) => setState(s => ({...s, inputGain: v}))} />
                    <Knob label="Trim Out" value={state.outputGain} min={0} max={2} onChange={(v) => setState(s => ({...s, outputGain: v}))} />
                  </div>
                </div>

                <div className="mt-10 flex flex-col items-center gap-4 relative z-10">
                   <div className="flex items-center gap-4 mb-4">
                      <span className="panel-label text-red-700">ENGAGE</span>
                      <ToggleSwitch 
                        active={!state.bypass} 
                        onChange={() => setState(s => ({...s, bypass: !s.bypass}))} 
                      />
                      <span className="panel-label">BYPASS</span>
                   </div>
                   <p className="text-[8px] font-black font-mono text-gray-500 uppercase tracking-widest text-center">Standard Discrete Component Signal Path</p>
                </div>
             </div>
          </div>
        </div>

        {/* Right Rack Ear */}
        <div className="rack-ear rounded-r-lg shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <RackScrew />
          <RackScrew />
          <RackScrew />
        </div>

        {/* Audio Element */}
        <audio 
          ref={audioRef} 
          src={file ? URL.createObjectURL(file) : undefined} 
          onEnded={() => setIsPlaying(false)}
          className="hidden" 
        />

        <AnimatePresence>
          {!isAudioInitialized && (
            <motion.div 
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0, scale: 1.1}}
              className="fixed inset-0 bg-[#0a0a0c]/98 backdrop-blur-xl z-[100] flex items-center justify-center p-4 text-center"
            >
              <div className="p-12 rack-unit max-w-lg border-b-8 border-red-600 bg-[#e2e4e9] shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
                <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl border-4 border-white/20">
                  <Power className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-mono font-black mb-6 uppercase text-gray-900 tracking-tighter italic text-center">System Professional Ignition</h2>
                <p className="text-sm text-gray-600 mb-12 font-sans leading-relaxed tracking-wide text-center font-medium">
                  Initialize discrete phase distortion circuitry, multiband delays, and vacuum tube emulation modules for high-fidelity audio mastering.
                </p>
                <button 
                  onClick={initAudio}
                  className="w-full py-6 bg-gray-900 text-white font-mono uppercase tracking-[0.5em] font-black rounded hover:bg-black transition-all shadow-2xl active:scale-95 border-t border-white/10"
                >
                  Engage Power Supply
                </button>
              </div>
            </motion.div>
          )}

          {showExportInfo && (
            <motion.div 
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4"
              onClick={() => setShowExportInfo(false)}
            >
              <motion.div 
                initial={{scale: 0.9, y: 20}}
                animate={{scale: 1, y: 0}}
                className="bg-[#e2e4e9] p-10 rounded-sm border-2 border-gray-800 max-w-xl shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-2xl font-mono font-black uppercase italic mb-4 text-gray-900">Export to DAW (VST3/AU)</h3>
                <div className="space-y-4 text-sm text-gray-700 font-sans leading-relaxed">
                  <p>Este es un <strong>Web-Based Audio Plugin</strong>. Para usarlo en tu DAW favorito (Ableton, FL Studio, Logic) como VST3:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Exporta el código fuente desde el menú <strong>Settings &gt; Export ZIP</strong> de este editor.</li>
                    <li>Usa un wrapper profesional como <strong>iPlug2 (IPlugWebView)</strong> para cargar este código en un contenedor nativo.</li>
                    <li>Compila para Windows/Mac usando el SDK de Steinberg incluido en estos frameworks.</li>
                  </ol>
                  <div className="p-4 bg-black/10 rounded-sm border border-black/5 mt-6 italic text-[12px]">
                    "La arquitectura de Phase-X ya está optimizada para la comunicación asíncrona requerida por los VST modernos."
                  </div>
                </div>
                <button 
                  onClick={() => setShowExportInfo(false)}
                  className="mt-8 w-full py-3 bg-gray-900 text-white font-mono uppercase font-black hover:bg-black transition-colors"
                >
                  Cerrar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function RackScrew() {
  return (
    <div className="rack-screw">
      <div className="screw-slot" />
    </div>
  );
}

function ToggleSwitch({active, onChange}: {active: boolean, onChange: () => void}) {
  return (
    <div className="toggle-switch-track cursor-pointer group" onClick={onChange}>
      <div className={`panel-label mb-1 text-[7px] group-hover:text-red-600 transition-colors`}>ACTIVE</div>
      <div className={`toggle-handle transition-transform ${active ? '-translate-y-3' : 'translate-y-3'}`} />
      <div className={`panel-label mt-1 text-[7px]`}>PASSIVE</div>
    </div>
  );
}

interface BandModuleProps {
  title: string;
  settings: ProcessorState['lowBand'];
  onChange: (updates: Partial<ProcessorState['lowBand']>) => void;
}

function BandModule({title, settings, onChange}: BandModuleProps) {
  return (
    <div className="p-10 border-r border-[#b0b4ba] flex flex-col relative group">
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex justify-between items-start mb-12 relative z-10">
        <div>
          <h2 className="text-2xl font-mono font-bold uppercase tracking-tighter italic text-gray-800">
            {title}
          </h2>
          <div className="w-8 h-1 bg-red-600 mt-1" />
        </div>
        
        <div className="flex gap-4">
           {/* In/Out Switch */}
           <div className="flex flex-col items-center gap-2">
             <span className="panel-label text-[7px]">Process</span>
             <ToggleSwitch 
               active={settings.enabled} 
               onChange={() => onChange({enabled: !settings.enabled})} 
             />
           </div>

           {/* Solo Switch */}
           <div className="flex flex-col items-center gap-2">
             <span className="panel-label text-[7px] text-orange-600">Solo</span>
             <button 
               onClick={() => onChange({solo: !settings.solo})}
               className={`w-8 h-8 rounded-sm border border-black/20 shadow-md flex items-center justify-center transition-all ${settings.solo ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-500'}`}
             >
               <span className="text-[10px] font-black font-mono">S</span>
             </button>
           </div>
        </div>
      </div>

      <div className="space-y-12 relative z-10 flex-1 flex flex-col">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center w-full">
            <span className="panel-label mb-3">Saturator Type</span>
            <select 
              value={settings.distortionType}
              onChange={(e) => onChange({distortionType: e.target.value as any})}
              className="w-full bg-[#d1d5db] border-2 border-black/10 rounded-sm px-3 py-2 font-mono text-[10px] font-black text-gray-800 outline-none hover:border-red-600/30 transition-all shadow-inner uppercase tracking-wider cursor-pointer"
            >
              <option value="tube">Vintage Tube</option>
              <option value="soft">Soft Saturation</option>
              <option value="hard">Hard Clipping</option>
              <option value="asymmetric">Harmonic Lift</option>
              <option value="bit">Bit Reducer</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-8 w-full">
            <Knob label="Drive" value={settings.distortion} min={0} max={1} onChange={(v) => onChange({distortion: v})} />
            <Knob label="Band Level" value={settings.gain} min={0} max={2} onChange={(v) => onChange({gain: v})} />
          </div>
        </div>

        <div className="border-t-2 border-black/5 pt-10 space-y-10 flex-1">
          <div className="flex flex-col items-center">
            <span className="panel-label mb-4">Filter Assign</span>
            <div className="flex gap-1.5 bg-black/5 p-1.5 rounded-sm border border-black/5">
              {(['bypass', 'lowpass', 'highpass', 'notch'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => onChange({filterType: type})}
                  className={`text-[8px] font-mono font-black uppercase px-2.5 py-1.5 rounded transition-all shadow-sm ${settings.filterType === type ? 'bg-gray-800 text-white shadow-[0_2px_5px_rgba(0,0,0,0.5)]' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'}`}
                >
                  {type === 'bypass' ? 'OFF' : type.substring(0, 4)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-12">
            <Knob 
              label="Tone/Cutoff" 
              value={settings.filterFreq} 
              min={20} 
              max={20000} 
              suffix="Hz" 
              onChange={(v) => onChange({filterFreq: v})} 
            />
            <Knob 
              label="Phase Offset" 
              value={settings.shift} 
              min={-1} 
              max={1} 
              onChange={(v) => onChange({shift: v})} 
            />
            <Knob 
              label="Focus/Q" 
              value={settings.filterQ} 
              min={0.1} 
              max={20} 
              onChange={(v) => onChange({filterQ: v})} 
            />
            <div className="flex flex-col items-center justify-end">
                <span className="panel-label text-[7.5px] mb-2">Stability</span>
                <div className="w-10 h-10 rounded-full border-4 border-[#b0b4ba] bg-[#d1d5db] shadow-inner relative flex items-center justify-center">
                   <div className="w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

