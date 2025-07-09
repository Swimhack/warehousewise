import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2 } from "lucide-react";
import { createSampleData } from "@/lib/sampleData";

const SampleDataButton = () => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSampleData = async () => {
    setIsCreating(true);
    await createSampleData();
    setIsCreating(false);
    // Refresh the page to show new data
    window.location.reload();
  };

  return (
    <Button 
      onClick={handleCreateSampleData} 
      disabled={isCreating}
      variant="outline"
      className="flex items-center gap-2"
    >
      {isCreating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Database className="h-4 w-4" />
      )}
      {isCreating ? "Creating Sample Data..." : "Create Sample Data"}
    </Button>
  );
};

export default SampleDataButton;