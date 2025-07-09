import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Activity, ArrowRight, Package, MapPin, Calendar, User, Filter } from "lucide-react";
import { toast } from "sonner";

interface StockMovement {
  id: string;
  product_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number;
  movement_type: string;
  notes: string | null;
  timestamp: string;
  user_id: string;
  products: {
    name: string;
    sku: string;
  } | null;
  from_location: {
    name: string;
  } | null;
  to_location: {
    name: string;
  } | null;
  user_profiles: {
    full_name: string | null;
  } | null;
}

const Movements = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    loadMovements();
  }, []);

  useEffect(() => {
    filterMovements();
  }, [movements, searchTerm, typeFilter, dateFilter]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          *,
          products (name, sku),
          from_location:locations!stock_movements_from_location_id_fkey (name),
          to_location:locations!stock_movements_to_location_id_fkey (name)
        `)
        .order("timestamp", { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData = (data || []).map(movement => ({
        ...movement,
        user_profiles: null // We'll handle user names differently to avoid complex joins
      }));
      
      setMovements(transformedData as StockMovement[]);
    } catch (error) {
      console.error("Error loading movements:", error);
      toast.error("Failed to load stock movements");
    } finally {
      setLoading(false);
    }
  };

  const filterMovements = () => {
    let filtered = movements;

    // Text search
    if (searchTerm) {
      filtered = filtered.filter(movement =>
        movement.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.products?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.from_location?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.to_location?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (movement.notes && movement.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(movement => movement.movement_type === typeFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (dateFilter) {
        case "today":
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(movement => 
        new Date(movement.timestamp) >= cutoffDate
      );
    }

    setFilteredMovements(filtered);
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case "receive": return "bg-green-100 text-green-800";
      case "putaway": return "bg-blue-100 text-blue-800";
      case "pick": return "bg-orange-100 text-orange-800";
      case "adjustment": return "bg-purple-100 text-purple-800";
      case "transfer": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getMovementDescription = (movement: StockMovement) => {
    switch (movement.movement_type) {
      case "receive":
        return `Received ${movement.quantity} items to ${movement.to_location?.name || "Unknown location"}`;
      case "putaway":
        return `Moved ${movement.quantity} items from ${movement.from_location?.name || "Unknown"} to ${movement.to_location?.name || "Unknown"}`;
      case "pick":
        return `Picked ${movement.quantity} items from ${movement.from_location?.name || "Unknown location"}`;
      case "adjustment":
        return `Adjusted quantity by ${movement.quantity > 0 ? '+' : ''}${movement.quantity}`;
      case "transfer":
        return `Transferred ${movement.quantity} items from ${movement.from_location?.name || "Unknown"} to ${movement.to_location?.name || "Unknown"}`;
      default:
        return `${movement.movement_type} - ${movement.quantity} items`;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Stock Movements</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Activity className="w-8 h-8 mr-3 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Movements</h1>
          <p className="text-muted-foreground">Track all inventory movements and transactions</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search movements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="receive">Receive</SelectItem>
            <SelectItem value="putaway">Putaway</SelectItem>
            <SelectItem value="pick">Pick</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Movement History ({filteredMovements.length})
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Showing {filteredMovements.length} of {movements.length} movements</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMovements.map((movement) => (
              <div key={movement.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Badge className={getMovementTypeColor(movement.movement_type)}>
                      {movement.movement_type.toUpperCase()}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{movement.products?.name}</span>
                      <span className="text-sm text-muted-foreground">({movement.products?.sku})</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(movement.timestamp).toLocaleDateString()}
                    </div>
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      Worker
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {getMovementDescription(movement)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-lg">
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(movement.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                {movement.notes && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                    <strong>Notes:</strong> {movement.notes}
                  </div>
                )}
                
                {(movement.from_location || movement.to_location) && (
                  <div className="mt-2 flex items-center space-x-2 text-sm">
                    {movement.from_location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-muted-foreground" />
                        <span>{movement.from_location.name}</span>
                      </div>
                    )}
                    {movement.from_location && movement.to_location && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    {movement.to_location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-muted-foreground" />
                        <span>{movement.to_location.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {filteredMovements.length === 0 && !loading && (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || typeFilter !== "all" || dateFilter !== "all" 
                  ? "No movements match your filters." 
                  : "No stock movements yet."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Movements;