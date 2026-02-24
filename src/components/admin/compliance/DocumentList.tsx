import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Loader2, Calendar } from "lucide-react";

interface ComplianceDocument {
  id: string;
  name: string;
  document_type: string;
  expiration_date: string | null;
  status: string;
  created_at: string;
}

interface DocumentListProps {
  documents: ComplianceDocument[];
  isLoading: boolean;
  onSelect: (document: ComplianceDocument) => void;
}

export function DocumentList({ documents, isLoading, onSelect }: DocumentListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "expired":
        return "destructive";
      case "expiring_soon":
        return "default";
      case "active":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No documents found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSelect(doc)}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(doc); } }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-sm font-medium truncate">{doc.name}</div>
                  <Badge variant={getStatusColor(doc.status) as "default" | "secondary" | "destructive" | "outline"} className="shrink-0">
                    {doc.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-4">
                  <span className="capitalize">{doc.document_type}</span>
                  {doc.expiration_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Expires: {format(new Date(doc.expiration_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

