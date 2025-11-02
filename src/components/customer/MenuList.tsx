import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Calendar, Users } from "lucide-react";
import { Link } from "react-router-dom";

interface Menu {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  expires_at?: string;
  view_count?: number;
}

interface MenuListProps {
  menus: Menu[];
}

export function MenuList({ menus }: MenuListProps) {
  if (!menus || menus.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No menus available at the moment.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {menus.map((menu) => (
        <Card key={menu.id} className="p-6 hover:shadow-lg transition-shadow">
          <h3 className="font-semibold text-lg mb-2">{menu.name}</h3>
          {menu.description && (
            <p className="text-sm text-muted-foreground mb-4">{menu.description}</p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            {menu.view_count !== undefined && (
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{menu.view_count}</span>
              </div>
            )}
            {menu.expires_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Expires {new Date(menu.expires_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <Link to={`/customer/menu/${menu.id}`}>
            <Button className="w-full">
              View Menu
            </Button>
          </Link>
        </Card>
      ))}
    </div>
  );
}
