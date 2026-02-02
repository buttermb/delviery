import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link2 from "lucide-react/dist/esm/icons/link-2";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import type { LucideIcon } from 'lucide-react';

export interface RelatedEntityItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  meta?: string;
}

interface LazyRelatedEntitySection {
  key: string;
  label: string;
  icon?: LucideIcon;
  fetchItems: () => void;
  items: RelatedEntityItem[] | undefined;
  isLoading: boolean;
  error?: Error | null;
  onNavigate?: (itemId: string) => void;
  emptyMessage?: string;
}

interface RelatedEntitiesPanelProps {
  sections: LazyRelatedEntitySection[];
  title?: string;
}

function RelatedEntityLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function RelatedEntityItemRow({
  item,
  onNavigate,
}: {
  item: RelatedEntityItem;
  onNavigate?: (itemId: string) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg ${
        onNavigate ? 'hover:bg-muted/50 cursor-pointer' : ''
      }`}
      onClick={() => onNavigate?.(item.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{item.title}</div>
        {item.subtitle && (
          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {item.status && (
          <Badge variant={item.statusVariant || 'secondary'} className="text-xs">
            {item.status}
          </Badge>
        )}
        {item.meta && (
          <span className="text-xs text-muted-foreground font-medium">{item.meta}</span>
        )}
        {onNavigate && (
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

export function RelatedEntitiesPanel({ sections, title = 'Related Items' }: RelatedEntitiesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const handleValueChange = useCallback(
    (value: string[]) => {
      const newlyExpanded = value.filter((v) => !expandedSections.includes(v));
      newlyExpanded.forEach((sectionKey) => {
        const section = sections.find((s) => s.key === sectionKey);
        if (section && !section.items && !section.isLoading) {
          section.fetchItems();
        }
      });
      setExpandedSections(value);
    },
    [expandedSections, sections]
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion
          type="multiple"
          value={expandedSections}
          onValueChange={handleValueChange}
        >
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const itemCount = section.items?.length;

            return (
              <AccordionItem key={section.key} value={section.key}>
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-sm">
                    {SectionIcon && <SectionIcon className="h-4 w-4 text-muted-foreground" />}
                    <span>{section.label}</span>
                    {itemCount !== undefined && (
                      <Badge variant="secondary" className="text-xs ml-1 h-5 px-1.5">
                        {itemCount}
                      </Badge>
                    )}
                    {section.isLoading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {section.isLoading && <RelatedEntityLoadingSkeleton />}
                  {section.error && (
                    <div className="text-sm text-destructive p-3 border border-destructive/20 rounded-lg">
                      Failed to load {section.label.toLowerCase()}
                    </div>
                  )}
                  {!section.isLoading && !section.error && section.items?.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      {section.emptyMessage || `No ${section.label.toLowerCase()} found`}
                    </div>
                  )}
                  {!section.isLoading && !section.error && section.items && section.items.length > 0 && (
                    <div className="space-y-2">
                      {section.items.map((item) => (
                        <RelatedEntityItemRow
                          key={item.id}
                          item={item}
                          onNavigate={section.onNavigate}
                        />
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
