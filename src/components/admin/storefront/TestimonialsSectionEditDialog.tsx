/**
 * TestimonialsSectionEditDialog
 * Dialog for editing testimonials section with star ratings, add/remove, and Save/Cancel.
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StarRating } from '@/components/reviews/StarRating';

interface TestimonialItem {
    name: string;
    role: string;
    quote: string;
    rating: number;
}

interface TestimonialsContent {
    heading: string;
    subheading: string;
    testimonials: TestimonialItem[];
}

interface TestimonialsSectionEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    content: Record<string, unknown>;
    onSave: (content: TestimonialsContent) => void;
}

const DEFAULT_TESTIMONIAL: TestimonialItem = {
    name: 'Customer Name',
    role: 'Verified Customer',
    quote: 'Great experience!',
    rating: 5,
};

export function TestimonialsSectionEditDialog({
    open,
    onOpenChange,
    content,
    onSave,
}: TestimonialsSectionEditDialogProps) {
    const [draft, setDraft] = useState<TestimonialsContent>({
        heading: '',
        subheading: '',
        testimonials: [],
    });

    // Reset draft when dialog opens with fresh content
    useEffect(() => {
        if (open) {
            setDraft({
                heading: (content.heading as string) ?? 'What Our Customers Say',
                subheading: (content.subheading as string) ?? 'Join thousands of satisfied customers',
                testimonials: (content.testimonials as TestimonialItem[]) ?? [],
            });
        }
    }, [open, content]);

    const updateTestimonial = (index: number, key: keyof TestimonialItem, value: string | number) => {
        setDraft((prev) => {
            const updated = [...prev.testimonials];
            updated[index] = { ...updated[index], [key]: value };
            return { ...prev, testimonials: updated };
        });
    };

    const addTestimonial = () => {
        setDraft((prev) => ({
            ...prev,
            testimonials: [...prev.testimonials, { ...DEFAULT_TESTIMONIAL }],
        }));
    };

    const removeTestimonial = (index: number) => {
        setDraft((prev) => ({
            ...prev,
            testimonials: prev.testimonials.filter((_, i) => i !== index),
        }));
    };

    const handleSave = () => {
        onSave(draft);
        onOpenChange(false);
    };

    const handleCancel = () => {
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit Testimonials</DialogTitle>
                    <DialogDescription>
                        Edit your testimonials section heading and customer reviews.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Section heading */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="testimonials-heading" className="text-sm font-medium">
                                Heading
                            </Label>
                            <Input
                                id="testimonials-heading"
                                value={draft.heading}
                                onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, heading: e.target.value }))
                                }
                                placeholder="What Our Customers Say"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="testimonials-subheading" className="text-sm font-medium">
                                Subheading
                            </Label>
                            <Input
                                id="testimonials-subheading"
                                value={draft.subheading}
                                onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, subheading: e.target.value }))
                                }
                                placeholder="Join thousands of satisfied customers"
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Testimonials list */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">
                                Testimonials ({draft.testimonials.length})
                            </Label>
                            <Button variant="outline" size="sm" onClick={addTestimonial}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add
                            </Button>
                        </div>

                        {draft.testimonials.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No testimonials yet. Click "Add" to create one.
                            </p>
                        )}

                        {draft.testimonials.map((item, index) => (
                            <div
                                key={index}
                                className="p-3 border rounded-lg space-y-2.5 bg-muted/30"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Testimonial {index + 1}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeTestimonial(index)}
                                        aria-label={`Remove testimonial ${index + 1}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Name</Label>
                                        <Input
                                            value={item.name}
                                            onChange={(e) =>
                                                updateTestimonial(index, 'name', e.target.value)
                                            }
                                            placeholder="Customer name"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Role</Label>
                                        <Input
                                            value={item.role}
                                            onChange={(e) =>
                                                updateTestimonial(index, 'role', e.target.value)
                                            }
                                            placeholder="Role / Title"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Quote</Label>
                                    <Textarea
                                        value={item.quote}
                                        onChange={(e) =>
                                            updateTestimonial(index, 'quote', e.target.value)
                                        }
                                        placeholder="Their testimonial..."
                                        rows={2}
                                        className="text-sm"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Rating</Label>
                                    <StarRating
                                        value={item.rating}
                                        onChange={(rating) =>
                                            updateTestimonial(index, 'rating', rating)
                                        }
                                        size="md"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
