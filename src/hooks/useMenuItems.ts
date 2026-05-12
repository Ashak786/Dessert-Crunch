import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MenuItem } from '../constants';

export const useMenuItems = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .order('id', { ascending: true });
        
        if (error) {
          console.error('Error fetching menu items:', error);
          // Keep default items on error
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setMenuItems(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching menu items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, []);

  return { menuItems, loading };
};
