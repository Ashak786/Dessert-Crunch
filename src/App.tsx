import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  X, 
  MapPin, 
  Menu as MenuIcon,
  CheckCircle2,
  Cookie,
  UtensilsCrossed,
  Users,
  Instagram,
  Facebook,
  User,
  Trash2
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import { MenuGrid } from './components/MenuGrid';
import { FAB } from './components/FAB';
import { ReviewForm } from './components/ReviewForm';
import { Testimonials } from './components/Testimonials';
import { useMenuItems } from './hooks/useMenuItems';
import { type MenuItem, type CartItem } from './constants';

export default function App() {
  const { menuItems } = useMenuItems();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulkPopup, setShowBulkPopup] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '' });
  const [bulkFormData, setBulkFormData] = useState({ 
    name: '', 
    phone: '', 
    address: '', 
    items: [] as { flavor: string, quantity: number }[], 
    date: '' 
  });
  const [currentBulkItem, setCurrentBulkItem] = useState({ flavor: '', quantity: '' });
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [isFlavorDropdownOpen, setIsFlavorDropdownOpen] = useState(false);
  const flavorDropdownRef = useRef<HTMLDivElement>(null);
  
  const menuRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const bulkRef = useRef<HTMLElement>(null);
  const testimonialsRef = useRef<HTMLElement>(null);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (item: MenuItem) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing && existing.quantity >= 5) {
      setShowBulkPopup(true);
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`Added ${item.name} to cart`);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (delta > 0 && item && item.quantity >= 5) {
      setShowBulkPopup(true);
      return;
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const handleCheckout = async () => {
    if (checkoutStep === 1) {
      if (!formData.name || !formData.address) {
        toast.error("Please fill in all details");
        return;
      }
      setCheckoutStep(2);
    } else {
      if (!formData.phone || formData.phone.length !== 10) {
        toast.error("Please enter a valid 10-digit phone number");
        return;
      }

      setIsSubmitting(true);
      const loadingToast = toast.loading("Placing your order...");

      try {
        const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
        const itemsSummary = cart.map(item => `${item.name} (${item.quantity})`).join(', ');

        // 3. The Supabase Handshake (Pushing to both Master and Individual tables)
        const [salesResult, individualResult] = await Promise.all([
          supabase.from('sales_master').insert([
            {
              order_type: 'individual',
              customer_name: formData.name,
              phone_number: formData.phone,
              delivery_address: formData.address,
              items_summary: itemsSummary,
              total_quantity: totalQuantity,
              total_price: totalPrice
            }
          ]),
          supabase.from('individual_orders').insert([
            {
              customer_name: formData.name,
              phone_number: formData.phone,
              delivery_address: formData.address,
              items_summary: itemsSummary,
              total_quantity: totalQuantity,
              total_price: totalPrice
            }
          ])
        ]);

        if (salesResult.error || individualResult.error) {
          const error = salesResult.error || individualResult.error;
          console.error("Supabase error:", error?.message);
          toast.error("Failed to place order: " + error?.message, { id: loadingToast });
          return;
        }

        setIsSuccess(true);
        setCart([]);
        
        // Notify Telegram
        notifyTelegram({
          orderType: 'individual',
          customerName: formData.name,
          phone: formData.phone,
          address: formData.address,
          itemsSummary: itemsSummary,
          totalQuantity: totalQuantity,
          totalPrice: totalPrice
        });

        setFormData({ name: '', address: '', phone: '' });
        setCheckoutStep(1);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        toast.success("Order placed successfully!", { id: loadingToast });
      } catch (error) {
        console.error("Unexpected error:", error);
        toast.error("An error occurred. Check your connection.", { id: loadingToast });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Basic Validations
    if (bulkFormData.items.length === 0) {
      toast.error("Please add at least one cookie flavor to your request.");
      return;
    }

    if (bulkFormData.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    // 2. Date Validation (Must be today or in the future)
    const selectedDate = new Date(bulkFormData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      toast.error("Please select a date in the future.");
      return;
    }

    setIsBulkSubmitting(true);
    const loadingToast = toast.loading("Sending your bulk order request...");

    try {
      const totalQuantity = bulkFormData.items.reduce((sum, i) => sum + i.quantity, 0);
      const flavorsString = bulkFormData.items.map(i => `${i.flavor} (${i.quantity})`).join(', ');

      // 3. The Supabase Handshake (Pushing to both tables)
      const [salesResult, bulkResult] = await Promise.all([
        supabase.from('sales_master').insert([
          {
            order_type: 'bulk',
            customer_name: bulkFormData.name,
            phone_number: bulkFormData.phone,
            delivery_address: bulkFormData.address,
            items_summary: flavorsString,
            total_quantity: totalQuantity,
            preferred_date: bulkFormData.date
          }
        ]),
        supabase.from('bulk_orders').insert([
          {
            full_name: bulkFormData.name,
            phone_number: bulkFormData.phone,
            delivery_address: bulkFormData.address,
            selected_flavors: flavorsString,
            quantity: totalQuantity,
            preferred_date: bulkFormData.date
          }
        ])
      ]);

      if (salesResult.error || bulkResult.error) {
        const error = salesResult.error || bulkResult.error;
        console.error("Supabase error:", error?.message);
        toast.error("Failed to send bulk request: " + error?.message, { id: loadingToast });
        return;
      }

      // 4. Success!
      toast.success("Bulk order request sent! We'll contact you shortly.", { id: loadingToast });
      
      // Notify Telegram
      notifyTelegram({
        orderType: 'bulk',
        customerName: bulkFormData.name,
        phone: bulkFormData.phone,
        address: bulkFormData.address,
        itemsSummary: flavorsString,
        totalQuantity: totalQuantity,
        preferredDate: bulkFormData.date
      });

      setBulkFormData({ name: '', phone: '', address: '', items: [], date: '' });
      setCurrentBulkItem({ flavor: '', quantity: '' });
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Failed to send bulk request.", { id: loadingToast });
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const scrollTo = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const notifyTelegram = async (orderData: any) => {
    try {
      const { orderType, customerName, phone, address, itemsSummary, totalQuantity, totalPrice, preferredDate } = orderData;
      
      const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
      const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        console.error("[Telegram] Missing credentials. Please set VITE_TELEGRAM_BOT_TOKEN and VITE_TELEGRAM_CHAT_ID.");
        return;
      }

      // Helper to escape HTML characters
      const escapeHtml = (unsafe: any = "") => {
        return unsafe
          .toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      const safeName = escapeHtml(customerName);
      const safeAddress = escapeHtml(address);
      const safeItems = escapeHtml(itemsSummary);
      const safePhone = escapeHtml(phone);
      const telPhone = phone.toString().replace(/[^0-9+]/g, '');

      let formattedDate = preferredDate;
      if (preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
        try {
          const dateObj = new Date(preferredDate);
          if (!isNaN(dateObj.getTime())) {
            const day = dateObj.getDate().toString().padStart(2, '0');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            formattedDate = `${day} ${month} ${year}`;
          }
        } catch (e) {
          console.error("Error formatting date:", e);
        }
      }

      const title = orderType === 'bulk' ? '📦 <b>NEW BULK ORDER REQUEST</b>' : '🍳 <b>NEW INDIVIDUAL ORDER</b>';
      const dateLine = formattedDate ? `<b>Preferred Date:</b> ${escapeHtml(formattedDate)}\n` : '';
      const priceLine = totalPrice ? `<b>Total Price:</b> ₹${totalPrice}\n` : '';

      const message = `
${title}
--------------------------
<b>Customer:</b> ${safeName}
<b>Phone:</b> <a href="tel:${telPhone}">${safePhone}</a>
<b>Address:</b> ${safeAddress}

<b>Items:</b>
${safeItems}

<b>Total Quantity:</b> ${totalQuantity}
${priceLine}${dateLine}--------------------------
      `.trim();

      const rawPhone = phone.toString().replace(/\D/g, '');
      const whatsappNumber = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
      const whatsappUrl = `https://wa.me/${whatsappNumber}`;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "💬 WhatsApp", url: whatsappUrl }]]
          }
        }),
      });

      if (response.ok) {
        console.log("[Telegram Notification] Success!");
      } else {
        const errData = await response.json();
        console.error("[Telegram Notification] API Error:", errData);
      }
    } catch (error) {
      console.error("[Telegram Notification] Network error:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (flavorDropdownRef.current && !flavorDropdownRef.current.contains(event.target as Node)) {
        setIsFlavorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen pb-20 lg:pb-0 overflow-x-hidden relative bg-elegant-paper selection:bg-elegant-gold selection:text-white bg-animate antialiased">
      <Toaster position="top-center" richColors />

      {/* Background Blobs for Glassmorphism Depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="bg-blob top-[-10%] left-[-10%] opacity-40" />
        <div className="bg-blob bottom-[-10%] right-[-10%] opacity-30" />
        <div className="bg-blob top-[40%] right-[20%] opacity-20" />
      </div>
      {/* Mobile Bottom Nav */}
      <motion.nav 
        initial={{ y: 100 }}
        animate={{ y: isReviewOpen ? 150 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 99999 }}
        className="flex lg:hidden glass rounded-3xl h-20 items-center justify-around px-4 shadow-2xl pb-2"
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center text-elegant-ink/40 hover:text-elegant-gold">
          <UtensilsCrossed size={20} />
          <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">Home</span>
        </button>
        <button onClick={() => scrollTo(menuRef)} className="flex flex-col items-center text-elegant-ink/40 hover:text-elegant-gold">
          <MenuIcon size={20} />
          <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">Menu</span>
        </button>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center relative -top-4 bg-elegant-ink text-white p-4 rounded-full shadow-xl border-4 border-white"
        >
          <ShoppingBag size={24} />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-elegant-gold text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-bold">
              {totalItems}
            </span>
          )}
        </button>
        <button onClick={() => scrollTo(bulkRef)} className="flex flex-col items-center text-elegant-ink/40 hover:text-elegant-gold">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="8" cy="21" r="1"/>
            <circle cx="19" cy="21" r="1"/>
            <path d="M2 2h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            <path d="M9 3h10v3H9z"/>
            <path d="M11 0h6v3h-6z"/>
          </svg>
          <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">Bulk</span>
        </button>
        <button onClick={() => scrollTo(aboutRef)} className="flex flex-col items-center text-elegant-ink/40 hover:text-elegant-gold">
          <User size={20} />
          <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">About</span>
        </button>
      </motion.nav>

      {/* Desktop Header */}
      <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 glass h-20 items-center px-12 justify-between">
        <div className="flex items-center gap-3">
          <Cookie className="text-elegant-gold w-7 h-7" />
          <span className="text-2xl font-serif font-medium tracking-tight text-elegant-ink">Dessert & Crunch</span>
        </div>
        <nav className="flex gap-10 font-sans text-[20px] uppercase tracking-[0.2em] font-medium text-elegant-ink/60 items-center">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-elegant-gold transition-colors">Home</button>
          <button onClick={() => scrollTo(menuRef)} className="hover:text-elegant-gold transition-colors">Menu</button>
          <button onClick={() => scrollTo(bulkRef)} className="hover:text-elegant-gold transition-colors">Bulk</button>
          <button onClick={() => scrollTo(aboutRef)} className="hover:text-elegant-gold transition-colors">About</button>
        </nav>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative border border-elegant-gold/30 px-8 py-2.5 rounded-full text-elegant-ink flex items-center gap-3 hover:bg-elegant-gold hover:text-white transition-all text-sm font-bold uppercase tracking-widest shadow-sm"
        >
          <ShoppingBag size={18} />
          <span>Cart ({totalItems})</span>
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pb-24 lg:pb-0">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=2000" 
            alt="Cookies Background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-elegant-ink/30" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-white/60 uppercase tracking-[0.5em] text-[10px] mb-10 block font-bold">Dessert &  Cruch  — Bengaluru</span>
            <h1 className="text-7xl md:text-[140px] text-white font-serif font-light leading-[0.85] mb-12 text-shadow tracking-tighter">
              The Art of the <br />
              <span className="italic font-normal text-elegant-gold">Perfect Cookie</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-12 font-sans font-light max-w-xl mx-auto leading-relaxed tracking-wide">
              Handcrafted with meticulous precision and a touch of heritage. 
              Delivered warm to the discerning palate.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-12 sm:mb-0">
              <button 
                onClick={() => scrollTo(testimonialsRef)}
                className="group relative bg-white text-elegant-ink px-14 py-6 rounded-full text-[11px] uppercase tracking-[0.3em] font-bold overflow-hidden transition-all shadow-2xl flex items-center justify-center"
              >
                <span className="relative z-10 transition-opacity duration-500 group-hover:opacity-0">Customer Reviews</span>
                <div className="absolute inset-0 bg-elegant-gold translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <span className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">Customer Reviews</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <Testimonials ref={testimonialsRef} onLeaveReview={() => setIsReviewOpen(true)} />

      <main className="max-w-7xl mx-auto px-6 py-16 lg:py-32 space-y-24 lg:space-y-48">

        {/* Menu Section */}
        <section ref={menuRef} id="menu" className="scroll-mt-6 lg:scroll-mt-32">
          <div className="text-center mb-12 md:mb-20">
            <span className="text-elegant-gold uppercase tracking-[0.3em] text-[10px] md:text-xs mb-4 block font-semibold">Signature Collection</span>
            <h2 className="text-4xl md:text-6xl font-serif font-light mb-6 tracking-tight">Handcrafted Delights</h2>
            <div className="w-20 md:w-24 h-px bg-elegant-gold/30 mx-auto mb-8" />
            <p className="text-elegant-ink/50 max-w-xl mx-auto font-light leading-relaxed text-sm md:text-base px-4 md:px-0">Every batch is prepared with meticulous care, using only the finest ingredients to ensure a moment of pure indulgence.</p>
          </div>

        <MenuGrid 
          menuItems={menuItems} 
          cart={cart} 
          addToCart={addToCart} 
          updateQuantity={updateQuantity} 
        />
      </section>

        {/* Bulk Orders Section */}
        <section ref={bulkRef} className="glass rounded-[2rem] md:rounded-[4rem] px-5 py-12 md:p-32 relative overflow-hidden scroll-mt-6 lg:scroll-mt-32">
          <div className="absolute top-0 right-0 p-8 md:p-16 opacity-[0.02] pointer-events-none">
            <Users size={240} className="md:w-[320px] md:h-[320px]" strokeWidth={0.5} />
          </div>
          
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 md:gap-3 bg-elegant-gold/5 text-elegant-gold px-4 md:px-8 py-2 md:py-3 rounded-full mb-6 md:mb-12 text-[11px] md:text-[15px] uppercase tracking-[0.2em] md:tracking-[0.4em] font-bold max-w-full">
              <MapPin size={10} className="flex-shrink-0 md:w-3.5 md:h-3.5" />
              <span className="whitespace-normal">Exclusively Serving Bengaluru</span>
            </div>
            
            <h2 className="text-2xl md:text-6xl font-serif font-light mb-3 md:mb-8 tracking-tight leading-tight px-2">Gifting & Special Events</h2>
            <p className="text-elegant-ink/40 mb-10 md:mb-20 font-light leading-relaxed tracking-wide max-w-xl mx-auto text-[13px] md:text-base px-4">From elegant corporate gifting to bespoke wedding favors, we bring a touch of luxury to your special occasions. Share your vision with us.</p>

            <form onSubmit={handleBulkSubmit} className="grid md:grid-cols-2 gap-6 md:gap-12 text-left">
              <div className="space-y-3 md:space-y-4">
                <label className="text-[12px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Full Name <span className="text-elegant-gold">*</span></label>
                <input 
                  required
                  type="text" 
                  value={bulkFormData.name}
                  onChange={e => setBulkFormData({...bulkFormData, name: e.target.value})}
                  className="w-full bg-transparent border-b border-elegant-gold/20 px-4 py-4 md:py-5 focus:outline-none focus:border-elegant-gold transition-all font-light tracking-wide placeholder:text-elegant-ink/20 text-sm md:text-base" 
                  placeholder="E.g. Ravi Mohan"
                />
              </div>
              <div className="space-y-3 md:space-y-4">
                <label className="text-[12px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Phone Number <span className="text-elegant-gold">*</span></label>
                <input 
                  required
                  type="tel" 
                  value={bulkFormData.phone}
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setBulkFormData({...bulkFormData, phone: value});
                  }}
                  className="w-full bg-transparent border-b border-elegant-gold/20 px-4 py-4 md:py-5 focus:outline-none focus:border-elegant-gold transition-all font-light tracking-wide placeholder:text-elegant-ink/20 text-sm md:text-base" 
                  placeholder="10-digit number"
                />
              </div>
              <div className="md:col-span-2 space-y-3 md:space-y-4">
                <label className="text-[12px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Delivery Address <span className="text-elegant-gold">*</span></label>
                <textarea 
                  required
                  rows={2}
                  value={bulkFormData.address}
                  onChange={e => setBulkFormData({...bulkFormData, address: e.target.value})}
                  className="w-full bg-transparent border-b border-elegant-gold/20 px-4 py-4 md:py-5 focus:outline-none focus:border-elegant-gold transition-all font-light tracking-wide resize-none placeholder:text-elegant-ink/20 text-sm md:text-base" 
                  placeholder="Your residence or venue in Bengaluru"
                />
              </div>
              <div className="space-y-2 md:space-y-4 relative" ref={flavorDropdownRef}>
                <label className="text-[11px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Select your flavors <span className="text-elegant-gold">*</span></label>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsFlavorDropdownOpen(!isFlavorDropdownOpen)}
                    className="w-full bg-transparent border-b border-elegant-gold/20 px-2 py-3.5 md:px-4 md:py-5 focus:outline-none focus:border-elegant-gold transition-all font-light tracking-wide text-[13px] md:text-base flex items-center justify-between group text-left"
                  >
                    <span className={cn(
                      "transition-colors text-left",
                      currentBulkItem.flavor ? "text-elegant-ink" : "text-elegant-ink/20"
                    )}>
                      {currentBulkItem.flavor || "Choose from our Signature Collection"}
                    </span>
                    <motion.div 
                      animate={{ rotate: isFlavorDropdownOpen ? 180 : 0 }}
                      className="text-elegant-gold"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {isFlavorDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 right-0 top-full mt-3 z-50 glass-dropdown rounded-[1.5rem] md:rounded-[2rem] shadow-2xl overflow-hidden border border-elegant-gold/10 max-h-[350px] overflow-y-auto no-scrollbar"
                      >
                        <motion.div 
                          className="p-3"
                          initial="closed"
                          animate="open"
                          variants={{
                            open: {
                              transition: { staggerChildren: 0.05 }
                            },
                            closed: {
                              transition: { staggerChildren: 0.05, staggerDirection: -1 }
                            }
                          }}
                        >
                          {menuItems.map((item) => (
                            <motion.button
                              key={item.id}
                              type="button"
                              variants={{
                                open: { opacity: 1, x: 0 },
                                closed: { opacity: 0, x: -10 }
                              }}
                              onClick={() => {
                                setCurrentBulkItem({ ...currentBulkItem, flavor: item.name });
                                setIsFlavorDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-5 py-4 md:px-6 md:py-4 rounded-2xl text-[13px] md:text-base transition-all flex items-center justify-between group mb-1.5 last:mb-0",
                                currentBulkItem.flavor === item.name 
                                  ? "bg-elegant-gold text-white shadow-lg shadow-elegant-gold/20" 
                                  : "hover:bg-elegant-gold/10 text-elegant-ink/70 hover:text-elegant-ink"
                              )}
                            >
                              <span className="font-light tracking-wide">{item.name}</span>
                              {currentBulkItem.flavor === item.name && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
                                  <CheckCircle2 size={16} />
                                </motion.div>
                              )}
                            </motion.button>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="space-y-2 md:space-y-4">
                <label className="text-[11px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Quantity <span className="text-elegant-gold">*</span></label>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <input 
                    type="number" 
                    min="1"
                    value={currentBulkItem.quantity}
                    onChange={e => setCurrentBulkItem({...currentBulkItem, quantity: e.target.value})}
                    className="flex-1 bg-transparent border-b border-elegant-gold/20 px-2 py-3.5 md:px-4 md:py-5 focus:outline-none focus:border-elegant-gold transition-all font-light tracking-wide placeholder:text-elegant-ink/20 text-[13px] md:text-base" 
                    placeholder="Count (e.g., 50)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentBulkItem.flavor || !currentBulkItem.quantity) {
                        toast.error("Please select a flavor and enter a quantity.");
                        return;
                      }
                      setBulkFormData({
                        ...bulkFormData,
                        items: [...bulkFormData.items, { flavor: currentBulkItem.flavor, quantity: parseInt(currentBulkItem.quantity as string) }]
                      });
                      setCurrentBulkItem({ flavor: '', quantity: '' });
                    }}
                    className="bg-elegant-gold text-white px-6 py-3.5 md:py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-elegant-ink transition-all shadow-lg sm:w-auto w-full"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {bulkFormData.items.length > 0 && (
                <div className="md:col-span-2 space-y-4">
                  <label className="text-[12px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Items in your request</label>
                  <div className="grid gap-3">
                    {bulkFormData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between glass p-4 rounded-2xl border border-elegant-gold/10">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-elegant-gold/10 flex items-center justify-center text-elegant-gold font-serif italic">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-elegant-ink">{item.flavor}</p>
                            <p className="text-xs text-elegant-ink/40">{item.quantity} pieces</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = [...bulkFormData.items];
                            newItems.splice(index, 1);
                            setBulkFormData({ ...bulkFormData, items: newItems });
                          }}
                          className="p-2 text-elegant-ink/20 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="md:col-span-2 space-y-2 md:space-y-4">
                <label className="text-[11px] md:text-[13px] uppercase tracking-[0.3em] font-bold text-black ml-1">Preferred Date <span className="text-elegant-gold">*</span></label>
                <input 
                  required
                  type="date" 
                  value={bulkFormData.date}
                  onChange={e => setBulkFormData({...bulkFormData, date: e.target.value})}
                  className="w-full bg-transparent border-b border-elegant-gold/20 px-2 py-3.5 md:px-4 md:py-5 focus:outline-none focus:border-elegant-gold transition-all font-light tracking-wide text-[13px] md:text-base" 
                />
              </div>
              <button 
                disabled={isBulkSubmitting}
                className="md:col-span-2 bg-elegant-ink text-white py-4 md:py-6 rounded-xl text-[11px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.4em] font-bold hover:bg-elegant-gold transition-all shadow-2xl mt-4 md:mt-8 disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {isBulkSubmitting ? "Sending Request..." : "Send Inquiry"}
              </button>
            </form>
          </div>
        </section>

        {/* About Section */}
        <section ref={aboutRef} className="grid md:grid-cols-2 gap-12 md:gap-24 items-start scroll-mt-6 lg:scroll-mt-32">
          <div className="space-y-8 md:space-y-12">
            <div className="space-y-4">
              <span className="text-elegant-gold uppercase tracking-[0.4em] text-[10px] font-bold">The Founder</span>
              <h2 className="text-4xl md:text-7xl font-serif font-light leading-[1.1] tracking-tight"><span className="italic">Benedict Hoover P</span></h2>
            </div>
            
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl border border-elegant-gold/10">
                <img 
                  src="https://tsbvcjjybxpkappcqqqi.supabase.co/storage/v1/object/public/Cookies/Profile_Pic.jpeg?auto=format&fit=crop&q=80&w=1000" 
                  alt="Baking cookies" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-elegant-gold/5 rounded-full blur-[100px] -z-10" />
              <div className="absolute top-1/2 -left-12 -translate-y-1/2 hidden xl:block">
                <span className="writing-vertical-rl rotate-180 text-[9px] uppercase tracking-[0.4em] font-bold text-elegant-gold/30">
                  Crafted with Passion — Since 2026
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-10 md:space-y-16 md:pt-32 lg:pl-20">
            <div className="w-20 h-px bg-elegant-gold/40" />
            <div className="space-y-8 max-w-xl">
              <p className="text-lg md:text-2xl text-elegant-ink/70 leading-relaxed font-light tracking-wide">
                Founded by Baker Meera, Dessert & Crunch is a celebration of artisanal craftsmanship. 
                We believe that the finest cookies are born from patience, premium ingredients, 
                and a deep respect for traditional techniques.
              </p>
              <p className="text-lg md:text-2xl text-elegant-ink/70 leading-relaxed font-light tracking-wide">
                Every creation is a tribute to the comforting flavors of home, elevated for the 
                discerning palate. Small-batch, always fresh, and never compromised.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-12 md:gap-20 pt-12 md:pt-20 border-t border-elegant-gold/10">
              <div className="space-y-4">
                <h4 className="font-serif text-5xl md:text-7xl text-elegant-gold font-light leading-none">100%</h4>
                <p className="text-[10px] md:text-[12px] uppercase tracking-[0.5em] font-bold text-elegant-ink/30">Artisan Made</p>
              </div>
              <div className="space-y-4">
                <h4 className="font-serif text-5xl md:text-7xl text-elegant-gold font-light leading-none">Daily</h4>
                <p className="text-[10px] md:text-[12px] uppercase tracking-[0.5em] font-bold text-elegant-ink/30">Fresh Batches</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-elegant-ink text-white pt-24 pb-[22px] px-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-16">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-8">
              <Cookie className="text-elegant-gold w-8 h-8" />
              <span className="text-3xl font-serif font-medium tracking-tight">Dessert & Crunch</span>
            </div>
            <p className="text-lg text-white/60 max-w-xl leading-relaxed font-light italic font-serif">
              At Dessert & Crunch, we believe in elevating the simple joy of a cookie into a truly artisanal experience. 
              Every creation is handcrafted in small batches using the finest ingredients, ensuring a perfect balance 
              of texture and flavor. From our kitchen to your doorstep, we deliver the warmth of freshly baked 
              goodness with care across Bangalore.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-[0.3em] font-bold mb-8 text-elegant-gold">Follow Us</h4>
            <div className="flex flex-col gap-4">
              <a 
                href="#" 
                className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-elegant-gold/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-elegant-gold/10 flex items-center justify-center text-elegant-gold group-hover:bg-elegant-gold group-hover:text-white transition-all">
                  <Instagram size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30">Instagram</span>
                  <span className="text-sm font-medium text-white/80 group-hover:text-white">@dessertandcrunch</span>
                </div>
              </a>
              <a 
                href="#" 
                className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-elegant-gold/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-elegant-gold/10 flex items-center justify-center text-elegant-gold group-hover:bg-elegant-gold group-hover:text-white transition-all">
                  <Facebook size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30">Facebook</span>
                  <span className="text-sm font-medium text-white/80 group-hover:text-white">Dessert & Crunch</span>
                </div>
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-white/20 text-[10px] uppercase tracking-[0.2em] font-medium">
          <span>© 2026 Dessert & Crunch</span>
        </div>
      </footer>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-elegant-ink/60 z-[100000] backdrop-blur-sm overscroll-none"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 lg:top-1/2 lg:left-1/2 lg:bottom-auto lg:right-auto lg:-translate-x-1/2 lg:-translate-y-1/2 w-full lg:max-w-md h-[85vh] lg:h-auto lg:max-h-[85vh] bg-elegant-paper z-[100001] shadow-2xl flex flex-col rounded-t-[3rem] lg:rounded-[3rem] overflow-hidden"
            >
              <div className="p-10 border-b border-elegant-gold/10 flex items-center justify-between">
                <h2 className="text-3xl font-serif font-medium tracking-tight">Your Selection</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-elegant-ink/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <ShoppingBag size={48} strokeWidth={1} className="mb-6" />
                    <p className="text-sm uppercase tracking-widest font-medium">Your selection is empty</p>
                    <button 
                      onClick={() => { setIsCartOpen(false); scrollTo(menuRef); }}
                      className="mt-6 text-elegant-gold font-bold underline text-xs tracking-widest"
                    >
                      Browse Collection
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex gap-6 items-center glass-card p-4 rounded-2xl">
                      <div className="w-20 h-20 rounded-xl overflow-hidden shadow-sm">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-serif text-lg mb-1">{item.name}</h4>
                        <p className="text-elegant-gold font-medium text-sm">₹{item.price}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-6 h-6 rounded-full border border-elegant-gold/30 flex items-center justify-center hover:bg-elegant-ink hover:text-white transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-sm font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-6 h-6 rounded-full border border-elegant-gold/30 flex items-center justify-center hover:bg-elegant-ink hover:text-white transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-elegant-ink/20 hover:text-red-400 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-10 glass border-t border-white/20">
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-xs uppercase tracking-widest font-bold text-elegant-ink/40">Total Amount</span>
                    <span className="text-3xl font-serif font-medium">₹{totalPrice}</span>
                  </div>
                  <button 
                    onClick={() => setIsCheckoutOpen(true)}
                    className="w-full bg-elegant-ink text-white py-5 rounded-xl text-xs uppercase tracking-[0.3em] font-bold shadow-xl hover:bg-elegant-gold transition-all"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[110000] flex items-end sm:items-center justify-center sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute inset-0 bg-elegant-ink/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-xl bg-elegant-paper p-6 pt-10 md:p-12 rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-y-auto max-h-[95vh] sm:max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-8 md:mb-12">
                <div>
                  <h2 className="text-3xl md:text-4xl font-serif font-medium tracking-tight mb-1 md:mb-2">Checkout</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-elegant-gold">Step {checkoutStep} of 2</p>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-elegant-ink/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 md:space-y-8">
                {checkoutStep === 1 ? (
                  <>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-elegant-ink/40 ml-1">Full Name <span className="text-elegant-gold">*</span></label>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-white border-b border-elegant-gold/20 px-4 py-3 md:px-6 md:py-4 focus:outline-none focus:border-elegant-gold transition-colors font-light text-sm md:text-base" 
                        placeholder="E.g. Ravi Mohan"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-elegant-ink/40 ml-1">Delivery Address <span className="text-elegant-gold">*</span></label>
                      <textarea 
                        required
                        rows={3}
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        className="w-full bg-white border-b border-elegant-gold/20 px-4 py-3 md:px-6 md:py-4 focus:outline-none focus:border-elegant-gold transition-colors font-light resize-none text-sm md:text-base" 
                        placeholder="Your residence in Bangalore"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-elegant-ink/40 ml-1">Phone Number <span className="text-elegant-gold">*</span></label>
                    <input 
                      required
                      type="tel" 
                      value={formData.phone}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({...formData, phone: value});
                      }}
                      className="w-full bg-white border-b border-elegant-gold/20 px-4 py-3 md:px-6 md:py-4 focus:outline-none focus:border-elegant-gold transition-colors font-light text-sm md:text-base" 
                      placeholder="10-digit number"
                    />
                    <p className="text-[10px] text-elegant-ink/40 mt-4 italic">We will contact you once the order is packed.</p>
                  </div>
                )}

                <div className="flex gap-4 md:gap-6 pt-6 md:pt-8">
                  {checkoutStep === 2 && (
                    <button 
                      onClick={() => setCheckoutStep(1)}
                      className="flex-1 border border-elegant-gold/30 py-4 md:py-5 rounded-xl text-[10px] md:text-xs uppercase tracking-widest font-bold hover:bg-elegant-ink hover:text-white transition-all"
                    >
                      Back
                    </button>
                  )}
                  <button 
                    disabled={isSubmitting}
                    onClick={handleCheckout}
                    className="flex-[2] bg-elegant-ink text-white py-4 md:py-5 rounded-xl text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold shadow-xl hover:bg-elegant-gold transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : (checkoutStep === 1 ? 'Continue' : 'Complete Order')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200000] bg-elegant-paper flex flex-col items-center justify-center p-12 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="text-elegant-gold mb-8 md:mb-12"
            >
              <CheckCircle2 size={80} className="md:w-[100px] md:h-[100px]" strokeWidth={1} />
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-serif font-light mb-4 md:mb-6 tracking-tight">Order Received</h2>
            <p className="text-base md:text-lg text-elegant-ink/50 mb-10 md:mb-16 max-w-md font-light leading-relaxed">
              Your selection has been sent to our bakery. Expect a personal confirmation call shortly.
            </p>
            <button 
              onClick={() => setIsSuccess(false)}
              className="bg-elegant-ink text-white px-16 py-5 rounded-xl text-xs uppercase tracking-[0.3em] font-bold shadow-2xl hover:bg-elegant-gold transition-all"
            >
              Return to Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Bulk Order Suggestion Popup */}
      <AnimatePresence>
        {showBulkPopup && (
          <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkPopup(false)}
              className="absolute inset-0 bg-elegant-ink/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2rem] p-8 md:p-16 max-w-lg w-full text-center shadow-2xl border border-elegant-gold/20 mx-4"
            >
              <div className="bg-elegant-gold/10 w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-10">
                <Users className="text-elegant-gold w-8 h-8 md:w-12 md:h-12" strokeWidth={1} />
              </div>
              <h3 className="text-3xl md:text-4xl font-serif font-light mb-4 md:mb-6 tracking-tight">Large order?</h3>
              <p className="text-base md:text-lg text-elegant-ink/50 mb-8 md:mb-12 font-light leading-relaxed">
                For orders of more than 5 batches, we recommend our specialized bulk service for better pricing and custom options.
              </p>
              <div className="flex flex-col gap-3 md:gap-4">
                <button 
                  onClick={() => {
                    setShowBulkPopup(false);
                    scrollTo(bulkRef);
                  }}
                  className="bg-elegant-ink text-white py-5 md:py-6 rounded-xl text-[10px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.4em] font-bold hover:bg-elegant-gold transition-all shadow-xl"
                >
                  Switch to Bulk Mode
                </button>
                <button 
                  onClick={() => setShowBulkPopup(false)}
                  className="text-elegant-ink/40 py-3 md:py-4 text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold hover:text-elegant-ink transition-colors"
                >
                  Continue with Current Selection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ReviewForm isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} />
      <FAB onClick={() => setIsReviewOpen(true)} />
    </div>
  );
}
