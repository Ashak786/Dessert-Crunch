import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [thoughts, setThoughts] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Stops the page from refreshing

    // 1. Check if the user missed anything (Bengaluru customers are busy!)
    if (!name || !rating || !thoughts) {
      toast.error("Please fill in your name, rating, and thoughts!");
      return;
    }

    setIsSubmitting(true);
    // 2. The Supabase Handshake
    const { error } = await supabase
      .from('reviews') // Must match your SQL table name
      .insert([
        {
          customer_name: name,   // Column 1
          rating: Number(rating), // Column 2 (Forces it to be a number)
          description: thoughts,  // Column 3 (This matches our SQL 'description')
          is_featured: false      // Column 4 (Defaulting to false for moderation)
        }
      ]);

    // 3. The Result
    if (error) {
      console.error("The error is:", error.message);
      toast.error("Failed to submit: " + error.message);
      setIsSubmitting(false);
    } else {
      setIsSuccess(true);
      toast.success("Thank you! Your review for Dessert & Crunch is saved.");
      
      // Clear the form after success
      setTimeout(() => {
        setIsSuccess(false);
        setName('');
        setRating(5);
        setThoughts('');
        onClose();
        setIsSubmitting(false);
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[6000] bg-elegant-paper flex flex-col overflow-hidden"
        >
          {!isSuccess ? (
            <form onSubmit={handleReviewSubmit} className="flex flex-col h-full">
              {/* Header */}
              <div className="p-6 md:p-10 border-b border-elegant-gold/10 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl md:text-4xl font-serif font-medium tracking-tight">Leave a Review</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-elegant-gold mt-1">Share your experience</p>
                </div>
                <button 
                  type="button"
                  onClick={onClose}
                  className="p-3 hover:bg-elegant-ink/5 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-xl mx-auto space-y-8 md:space-y-12">
                  {/* Star Rating */}
                  <div className="text-center space-y-4 md:space-y-6">
                    <label className="text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold text-elegant-ink/40 block">Your Rating <span className="text-elegant-gold">*</span></label>
                    <div className="flex justify-center gap-2 md:gap-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="transition-transform active:scale-90 p-1"
                        >
                          <Star
                            size={32}
                            className={`transition-colors duration-300 ${
                              (hoverRating || rating) >= star 
                                ? 'text-elegant-gold fill-elegant-gold' 
                                : 'text-elegant-ink/10'
                            }`}
                            strokeWidth={1.5}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-2 md:space-y-3">
                    <label className="text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Your Name <span className="text-elegant-gold">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-white/50 border-b border-elegant-gold/20 px-4 md:px-6 py-3 md:py-4 focus:outline-none focus:border-elegant-gold transition-colors font-light text-base md:text-lg" 
                      placeholder="E.g. Ravi Mohan"
                    />
                  </div>

                  {/* Description Input */}
                  <div className="space-y-2 md:space-y-3">
                    <label className="text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Your Thoughts <span className="text-elegant-gold">*</span></label>
                    <textarea 
                      required
                      rows={4}
                      value={thoughts}
                      onChange={e => setThoughts(e.target.value)}
                      className="w-full bg-white/50 border-b border-elegant-gold/20 px-4 md:px-6 py-3 md:py-4 focus:outline-none focus:border-elegant-gold transition-colors font-light text-base md:text-lg resize-none" 
                      placeholder="Tell us what you loved about our cookies..."
                    />
                  </div>
                </div>
              </div>

              {/* Sticky Footer for Submit Button */}
              <div className="p-6 md:p-10 border-t border-elegant-gold/10 bg-white/50 backdrop-blur-md">
                <div className="max-w-xl mx-auto">
                  <button 
                    disabled={isSubmitting}
                    className="w-full bg-elegant-ink text-white py-5 md:py-6 rounded-2xl text-[11px] md:text-xs uppercase tracking-[0.3em] md:tracking-[0.4em] font-bold shadow-2xl hover:bg-elegant-gold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Review'
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <>
              {/* Success Header (to keep X button) */}
              <div className="p-6 md:p-10 border-b border-elegant-gold/10 flex items-center justify-end bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <button 
                  onClick={onClose}
                  className="p-3 hover:bg-elegant-ink/5 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8"
                >
                  <div className="text-elegant-gold flex justify-center">
                    <CheckCircle2 size={100} strokeWidth={1} />
                  </div>
                  <h2 className="text-4xl md:text-6xl font-serif font-light mb-6 tracking-tight">Thank You!</h2>
                  <p className="text-lg md:text-xl text-elegant-ink/50 max-w-md font-light leading-relaxed mx-auto">
                    Your feedback means the world to us. We're so glad you enjoyed our cookies!
                  </p>
                </motion.div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
