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
import { Switch } from "@/components/ui/switch";
import { Search, Plus, MapPin, Building } from "lucide-react";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LocationForm {
  name: string;
  type: "dock" | "shelf" | "bin" | "staging" | "quarantine";
  capacity: number | null;
  is_active: boolean;
}

const Locations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationForm>({
    name: "",
    type: "shelf",
    capacity: null,
    is_active: true,
  });

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    filterLocations();
  }, [locations, searchTerm]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error loading locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  const filterLocations = () => {
    if (!searchTerm) {
      setFilteredLocations(locations);
      return;
    }

    const filtered = locations.filter(
      (location) =>
        location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredLocations(filtered);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from("locations")
        .insert([locationForm]);

      if (error) throw error;

      toast.success("Location added successfully!");
      setShowAddDialog(false);
      setLocationForm({
        name: "",
        type: "shelf",
        capacity: null,
        is_active: true,
      });
      loadLocations();
    } catch (error: any) {
      console.error("Error adding location:", error);
      toast.error(error.message || "Failed to add location");
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "dock": return "bg-blue-100 text-blue-800";
      case "shelf": return "bg-green-100 text-green-800";
      case "bin": return "bg-yellow-100 text-yellow-800";
      case "staging": return "bg-purple-100 text-purple-800";
      case "quarantine": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Locations</h1>
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
        <h1 className="text-3xl font-bold text-foreground">Locations</h1>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddLocation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name</Label>
                  <Input
                    id="name"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                    placeholder="A1-01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={locationForm.type}
                    onValueChange={(value: "dock" | "shelf" | "bin" | "staging" | "quarantine") => 
                      setLocationForm({ ...locationForm, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dock">Dock</SelectItem>
                      <SelectItem value="shelf">Shelf</SelectItem>
                      <SelectItem value="bin">Bin</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="quarantine">Quarantine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (optional)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={locationForm.capacity || ""}
                  onChange={(e) => setLocationForm({ 
                    ...locationForm, 
                    capacity: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="Maximum items"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={locationForm.is_active}
                  onCheckedChange={(checked) => setLocationForm({ ...locationForm, is_active: checked })}
                />
                <Label htmlFor="is_active">Active Location</Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">Add Location</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Storage Locations ({filteredLocations.length})
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Building className="w-4 h-4 mr-2 text-muted-foreground" />
                        {location.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(location.type)}>
                        {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {location.capacity ? `${location.capacity} items` : "Unlimited"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? "default" : "secondary"}>
                        {location.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(location.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredLocations.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No locations found matching your search." : "No locations yet. Add your first location!"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Locations;