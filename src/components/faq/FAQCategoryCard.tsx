import { HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getIconComponent } from '@/lib/icons/iconMap';

interface FAQCategoryCardProps {
  name: string;
  icon: string;
  count: number;
  onClick: () => void;
  active?: boolean;
}

export function FAQCategoryCard({ name, icon, count, onClick, active }: FAQCategoryCardProps) {
  const Icon = getIconComponent(icon) ?? HelpCircle;

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-all ${
        active ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{name}</h3>
            <Badge variant="secondary" className="mt-1">
              {count} question{count !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
