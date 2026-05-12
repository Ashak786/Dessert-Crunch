import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Quote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface Testimonial {
  id: string;
  customer_name: string;
  rating: number;
  description: string;
  created_at: string;
}

interface TestimonialsProps {
  onLeaveReview: () => void;
}

export const Testimonials = React.forwardRef<HTMLElement, TestimonialsProps>(({ onLeaveReview }, ref) => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTestimonials(data || []);
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();

    // Set up real-time listener for new reviews
    const channel = supabase
      .channel('reviews_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, () => {
        fetchTestimonials();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (testimonials.length <= 1) return;

    if (!isHovered) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
      }, 5000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [testimonials.length, isHovered]);

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-elegant-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (testimonials.length === 0) {
    return (
      <section ref={ref} className="py-24 lg:py-32 bg-white/30 backdrop-blur-sm text-center">
        <div className="max-w-7xl mx-auto px-6">
          <span className="text-elegant-gold uppercase tracking-[0.4em] text-[10px] md:text-xs mb-4 block font-bold">What our guests say</span>
          <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tight mb-12">Testimonials</h2>
          <p className="text-elegant-ink/40 mb-12 font-light italic">No reviews yet. Be the first to share your experience!</p>
          <button 
            onClick={onLeaveReview}
            className="bg-elegant-ink text-white px-10 py-4 rounded-full text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-elegant-gold transition-all shadow-xl"
          >
            Leave a Review
          </button>
        </div>
      </section>
    );
  }

  return (
    <section 
      ref={ref}
      className="relative py-24 lg:py-32 overflow-hidden bg-white/30 backdrop-blur-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-elegant-gold uppercase tracking-[0.4em] text-[10px] md:text-xs mb-4 block font-bold">What our guests say</span>
          <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tight">Testimonials</h2>
          <div className="w-20 h-px bg-elegant-gold/30 mx-auto mt-8" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="absolute -top-10 -left-10 text-elegant-gold/10 pointer-events-none">
            <Quote size={120} strokeWidth={1} />
          </div>

          <div className="relative z-10 min-h-[300px] md:min-h-[400px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonials[currentIndex].id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="w-full text-center px-4 md:px-12"
              >
                <div className="flex justify-center gap-1 mb-8">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={18} 
                      className={cn(
                        "transition-colors",
                        i < testimonials[currentIndex].rating ? "text-elegant-gold fill-elegant-gold" : "text-elegant-ink/10"
                      )} 
                    />
                  ))}
                </div>

                <blockquote className="text-2xl md:text-4xl font-serif font-light italic text-elegant-ink/80 leading-relaxed mb-10 md:mb-12">
                  "{testimonials[currentIndex].description}"
                </blockquote>

                <div className="space-y-2">
                  <cite className="not-italic text-lg md:text-xl font-medium text-elegant-ink block">
                    {testimonials[currentIndex].customer_name}
                  </cite>
                  <time className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-elegant-ink/30 font-bold">
                    {new Date(testimonials[currentIndex].created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </time>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Indicators */}
          <div className="flex justify-center gap-3 mt-12 md:mt-16">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "h-1.5 transition-all duration-500 rounded-full",
                  currentIndex === index ? "w-8 bg-elegant-gold" : "w-2 bg-elegant-gold/20 hover:bg-elegant-gold/40"
                )}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation Arrows (Desktop Only) */}
          <div className="hidden md:block">
            <button 
              onClick={() => setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
              className="absolute top-1/2 -left-20 -translate-y-1/2 p-4 text-elegant-ink/20 hover:text-elegant-gold transition-colors"
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button 
              onClick={() => setCurrentIndex((prev) => (prev + 1) % testimonials.length)}
              className="absolute top-1/2 -right-20 -translate-y-1/2 p-4 text-elegant-ink/20 hover:text-elegant-gold transition-colors"
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        <div className="text-center mt-16">
          <button 
            onClick={onLeaveReview}
            className="bg-elegant-ink text-white px-10 py-4 rounded-full text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-elegant-gold transition-all shadow-xl"
          >
            Leave a Review
          </button>
        </div>
      </div>
    </section>
  );
});
