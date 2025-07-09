-- Create enum types for better data consistency
CREATE TYPE movement_type AS ENUM ('receive', 'putaway', 'pick', 'adjustment', 'transfer');
CREATE TYPE location_type AS ENUM ('dock', 'shelf', 'bin', 'staging', 'quarantine');
CREATE TYPE pick_order_status AS ENUM ('open', 'in_progress', 'complete', 'cancelled');
CREATE TYPE unit_type AS ENUM ('each', 'box', 'pallet', 'case', 'kg', 'lbs');

-- Products table
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    unit_type unit_type NOT NULL DEFAULT 'each',
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Locations table
CREATE TABLE public.locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type location_type NOT NULL DEFAULT 'shelf',
    capacity INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stock movements table
CREATE TABLE public.stock_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES public.locations(id),
    to_location_id UUID REFERENCES public.locations(id),
    quantity INTEGER NOT NULL,
    movement_type movement_type NOT NULL,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pick orders table
CREATE TABLE public.pick_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    status pick_order_status NOT NULL DEFAULT 'open',
    assigned_user_id UUID REFERENCES auth.users(id),
    priority INTEGER DEFAULT 1,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Pick order items table
CREATE TABLE public.pick_order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pick_order_id UUID NOT NULL REFERENCES public.pick_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id),
    quantity_requested INTEGER NOT NULL,
    quantity_picked INTEGER DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Application logs table for external system access
CREATE TABLE public.application_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    user_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User profiles table
CREATE TABLE public.user_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'worker',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify products" ON public.products FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify locations" ON public.locations FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create stock movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their stock movements" ON public.stock_movements FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view pick orders" ON public.pick_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify pick orders" ON public.pick_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view pick order items" ON public.pick_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify pick order items" ON public.pick_order_items FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view application logs" ON public.application_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create application logs" ON public.application_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pick_orders_updated_at BEFORE UPDATE ON public.pick_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pick_order_items_updated_at BEFORE UPDATE ON public.pick_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update product quantity based on stock movements
CREATE OR REPLACE FUNCTION public.update_product_quantity()
RETURNS TRIGGER AS $$
BEGIN
    -- For new movements, update product quantity
    IF TG_OP = 'INSERT' THEN
        -- Increase quantity for receives and putaways
        IF NEW.movement_type IN ('receive', 'putaway') THEN
            UPDATE public.products 
            SET quantity = quantity + NEW.quantity 
            WHERE id = NEW.product_id;
        -- Decrease quantity for picks
        ELSIF NEW.movement_type IN ('pick') THEN
            UPDATE public.products 
            SET quantity = quantity - NEW.quantity 
            WHERE id = NEW.product_id;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_product_quantity_trigger
    AFTER INSERT ON public.stock_movements
    FOR EACH ROW EXECUTE FUNCTION public.update_product_quantity();

-- Enable realtime for all tables
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.pick_orders REPLICA IDENTITY FULL;
ALTER TABLE public.pick_order_items REPLICA IDENTITY FULL;
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pick_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pick_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;