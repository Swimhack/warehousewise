import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, ClipboardList, Calendar, User, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface PickOrder {
  id: string;
  order_number: string;
  status: string;
  assigned_user_id: string | null;
  priority: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface PickOrderItem {
  id: string;
  pick_order_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_picked: number | null;
  is_completed: boolean;
  location_id: string | null;
  products: {
    name: string;
    sku: string;
  };
  locations: {
    name: string;
  } | null;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface CreateOrderForm {
  order_number: string;
  priority: number;
  due_date: string;
  notes: string;
  items: {
    product_id: string;
    quantity: number;
  }[];
}

const PickOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PickOrder[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, PickOrderItem[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateOrderForm>({
    order_number: "",
    priority: 1,
    due_date: "",
    notes: "",
    items: [{ product_id: "", quantity: 1 }],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load orders and products in parallel
      const [ordersResult, productsResult] = await Promise.all([
        supabase.from("pick_orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id, sku, name").order("name")
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;

      setOrders(ordersResult.data || []);
      setProducts(productsResult.data || []);

      // Load items for each order
      if (ordersResult.data) {
        const itemsPromises = ordersResult.data.map(async (order) => {
          const { data } = await supabase
            .from("pick_order_items")
            .select(`
              *,
              products (name, sku),
              locations (name)
            `)
            .eq("pick_order_id", order.id);
          
          return { orderId: order.id, items: data || [] };
        });

        const itemsResults = await Promise.all(itemsPromises);
        const itemsMap = itemsResults.reduce((acc, { orderId, items }) => {
          acc[orderId] = items as PickOrderItem[];
          return acc;
        }, {} as Record<string, PickOrderItem[]>);

        setOrderItems(itemsMap);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load pick orders");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to create orders");
      return;
    }

    try {
      // Create the pick order
      const { data: orderData, error: orderError } = await supabase
        .from("pick_orders")
        .insert([{
          order_number: createForm.order_number,
          priority: createForm.priority,
          due_date: createForm.due_date || null,
          notes: createForm.notes || null,
          status: "open",
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create the order items
      const itemsToInsert = createForm.items
        .filter(item => item.product_id && item.quantity > 0)
        .map(item => ({
          pick_order_id: orderData.id,
          product_id: item.product_id,
          quantity_requested: item.quantity,
        }));

      if (itemsToInsert.length === 0) {
        throw new Error("Please add at least one item to the order");
      }

      const { error: itemsError } = await supabase
        .from("pick_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Pick order created successfully!");
      setShowCreateDialog(false);
      setCreateForm({
        order_number: "",
        priority: 1,
        due_date: "",
        notes: "",
        items: [{ product_id: "", quantity: 1 }],
      });
      loadData();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Failed to create order");
    }
  };

  const addItemToForm = () => {
    setCreateForm({
      ...createForm,
      items: [...createForm.items, { product_id: "", quantity: 1 }],
    });
  };

  const removeItemFromForm = (index: number) => {
    setCreateForm({
      ...createForm,
      items: createForm.items.filter((_, i) => i !== index),
    });
  };

  const updateFormItem = (index: number, field: string, value: string | number) => {
    const newItems = [...createForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateForm({ ...createForm, items: newItems });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "complete": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order.notes && order.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Pick Orders</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <ClipboardList className="w-8 h-8 mr-3 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pick Orders</h1>
            <p className="text-muted-foreground">Manage and track picking operations</p>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Pick Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order_number">Order Number</Label>
                  <Input
                    id="order_number"
                    value={createForm.order_number}
                    onChange={(e) => setCreateForm({ ...createForm, order_number: e.target.value })}
                    placeholder="PO-2024-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={createForm.priority.toString()}
                    onValueChange={(value) => setCreateForm({ ...createForm, priority: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Low</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">High</SelectItem>
                      <SelectItem value="4">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Order notes..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Items</Label>
                {createForm.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select
                        value={item.product_id}
                        onValueChange={(value) => updateFormItem(index, "product_id", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(index, "quantity", parseInt(e.target.value) || 1)}
                        placeholder="Qty"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItemFromForm(index)}
                      disabled={createForm.items.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItemToForm}>
                  Add Item
                </Button>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">Create Order</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <CardTitle className="text-lg">{order.order_number}</CardTitle>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.replace("_", " ").toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    Priority: {order.priority}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {order.due_date ? new Date(order.due_date).toLocaleDateString() : "No due date"}
                  </div>
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {order.assigned_user_id ? "Assigned" : "Unassigned"}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {order.notes && (
                <p className="text-sm text-muted-foreground mb-4">{order.notes}</p>
              )}
              
              <div className="space-y-2">
                <h4 className="font-medium">Items:</h4>
                <div className="space-y-1">
                  {orderItems[order.id]?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span className="font-medium">{item.products?.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">({item.products?.sku})</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm">
                          <span className="font-medium">
                            {item.quantity_picked || 0} / {item.quantity_requested}
                          </span>
                          <span className="text-muted-foreground ml-1">picked</span>
                        </div>
                        <Badge variant={item.is_completed ? "default" : "secondary"}>
                          {item.is_completed ? "Complete" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  )) || <p className="text-sm text-muted-foreground">No items</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOrders.length === 0 && !loading && (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== "all" ? "No orders match your filters." : "No pick orders yet. Create your first order!"}
          </p>
        </div>
      )}
    </div>
  );
};

export default PickOrders;