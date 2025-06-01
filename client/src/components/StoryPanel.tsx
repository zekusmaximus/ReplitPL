import type { StoryNode, Choice } from "@shared/schema";

interface StoryPanelProps {
  currentNode?: StoryNode;
  onChoice: (choiceId: string) => void;
  isLoading?: boolean;
}

export default function StoryPanel({ currentNode, onChoice, isLoading }: StoryPanelProps) {
  if (!currentNode) {
    return (
      <div className="h-full bg-navy/30 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-map text-cyan text-4xl mb-4"></i>
          <p className="text-cool-gray">Select a node to begin your journey</p>
        </div>
      </div>
    );
  }

  const choices = (currentNode.choices as Choice[]) || [];

  return (
    <div className="h-full bg-navy/30 backdrop-blur-sm">
      <div className="h-full flex flex-col">
        {/* Story Header */}
        <div className="px-8 py-6 border-b border-cyan/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-orbitron text-lg text-cyan">{currentNode.title}</h3>
            <div className="flex items-center space-x-2 text-sm text-cool-gray">
              <i className="fas fa-clock"></i>
              <span>{currentNode.readTime}</span>
            </div>
          </div>
          <p className="text-sm text-cool-gray">{currentNode.location}</p>
        </div>

        {/* Story Content */}
        <div className="flex-1 px-8 py-6 overflow-y-auto story-fade">
          <div className="prose prose-invert max-w-none">
            {currentNode.content.split('\n\n').map((paragraph, index) => {
              if (paragraph.startsWith('"') && paragraph.endsWith('"')) {
                return (
                  <p key={index} className="text-soft-white leading-relaxed mb-4">
                    <em className="text-cyan">{paragraph}</em>
                  </p>
                );
              }
              
              if (paragraph.includes('System log:') || paragraph.includes('SYSTEM')) {
                return (
                  <div key={index} className="bg-space/50 p-4 rounded-lg mb-4 border-l-4 border-amber">
                    <p className="text-amber text-sm font-mono">{paragraph}</p>
                  </div>
                );
              }

              return (
                <p key={index} className="text-soft-white leading-relaxed mb-4">
                  {paragraph}
                </p>
              );
            })}
          </div>

          {/* Choice Options */}
          {choices.length > 0 && (
            <div className="space-y-3 mt-6">
              <h4 className="font-orbitron text-cyan text-sm font-semibold mb-4">Choose your path:</h4>
              
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  className="w-full text-left p-4 bg-space/30 rounded-lg border border-cyan/20 hover:border-cyan/40 hover:bg-space/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onChoice(choice.id)}
                  disabled={isLoading}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-cyan/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1 group-hover:bg-cyan/30 transition-colors">
                      <i className={`${choice.icon} text-cyan text-xs`}></i>
                    </div>
                    <div>
                      <p className="text-soft-white font-medium mb-1">{choice.text}</p>
                      <p className="text-cool-gray text-sm">{choice.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Story Navigation */}
        <div className="px-8 py-4 border-t border-cyan/20 flex items-center justify-between">
          <button className="flex items-center space-x-2 text-cool-gray hover:text-cyan transition-colors">
            <i className="fas fa-chevron-left"></i>
            <span className="text-sm">Previous</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-cyan rounded-full"></div>
            <div className="w-2 h-2 bg-cyan rounded-full"></div>
            <div className="w-2 h-2 bg-cool-gray/40 rounded-full"></div>
            <div className="w-2 h-2 bg-cool-gray/40 rounded-full"></div>
          </div>
          
          <button className="flex items-center space-x-2 text-cool-gray hover:text-cyan transition-colors">
            <span className="text-sm">Next</span>
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
