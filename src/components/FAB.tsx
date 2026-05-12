import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';

interface FABProps {
  onClick: () => void;
}

export const FAB: React.FC<FABProps> = ({ onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // Show the label briefly, then hide it
    const showTimer = setTimeout(() => setIsVisible(true), 1000);
    const hideTimer = setTimeout(() => setIsVisible(false), 2500);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className="fixed bottom-[110px] right-4 md:right-6 lg:bottom-10 lg:right-10 z-[5000] flex flex-col items-end gap-4">
      {/* Review Button */}
      <div 
        className="flex items-center gap-2 md:gap-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.8 }}
          animate={{ 
            opacity: (isHovered || isVisible) ? 1 : 0, 
            x: (isHovered || isVisible) ? 0 : 20,
            scale: (isHovered || isVisible) ? 1 : 0.8
          }}
          transition={{ 
            type: 'spring', 
            damping: 12, 
            stiffness: 200,
            delay: isVisible && !isHovered ? 0.1 : 0 
          }}
          className="bg-elegant-ink text-white px-4 md:px-5 py-2 md:py-2.5 rounded-full text-[9px] md:text-[11px] uppercase tracking-[0.2em] font-bold shadow-2xl pointer-events-none whitespace-nowrap border border-white/10 flex items-center gap-1.5 md:gap-2"
        >
          <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-elegant-gold rounded-full animate-pulse" />
          Leave a review
        </motion.div>

        <motion.button
          onClick={onClick}
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          className="bg-white w-12 h-12 md:w-14 md:h-14 rounded-full shadow-[0_15px_35px_-5px_rgba(0,0,0,0.4)] flex items-center justify-center border border-elegant-gold/20 active:bg-elegant-gold group transition-all"
          aria-label="Leave a review"
        >
          <Star 
            size={20} 
            className="text-black md:hidden group-active:text-white transition-colors" 
            fill="black" 
          />
          <Star 
            size={24} 
            className="hidden md:block text-black group-active:text-white transition-colors" 
            fill="black" 
          />
        </motion.button>
      </div>
    </div>
  );
};
