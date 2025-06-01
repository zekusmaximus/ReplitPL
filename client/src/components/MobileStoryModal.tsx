import type { StoryNode, Choice } from "@shared/schema";

interface MobileStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode?: StoryNode;
  onChoice: (choiceId: string) => void;
  isLoading?: boolean;
}

export default function MobileStoryModal({ 
  isOpen, 
  onClose, 
  currentNode, 
  onChoice, 
  isLoading 
}: MobileStoryModalProps) {
  if (!isOpen || !currentNode) return null;

  const choices = (currentNode.choices as Choice[]) || [];

  return (
    <div className="lg:hidden fixed inset-0 bg-space/95 backdrop-blur-sm z-50">
      <div className="h-full flex flex-col">
        {/* Mobile Story Header */}
        <div className="px-6 py-4 border-b border-cyan/20 flex items-center justify-between">
          <h3 className="font-orbitron text-lg text-cyan">{currentNode.title}</h3>
          <button 
            className="w-8 h-8 flex items-center justify-center text-cool-gray hover:text-cyan transition-colors"
            onClick={onClose}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Mobile Story Content */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">
          <div className="mb-4">
            <p className="text-sm text-cool-gray mb-2">{currentNode.location}</p>
            <div className="flex items-center space-x-2 text-sm text-cool-gray mb-4">
              <i className="fas fa-clock"></i>
              <span>{currentNode.readTime}</span>
            </div>
          </div>

          {/* Story content */}
          <div className="prose prose-invert max-w-none text-sm mb-6">
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

          {/* Mobile Choice Options */}
          {choices.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-orbitron text-cyan text-sm font-semibold mb-4">Choose your path:</h4>
              
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  className="w-full text-left p-4 bg-space/30 rounded-lg border border-cyan/20 hover:border-cyan/40 hover:bg-space/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    onChoice(choice.id);
                    onClose();
                  }}
                  disabled={isLoading}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-cyan/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
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

        {/* Mobile Navigation */}
        <div className="px-6 py-4 border-t border-cyan/20">
          <button 
            className="w-full bg-cyan text-space font-semibold py-3 rounded-lg hover:bg-cyan/90 transition-colors"
            onClick={onClose}
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  );
}
