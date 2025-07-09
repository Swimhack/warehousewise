import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Lightbulb, Package, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface InventoryData {
  totalProducts: number;
  lowStockItems: any[];
  recentMovements: any[];
  topProducts: any[];
  locationUtilization: any[];
}

const AIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! I'm your warehouse AI assistant. I can help you with inventory queries, stock analysis, and operational insights. Try asking me about low stock items, recent movements, or inventory trends!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInventoryData();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadInventoryData = async () => {
    try {
      const [productsResult, lowStockResult, movementsResult] = await Promise.all([
        supabase.from("products").select("*").order("quantity", { ascending: false }),
        supabase.from("products").select("*").lte("quantity", 10).order("quantity"),
        supabase.from("stock_movements").select(`
          *,
          products (name, sku),
          from_location:locations!stock_movements_from_location_id_fkey (name),
          to_location:locations!stock_movements_to_location_id_fkey (name)
        `).order("timestamp", { ascending: false }).limit(50)
      ]);

      const products = productsResult.data || [];
      const lowStock = lowStockResult.data || [];
      const movements = movementsResult.data || [];

      setInventoryData({
        totalProducts: products.length,
        lowStockItems: lowStock,
        recentMovements: movements,
        topProducts: products.slice(0, 10),
        locationUtilization: [], // Could be calculated from movements
      });
    } catch (error) {
      console.error("Error loading inventory data:", error);
    }
  };

  const generateResponse = async (query: string): Promise<string> => {
    if (!inventoryData) return "I'm still loading inventory data. Please try again in a moment.";

    const lowerQuery = query.toLowerCase();

    // Low stock queries
    if (lowerQuery.includes("low stock") || lowerQuery.includes("running low") || lowerQuery.includes("restock")) {
      if (inventoryData.lowStockItems.length === 0) {
        return "Great news! No items are currently running low on stock. All products are well-stocked.";
      }
      
      const lowStockList = inventoryData.lowStockItems
        .slice(0, 5)
        .map(item => `• ${item.name} (${item.sku}): ${item.quantity} remaining`)
        .join("\n");
      
      return `Here are the items that are running low on stock:\n\n${lowStockList}\n\n${inventoryData.lowStockItems.length > 5 ? `And ${inventoryData.lowStockItems.length - 5} more items...` : ""}`;
    }

    // Recent movements queries
    if (lowerQuery.includes("recent") || lowerQuery.includes("movement") || lowerQuery.includes("activity")) {
      if (inventoryData.recentMovements.length === 0) {
        return "No recent stock movements found. The warehouse has been quiet lately.";
      }
      
      const recentList = inventoryData.recentMovements
        .slice(0, 5)
        .map(mov => `• ${mov.movement_type.toUpperCase()}: ${mov.quantity} ${mov.products?.name || "Unknown"} (${new Date(mov.timestamp).toLocaleDateString()})`)
        .join("\n");
      
      return `Here are the most recent stock movements:\n\n${recentList}`;
    }

    // Top products queries
    if (lowerQuery.includes("top products") || lowerQuery.includes("highest stock") || lowerQuery.includes("most inventory")) {
      const topList = inventoryData.topProducts
        .slice(0, 5)
        .map(product => `• ${product.name} (${product.sku}): ${product.quantity} units`)
        .join("\n");
      
      return `Here are the products with the highest stock levels:\n\n${topList}`;
    }

    // Total inventory queries
    if (lowerQuery.includes("total") || lowerQuery.includes("how many products") || lowerQuery.includes("inventory count")) {
      const totalStock = inventoryData.topProducts.reduce((sum, product) => sum + product.quantity, 0);
      return `You currently have ${inventoryData.totalProducts} different products in your inventory, with a total of ${totalStock} units across all items.`;
    }

    // Search for specific product
    const productMatch = inventoryData.topProducts.find(product => 
      product.name.toLowerCase().includes(lowerQuery) || 
      product.sku.toLowerCase().includes(lowerQuery)
    );
    
    if (productMatch) {
      return `Found ${productMatch.name} (${productMatch.sku}):\n• Current stock: ${productMatch.quantity} units\n• Unit type: ${productMatch.unit_type}\n• Min stock level: ${productMatch.min_stock_level || 0}`;
    }

    // Default suggestions
    return `I can help you with various warehouse queries! Here are some things you can ask me:

• "What items are running low on stock?"
• "Show me recent inventory movements"
• "What are the top products by stock level?"
• "How many products do we have in total?"
• "Tell me about [specific product name]"

What would you like to know about your inventory?`;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await generateResponse(input);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error generating response:", error);
      toast.error("Failed to generate response");
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    {
      icon: AlertTriangle,
      question: "What items are running low on stock?",
      color: "text-orange-600",
    },
    {
      icon: Activity,
      question: "Show me recent inventory movements",
      color: "text-blue-600",
    },
    {
      icon: TrendingUp,
      question: "What are the top products by stock level?",
      color: "text-green-600",
    },
    {
      icon: Package,
      question: "How many products do we have in total?",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Bot className="w-8 h-8 mr-3 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
          <p className="text-muted-foreground">Get intelligent insights about your warehouse operations</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                Warehouse Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex items-start space-x-2 max-w-[80%] ${
                          message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            message.type === "user" ? "bg-primary" : "bg-secondary"
                          }`}
                        >
                          {message.type === "user" ? (
                            <User className="w-4 h-4 text-primary-foreground" />
                          ) : (
                            <Bot className="w-4 h-4 text-secondary-foreground" />
                          )}
                        </div>
                        <div
                          className={`p-3 rounded-lg ${
                            message.type === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-start space-x-2">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="w-4 h-4 text-secondary-foreground" />
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <form onSubmit={handleSendMessage} className="flex gap-2 mt-4">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me about your inventory..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Lightbulb className="w-5 h-5 mr-2" />
                Quick Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickQuestions.map((q, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start h-auto p-3 text-left"
                  onClick={() => setInput(q.question)}
                >
                  <q.icon className={`w-4 h-4 mr-2 ${q.color}`} />
                  <span className="text-sm">{q.question}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assistant Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="mt-0.5">
                    <Package className="w-3 h-3" />
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Inventory Analysis</p>
                    <p className="text-xs text-muted-foreground">Stock levels, product searches</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="mt-0.5">
                    <Activity className="w-3 h-3" />
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Movement Tracking</p>
                    <p className="text-xs text-muted-foreground">Recent activity, trends</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="mt-0.5">
                    <AlertTriangle className="w-3 h-3" />
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Alerts & Insights</p>
                    <p className="text-xs text-muted-foreground">Low stock warnings, suggestions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;