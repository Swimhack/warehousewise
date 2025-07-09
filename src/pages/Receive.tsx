import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TruckIcon, Package, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  type: string;
}

interface ReceiveForm {
  product_id: string;
  location_id: string;
  quantity: number;
  notes: string;
}

const Receive = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>({
    product_id: "",
    location_id: "",
    quantity: 1,
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load products and locations in parallel
      const [productsResult, locationsResult] = await Promise.all([
        supabase.from("products").select("id, sku, name").order("name"),
        supabase.from("locations").select("id, name, type").eq("is_active", true).order("name")
      ]);

      if (productsResult.error) throw productsResult.error;
      if (locationsResult.error) throw locationsResult.error;

      setProducts(productsResult.data || []);
      setLocations(locationsResult.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to receive goods");
      return;
    }

    try {
      setSubmitting(true);

      // Create stock movement record
      const { error } = await supabase
        .from("stock_movements")
        .insert([{
          product_id: receiveForm.product_id,
          to_location_id: receiveForm.location_id,
          quantity: receiveForm.quantity,
          movement_type: "receive",
          notes: receiveForm.notes || null,
          user_id: user.id,
        }]);

      if (error) throw error;

      toast.success(`Successfully received ${receiveForm.quantity} items!`);
      
      // Reset form
      setReceiveForm({
        product_id: "",
        location_id: "",
        quantity: 1,
        notes: "",
      });

      // Log the activity
      await supabase
        .from("application_logs")
        .insert([{
          level: "info",
          message: `Received ${receiveForm.quantity} items`,
          metadata: {
            product_id: receiveForm.product_id,
            location_id: receiveForm.location_id,
            quantity: receiveForm.quantity,
            movement_type: "receive"
          },
          user_id: user.id,
        }]);

    } catch (error: any) {
      console.error("Error receiving goods:", error);
      toast.error(error.message || "Failed to receive goods");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Receive Goods</h1>
        <div className="animate-pulse">
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <TruckIcon className="w-8 h-8 mr-3 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Receive Goods</h1>
          <p className="text-muted-foreground">Record incoming inventory and assign to storage locations</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receive New Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReceive} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product_id">Product</Label>
                <Select
                  value={receiveForm.product_id}
                  onValueChange={(value) => setReceiveForm({ ...receiveForm, product_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center">
                          <Package className="w-4 h-4 mr-2" />
                          {product.name} ({product.sku})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_id">Destination Location</Label>
                <Select
                  value={receiveForm.location_id}
                  onValueChange={(value) => setReceiveForm({ ...receiveForm, location_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          {location.name} ({location.type})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={receiveForm.quantity}
                  onChange={(e) => setReceiveForm({ 
                    ...receiveForm, 
                    quantity: parseInt(e.target.value) || 1 
                  })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  placeholder="Purchase order number, supplier info, condition notes..."
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Processing..." : "Receive Goods"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receiving Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Step 1: Verify Product</h4>
              <p className="text-sm text-muted-foreground">
                Confirm the product matches what was ordered and is in good condition.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Step 2: Count Quantity</h4>
              <p className="text-sm text-muted-foreground">
                Accurately count and record the quantity received.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Step 3: Choose Location</h4>
              <p className="text-sm text-muted-foreground">
                Select an appropriate storage location based on product type and availability.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Step 4: Add Notes</h4>
              <p className="text-sm text-muted-foreground">
                Record any important information like PO numbers, supplier details, or condition notes.
              </p>
            </div>

            <div className="p-3 bg-accent/10 rounded-md">
              <p className="text-sm text-accent-foreground">
                💡 <strong>Tip:</strong> This will automatically update your inventory levels 
                and create a movement record for tracking.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Receive;