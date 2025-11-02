/**
 * MenuList Component
 * Display list of available menus for customers
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function MenuList() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Available Menus</h3>
      <p className="text-muted-foreground">No active menus at this time.</p>
    </Card>
  );
}
