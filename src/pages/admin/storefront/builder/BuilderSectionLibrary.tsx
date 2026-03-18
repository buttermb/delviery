/**
 * BuilderSectionLibrary
 * Tab panel for browsing and adding new sections to the storefront layout.
 */

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SECTION_REGISTRY, SECTION_CATEGORIES, type SectionCategory } from './storefront-builder.config';

interface BuilderSectionLibraryProps {
    onAddSection: (type: string) => void;
}

export function BuilderSectionLibrary({ onAddSection }: BuilderSectionLibraryProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const result: Partial<Record<SectionCategory, typeof SECTION_REGISTRY>> = {};

        // Iterate through all defined categories to maintain consistent order
        Object.entries(SECTION_CATEGORIES).forEach(([categoryKey, _categoryInfo]) => {
            const key = categoryKey as SectionCategory;
            const categorySections = Object.entries(SECTION_REGISTRY).filter(
                ([_, config]) => config.category === key
            );

            const filteredSections = query
                ? categorySections.filter(([_, config]) =>
                    config.label.toLowerCase().includes(query) ||
                    config.description.toLowerCase().includes(query)
                )
                : categorySections;

            if (filteredSections.length > 0) {
                result[key] = Object.fromEntries(filteredSections) as typeof SECTION_REGISTRY;
            }
        });

        return result;
    }, [searchQuery]);

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search sections..."
                        className="pl-9 bg-muted/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {Object.keys(filteredCategories).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No sections found matching "{searchQuery}"
                        </div>
                    ) : (
                        Object.entries(filteredCategories).map(([categoryKey, sections]) => {
                            const category = SECTION_CATEGORIES[categoryKey as SectionCategory];
                            return (
                                <div key={categoryKey} className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground border-b pb-1">
                                        <category.icon className="w-4 h-4" />
                                        <span>{category.label}</span>
                                    </div>
                                    <div className="grid gap-2">
                                        {Object.entries(sections!).map(([type, config]) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => onAddSection(type)}
                                                className="flex flex-col items-start rounded-md border border-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2 mb-1 w-full">
                                                    <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                                                        <config.icon className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-sm font-medium leading-tight">{config.label}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground line-clamp-2 pr-2 leading-relaxed">
                                                    {config.description}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
