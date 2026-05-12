import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import { MenuItem, CartItem } from '../constants';

interface MenuGridProps {
  menuItems: MenuItem[];
  cart: CartItem[];
  addToCart: (item: MenuItem) => void;
  updateQuantity: (id: string, delta: number) => void;
}

export const MenuGrid: React.FC<MenuGridProps> = ({ menuItems, cart, addToCart, updateQuantity }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 items-stretch justify-items-center">
      {menuItems.map((item) => {
        const cartItem = cart.find(i => i.id === item.id);
        const quantity = cartItem?.quantity || 0;

        return (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`group glass-card p-4 md:p-6 rounded-[2rem] w-full max-w-[400px] md:max-w-none flex flex-col h-full ${!item.is_available ? 'opacity-70 grayscale-[0.5]' : ''}`}
          >
            <div className="relative aspect-square md:aspect-[4/5] overflow-hidden rounded-2xl md:rounded-[2rem] mb-6 md:mb-8 shadow-sm flex-shrink-0">
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
              
              {!item.is_available && (
                <div className="absolute inset-0 flex items-center justify-center z-30">
                  <div className="bg-black/60 backdrop-blur-sm text-white px-8 py-3 rounded-full text-[11px] font-bold uppercase tracking-[0.3em] border border-white/20">
                    Out of Stock
                  </div>
                </div>
              )}

              <AnimatePresence>
                {quantity > 0 && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute top-6 left-6 bg-elegant-gold text-white w-12 h-12 rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white z-20 text-lg"
                  >
                    {quantity}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="text-center px-4 md:px-6 flex flex-col flex-1">
              <div className="flex-1 space-y-4 md:space-y-6">
                <div>
                  <span className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-bold text-elegant-gold mb-2 md:mb-3 block">{item.category}</span>
                  <h3 className="text-2xl md:text-3xl font-serif font-medium mb-2 md:mb-3 tracking-tight min-h-[4rem] md:min-h-[5rem] flex items-center justify-center text-elegant-ink leading-tight px-2">
                    {item.name}
                  </h3>
                  <div className="w-10 md:w-12 h-px bg-elegant-gold/20 mx-auto mb-4 md:mb-5" />
                  <p className="text-elegant-ink/60 text-[14px] md:text-[18px] font-bold uppercase tracking-[0.2em] leading-relaxed">₹{item.price} — Per Batch</p>
                </div>
              </div>

              <div className="pt-6 md:pt-8 mt-auto">
                {!item.is_available ? (
                  <div className="w-full bg-elegant-ink/5 text-elegant-ink/40 py-5 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-bold text-center border border-elegant-ink/10">
                    Currently Unavailable
                  </div>
                ) : quantity === 0 ? (
                  <button 
                    onClick={() => addToCart(item)}
                    className="w-full glass-card border-elegant-gold/20 text-elegant-ink py-5 rounded-2xl text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-elegant-gold hover:text-white transition-all shadow-sm"
                  >
                    Add to Selection
                  </button>
                ) : (
                  <div className="flex items-center justify-between glass border-elegant-gold/30 rounded-2xl p-2 shadow-sm">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-12 h-12 flex items-center justify-center text-elegant-ink hover:bg-elegant-gold/10 rounded-xl transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-bold text-elegant-ink text-base">{quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-12 h-12 flex items-center justify-center text-elegant-ink rounded-xl transition-colors hover:bg-elegant-gold/10"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
