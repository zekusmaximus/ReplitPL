interface HeaderProps {
  visitedNodesCount: number;
  totalNodesCount: number;
  progressPercentage: number;
  isAudioEnabled: boolean;
  currentLocation: string;
  onSaveProgress: () => void;
  onLoadProgress: () => void;
  onToggleAudio: () => void;
}

export default function Header({
  visitedNodesCount,
  totalNodesCount,
  progressPercentage,
  isAudioEnabled,
  currentLocation,
  onSaveProgress,
  onLoadProgress,
  onToggleAudio,
}: HeaderProps) {
  return (
    <header className="bg-navy border-b border-cyan/20 px-6 py-4 flex items-center justify-between z-10">
      <div className="flex items-center space-x-4">
        <h1 className="font-orbitron font-bold text-2xl text-cyan">PROJECT LEIBNIZ</h1>
        <div className="hidden md:flex items-center space-x-2 text-sm text-cool-gray">
          <i className="fas fa-map-marker-alt"></i>
          <span>{currentLocation}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Progress Indicator */}
        <div className="hidden lg:flex items-center space-x-2">
          <span className="text-sm text-cool-gray">Progress:</span>
          <div className="w-32 h-2 bg-navy rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan to-amber transition-all duration-500" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-sm text-cyan font-mono">
            {visitedNodesCount}/{totalNodesCount}
          </span>
        </div>
        
        {/* Audio Controls */}
        <button 
          className="p-2 bg-navy/50 rounded-lg hover:bg-navy transition-colors"
          onClick={onToggleAudio}
        >
          <i className={`fas ${isAudioEnabled ? 'fa-volume-up' : 'fa-volume-mute'} text-cyan`}></i>
        </button>
        
        {/* Save/Load */}
        <div className="flex items-center space-x-2">
          <button 
            className="px-3 py-2 bg-cyan/10 text-cyan text-sm rounded-lg hover:bg-cyan/20 transition-colors"
            onClick={onSaveProgress}
          >
            <i className="fas fa-save mr-1"></i>Save
          </button>
          <button 
            className="px-3 py-2 bg-amber/10 text-amber text-sm rounded-lg hover:bg-amber/20 transition-colors"
            onClick={onLoadProgress}
          >
            <i className="fas fa-folder-open mr-1"></i>Load
          </button>
        </div>
      </div>
    </header>
  );
}
