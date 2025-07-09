import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, TruckIcon, AlertTriangle, Activity, Users } from "lucide-react";
import { toast } from "sonner";
import SampleDataButton from "@/components/SampleDataButton";

interface DashboardStats {
  totalProducts: number;
  totalLocations: number;
  lowStockItems: number;
  pendingPickOrders: number;
  recentMovements: number;
  activeUsers: number;
}

interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  min_stock_level: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalLocations: 0,
    lowStockItems: 0,
    pendingPickOrders: 0,
    recentMovements: 0,
    activeUsers: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get total products
      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      // Get total locations
      const { count: locationsCount } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true });

      // Get low stock items
      const { data: lowStock, count: lowStockCount } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .lte("quantity", 10); // Items with quantity <= 10 are considered low stock

      // Get pending pick orders
      const { count: pendingPickOrdersCount } = await supabase
        .from("pick_orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);

      // Get recent movements (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { count: recentMovementsCount } = await supabase
        .from("stock_movements")
        .select("*", { count: "exact", head: true })
        .gte("timestamp", yesterday.toISOString());

      // Get active users (profiles)
      const { count: activeUsersCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setStats({
        totalProducts: productsCount || 0,
        totalLocations: locationsCount || 0,
        lowStockItems: lowStockCount || 0,
        pendingPickOrders: pendingPickOrdersCount || 0,
        recentMovements: recentMovementsCount || 0,
        activeUsers: activeUsersCount || 0,
      });

      setLowStockItems(lowStock || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Products",
      value: stats.totalProducts,
      icon: Package,
      description: "Items in inventory",
      color: "text-blue-600",
    },
    {
      title: "Locations",
      value: stats.totalLocations,
      icon: MapPin,
      description: "Storage locations",
      color: "text-green-600",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockItems,
      icon: AlertTriangle,
      description: "Need attention",
      color: "text-orange-600",
    },
    {
      title: "Pending Orders",
      value: stats.pendingPickOrders,
      icon: TruckIcon,
      description: "Pick orders",
      color: "text-purple-600",
    },
    {
      title: "Recent Movements",
      value: stats.recentMovements,
      icon: Activity,
      description: "Last 24 hours",
      color: "text-indigo-600",
    },
    {
      title: "Active Users",
      value: stats.activeUsers,
      icon: Users,
      description: "Warehouse workers",
      color: "text-teal-600",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-3">
          <SampleDataButton />
          <Badge variant="outline" className="text-sm">
            Real-time data
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockItems > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-warning flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Low Stock Alert
            </CardTitle>
            <CardDescription>
              {stats.lowStockItems} items are running low on stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-warning/10 rounded-md"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({item.sku})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {item.quantity} / {item.min_stock_level}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current / Min
                    </div>
                  </div>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {lowStockItems.length - 5} more items...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;