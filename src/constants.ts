export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  is_available: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
